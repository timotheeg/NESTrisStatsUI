'use strict'

const net = require('net');
const path = require('path');
const AutoLoad = require('fastify-autoload');
const config = require('./config');
const NEStrisServer = require('./NesTrisServer');
const TetrisDAO = require('./daos/tetris');
const _ = require('lodash');

const speak = require('./voiceover');

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
  if (chatter.username && chatter.message) {
    speak(chatter);
  }

  ClientConnectionAPI.message(chatter);
});



const server = new NEStrisServer(3338, 'default');

server.on('frame', data => ClientConnectionAPI.frame(data));



// Listen for player change to force score update immediately

TetrisDAO.onScoreUpdate = function(data) {
  ClientConnectionAPI.player_data(data);
}
