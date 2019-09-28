const WebSocket = require('ws');
 
const wss = new WebSocket.Server({ port: 3338 });

const connections = new Set();

wss.on('connection', function connection(ws) {

  connections.add(ws);

  ws.on('close', () => {
    connections.remove(ws);
  });

  ws.on('message', console.log);

});


module.exports = new Proxy({}, {
  get: function(target, prop, ...args) {
    return function(...args) {
      const msg = JSON.stringify([prop, ...args]);

      [...connections].forEach(ws => {
        ws.send(msg);
      });
    }
  }
});
