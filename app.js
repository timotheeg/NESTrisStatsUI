'use strict'

const fs = require('fs');
const net = require('net');
const path = require('path');
const AutoLoad = require('fastify-autoload');
const config = require('./config');
const NEStrisServer = require('./NESTrisServer');
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


// set up view
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3339 });

const connections = new Set();

wss.on('connection', function connection(ws) {

  console.log('View connected');

  connections.add(ws);

  ws.on('error', () => {});
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


// =========================================================
// Set up Twitch Chat connector

const TwitchAuth = require('twitch-auth');
const StaticAuthProvider = TwitchAuth.StaticAuthProvider;
const RefreshableAuthProvider = TwitchAuth.RefreshableAuthProvider;
const ChatClient = require('twitch-chat-client').ChatClient;


function is_spam(msg) {
  if (/bigfollows\s*.\s*com/i.test(msg)) return true;

  return (
    /become famous/i.test(msg)
    &&
    /buy/i.test(msg)
  );
}

async function twitch() {
  if (!config.twitch.enabled) {
    return;
  }

  const auth = new RefreshableAuthProvider(
      new StaticAuthProvider(
        config.twitch.client.id,
        config.twitch.access.accessToken
      ),
      {
        clientSecret: config.twitch.client.secret,
        refreshToken: config.twitch.access.refreshToken,
        expiry: config.twitch.access.expiryTimestamp == null ? null : new Date(config.twitch.access.expiryTimestamp),
        onRefresh: ({ accessToken, refreshToken, expiryDate }) => {
              config.twitch.access = {
                  accessToken,
                  refreshToken,
                  expiryTimestamp: expiryDate === null ? null : expiryDate.getTime()
              };
              config.save()
          }
      }
  );

  console.log('TWITCH: connecting to ', config.twitch.channels);

  const chatClient = new ChatClient(auth, { channels: config.twitch.channels });

  chatClient.onMessage((channel, user, message) => {
    console.log('TWITCH', user, message);

    // comes from sample client, but I might as well leave it for fun :)
    if (message === '!ping') {
      chatClient.say(channel, 'Pong!');
    }
    else if (message === '!dice') {
      const diceRoll = Math.floor(Math.random() * 6) + 1;
      chatClient.say(channel, `@${user} rolled a ${diceRoll}`)
    }

    if (is_spam(message)) {
      // Bot.ban(user, 'spam'); // TODO: find API to do that
      return;
    }

    // compatibility format with previous version
    const chatter = {
      user:         user,
      username:     user,
      display_name: user,
      message:      message || ''
    }

    speak(chatter);

    ClientConnectionAPI.message(chatter);
  });

  chatClient.onSub((channel, user) => {
    ClientConnectionAPI.message({
      user:         'yobi9',
      username:     'yobi9',
      display_name: 'yobi9',
      message:      `Thanks to ${user} for subscribing to the channel!`
    });
  });

  chatClient.onResub((channel, user, subInfo) => {
    ClientConnectionAPI.message({
      user:         'yobi9',
      username:     'yobi9',
      display_name: 'yobi9',
      message:      `Thanks to ${user} for subscribing to the channel for a total of ${subInfo.months} months!`
    });
  });

  chatClient.onSubGift((channel, user, subInfo) => {
    ClientConnectionAPI.message({
      user:         'yobi9',
      username:     'yobi9',
      display_name: 'yobi9',
      message:      `Thanks to ${subInfo.gifter} for gifting a subscription to ${user}!`
    });
  });

  chatClient.onRaid((channel, user, raidInfo) => {
    ClientConnectionAPI.message({
      user:         'yobi9',
      username:     'yobi9',
      display_name: raidInfo.displayName,
      message:      `Woohoo! ${raidInfo.displayName} is raiding with a party of ${raidInfo.viewerCount}. Thanks for the raid ${raidInfo.displayName}!`
    });
  });

  await chatClient.connect();

  console.log('TWITCH: chatClient connected');
}

twitch();



// NEStrisOCR Server
const server = new NEStrisServer(3338, 'default');

server.on('frame', data => {
  // console.log(data);
  ClientConnectionAPI.frame(data);
});

// Web producer server
const web_producer_wss = new WebSocket.Server({ port: 3337 });

const noop = function() {};

web_producer_wss.on('connection', function connection(ws) {
  console.log('Web producer connected');

  const frame_log_fd = fs.openSync('./public/sample_frames/last_session.js', 'w');

  fs.writeSync(frame_log_fd, 'var frames = [\n');

  ws.on('error', () => {});
  ws.on('close', () => {
    fs.write(frame_log_fd, `];`, noop);
  });
  ws.on('message', message => {
    // console.log(message);
    // fs.write(frame_log_fd, `${message},\n`, noop);
    const data = JSON.parse(message);

    if (Array.isArray(data)) {
      ClientConnectionAPI[data[0]](...data.slice(1));
    }
    else {
      ClientConnectionAPI.frame(data);
    }
  });
});


// Listen for player change to force score update immediately

TetrisDAO.onScoreUpdate = function(data) {
  ClientConnectionAPI.player_data(data);
}
