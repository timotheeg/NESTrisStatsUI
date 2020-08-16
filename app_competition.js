const fs = require('fs');
const readline = require('readline');
const WebSocket = require('ws');
const NEStrisServer = require('./NESTrisServer');

const admin_port   = 4000;
const player1_port = 4001;
const player2_port = 4002;
const view_port    = 4003;


console.log('Setting up Viewer WS server');

const viewer_wss = new WebSocket.Server({ port: view_port });

const viewer_conns = new Set();

viewer_wss.on('connection', function connection(ws) {
	console.log('view connected');
/*
	const readInterface = readline.createInterface({
		input: fs.createReadStream('player1_frames_log_long_play.log'),
		output: process.stdout,
		console: false
	});

	readInterface.on('line', function(line) {
	    frame = JSON.parse(line);
	    ws.send(JSON.stringify(['frame', 1, frame]));
	});
/**/

	viewer_conns.add(ws);

	ws.on('close', () => {
		viewer_conns.delete(ws);
	});
});

function RPCToViewers(...args) {
	// console.log(...args);

	const msg = JSON.stringify(args);

	[...viewer_conns].forEach(ws => {
		ws.send(msg);
	});
}


console.log('Setting up Admin WS server');

const admin_wss = new WebSocket.Server({ port: admin_port });

let admin_conn;

admin_wss.on('connection', function connection(ws) {
	if (admin_conn) {
		admin_conn.removeAllListeners('message');
		admin_conn.close();
	}

	console.log('admin connected');

	admin_conn = ws;

	admin_conn.on('message', message => {
		RPCToViewers(...JSON.parse(message));
	});
});


console.log('Setting up Admin CLI WS server');

const ViewAPI = new Proxy({}, {
	get: function(target, prop, ...args) {
		return function(...args) {
			RPCToViewers(prop, ...args);
		}
	}
});


const server_p1 = new NEStrisServer(player1_port, 'player 1'); // , 'player1_frames_log.js');
const server_p2 = new NEStrisServer(player2_port, 'player 2');

server_p1.on('frame', data => RPCToViewers('frame', 1, data));
server_p2.on('frame', data => RPCToViewers('frame', 2, data));


// Adding a temporary producing web socket server for player 1
// Web producer server

const web_producer_wss = new WebSocket.Server({ port: 3336 });

web_producer_wss.on('connection', function connection(ws) {
	console.log('Web producer connected');

	ws.on('error', () => {});
	ws.on('close', () => {
		console.log('Web producer disconnected');
	});
	ws.on('message', message => {
		RPCToViewers('frame', 1, JSON.parse(message));
	});
});



module.exports = ViewAPI;
