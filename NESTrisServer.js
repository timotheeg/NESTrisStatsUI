const net = require('net');
const EventEmitter = require('events');

class NESTrisServer extends EventEmitter {
	constructor(port, server_id = 'default') {
		super();

		this.port = port;
		this.server_id = server_id;

		this.server = net.createServer(this.handleConnection.bind(this));

		this.server.on('error', console.error);

		this.server.listen(port, () => {
			console.log(`Server ${this.server_id} ready`);
		});
	}

	clearConn() {
		if (this.conn) {
			this.conn.removeAllListeners();
			this.conn.end();
		}
	}

	handleConnection(conn) {
		console.log(`OCR producer ${this.server_id} connected`);

		this.clearConn(); // incoming connection kicks old one out... TODO: IMplement safeguard to be be controlled by API

		this.conn = conn;

		let stream_data = Buffer.from([]);

		const onData = () => {
			// check if ready to process:
			const msg_length = stream_data.readInt32LE();

			if (stream_data.length < msg_length + 4) return; // not enough data, wait for more

			const frame_data = stream_data.toString('utf8', 4, msg_length + 4)

			this.emit('frame', JSON.parse(frame_data));

			stream_data = stream_data.slice(msg_length + 4);

			if (stream_data.length) {
				// there's more data, check if we can process some more!
				onData();
			}
		}

		conn
			.on('end', () => {
				console.log(`OCR producer ${this.server_id} disconnected`);
				conn.removeAllListeners();
			})
			.on('data', data => {
				stream_data = Buffer.concat([stream_data, data]);
				onData();
			});
	}
}

module.exports = NESTrisServer;
