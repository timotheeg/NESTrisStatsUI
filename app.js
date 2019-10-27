'use strict'

const net = require('net');
const path = require('path');
const AutoLoad = require('fastify-autoload');
const config = require('./config');

module.exports = function (fastify, opts, next) {
  // Place here your custom code!
  // for static assets
  fastify.register(require('fastify-static'), {
    root: path.join(__dirname, 'public')
  });

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: Object.assign({}, opts)
  });

  // This loads all plugins defined in services
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'services'),
    options: Object.assign({}, opts)
  });

  // Make sure to call next when done
  next();
}


// set up twitch bot
const WebSocket = require('ws');
 
const wss = new WebSocket.Server({ port: 3339 });

const connections = new Set();

wss.on('connection', function connection(ws) {

  console.log('connection on 3339');

  connections.add(ws);

  ws.on('close', () => {
    connections.delete(ws);
  });

  ws.on('message', console.log);
});



const ClientConnectionAPI = new Proxy({}, {
  get: function(target, prop, ...args) {
    return function(...args) {
      const msg = JSON.stringify([prop, ...args]);

      [...connections].forEach(ws => {
        ws.send(msg);
      });
    }
  }
});


// Connect to Twitch and forward chgat messages to client
const TwitchBot = require('twitch-bot')

const Bot = new TwitchBot(config.twitch);

Bot.on('join', channel => {
  console.log(`Joined channel: ${channel}`)
});

['connected', 'error', 'close', 'timeout', 'ban', 'message', 'part', 'subscription'].forEach(evt => {
  Bot.on(evt, data => {
    console.log(evt, data);
  });
});

Bot.on('message', chatter => {
  ClientConnectionAPI.message(chatter);
});


// Open server to receive OCR events and forward them to client
// OCR client sends data in the form <BYTELENGTH32LE><DATA>, so we must extract the header first
// Below is the minimum code to do that
const server = net.createServer((conn) => {
  // 'connection' listener.
  console.log('OCR producer connected');

  let stream_data = Buffer.from([]);

  function onData() {
    // check if ready to process:
    const msg_length = stream_data.readInt32LE();

    if (stream_data.length < msg_length + 4) return; // not enough data, wait for more

    const frame_data = stream_data.toString('utf8', 4, msg_length + 4)

    ClientConnectionAPI.frame(JSON.parse(frame_data));

    stream_data = stream_data.slice(msg_length + 4);

    if (stream_data.length) {
      // there's more data, check if we can process some more!
      onData();
    }
  }

  conn
    .on('end', () => {
      console.log('OCR producer disconnected');
    })
    .on('data', data => {
      stream_data = Buffer.concat([stream_data, data]);
      onData();
    });
});

server.on('error', (err) => {
  console.error(err);
});

server.listen(3338, () => {
  console.log('Ready to receive OCR events');
});


