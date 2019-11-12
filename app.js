'use strict'

const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const AutoLoad = require('fastify-autoload');
const config = require('./config');
const TetrisDAO = require('./daos/tetris');
const _ = require('lodash');

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


// Voice Management for OSX
// TODO: Use Google Text-To-Speech API and generate a broader range of voices
const
  // all the en_XX voices
  voices = _.shuffle([
    'Alex',
    'Fred',
    'Moira',
    'Samantha',
    'Tessa',
    'Veena',
    'Victoria'
  ]),
  voice_map = new Map(), // to track which user has which voice
  say_queue = []; // ensure only one message is spoken at a time

let
  saying = false,
  voice_index = 0;

// hardcode known stream visitors
voice_map.set('puffy2303', 'Karen');
voice_map.set('yobi9',     'Daniel');

// Add the assigned voices to the mix again, but as last entries
// I wish there was more choices
voices.push('Daniel', 'Karen');


function getVoice(username) {
  if (!voice_map.has(username)) {
    voice_map.set(username, voices[voice_index++]);
  }

  return voice_map.get(username);
}

function _sayNextMessage(from_previous_message_complete) {
  if (!from_previous_message_complete && saying) return;

  if (!say_queue.length) {
    saying = false;
    return;
  }

  saying = true;

  const chatter = say_queue.shift();

  // Using spawn to have guaranteed arg safety (no command injection)
  // see: https://www.owasp.org/index.php/Command_Injection
  // doc: https://nodejs.org/api/child_process.html#child_process_asynchronous_process_creation
  const say = spawn('say', [
    '-v',
    getVoice(chatter.username),
    chatter.message
  ]);

  say.stderr.on('error', console.error);

  say.on('close', (code) => {
    console.log(`[${chatter.username}] said [${chatter.message}] with exit code [${code}]`);
    setTimeout(_sayNextMessage, 1500, true); // force 1.5s pause between messages
  });
}

function sayMessage(chatter) {
  say_queue.push(chatter);
  _sayNextMessage();
}

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
  if (chatter.username && chatter.message) {
    sayMessage(chatter);
  }

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


// Listen for player change to force score update immediately

TetrisDAO.onScoreUpdate = function(data) {
  ClientConnectionAPI.player_data(data);
}
