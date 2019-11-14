const
	Promise   = require('bluebird'),
	fs        = require('fs'),
	{ spawn } = require('child_process'),
	TTS       = require('@google-cloud/text-to-speech'),
	ttsClient = new TTS.TextToSpeechClient(),
	config    = require('./config'),
	player    = require('play-sound')(opts = {}),
	_         = require('lodash');

const
	writeFileAsync = Promise.promisify(fs.writeFile),
	unlinkAsync    = Promise.promisify(fs.unlink)
	playAsync      = Promise.promisify(player.play, { context: player })
;


const
	VOICES = {
		osx: new Set([
			'Alex',
			'Fred',
			'Moira',
			'Samantha',
			'Tessa',
			'Veena',
			'Victoria',
			'Karen',
			'Daniel',
		]),
		google: new Set([
			'en-AU-Wavenet-A',
			'en-AU-Wavenet-B',
			'en-AU-Wavenet-C',
			'en-AU-Wavenet-D',
			'en-GB-Wavenet-A',
			'en-GB-Wavenet-B',
			'en-GB-Wavenet-C',
			'en-GB-Wavenet-D',
			'en-IN-Wavenet-A',
			'en-IN-Wavenet-B',
			'en-IN-Wavenet-C',
			'en-US-Wavenet-A',
			'en-US-Wavenet-B',
			'en-US-Wavenet-C',
			'en-US-Wavenet-D',
			'en-US-Wavenet-E',
			'en-US-Wavenet-F',
		]),
	},

	ordered_voices = {
		osx:    [],
		google: [],
	}

	say_queue  = [],

	voice_map   = new Map()
;

let
	voice_index   = -1,
	message_index = -1,
	saying        = false
;


// in line initialization - no bootsrapping, no Dependency injection
// set the ordered voices to place the mapped voices last
for (const [provider, maps] of Object.entries(config.chat_voice.twitch_mappings)) {
	for (const [username, voice] of Object.entries(maps)) {
		ordered_voices[provider].push(voice);
		VOICES[provider].delete(voice);
	}

	ordered_voices[provider].unshift(..._.shuffle([...VOICES[provider]]));
}

for (const [username, voice] of Object.entries(config.chat_voice.twitch_mappings[config.chat_voice.provider])) {
	voice_map.set(username, voice);
}


function getVoice(username) {
	if (!voice_map.has(username)) {
		const voices = ordered_voices[config.chat_voice.provider];

		voice_index = (voice_index + 1) % voices.length;
		voice_map.set(username, voices[voice_index]);
	}

	return voice_map.get(username);
}

function _sayNextMessageOSX(from_previous_message_complete) {
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
    setTimeout(_sayNextMessageOSX, 1500, true); // force 1.5s pause between messages
  });
}

function _sayNextMessageGoogle(from_previous_message_complete) {
	if (!from_previous_message_complete && saying) return;

	if (!say_queue.length) {
		saying = false;
		return;
	}

	if (!say_queue[0].isFulfilled()) return;

	// first message is ready to be said, let's go!
	saying = true;

	const promise = say_queue.shift();

	let path;

	promise
		.then(filename => {
			path = filename;
			return playAsync(filename);
		})
		.catch(console.error)
		.then(() => unlinkAsync(path))
		.catch(_.noop)
		.delay(1500)
		.then(() => _sayNextMessageGoogle(true));
}

function say_google(chatter) {
	const
		voice = getVoice(chatter.username),
		filename = `message.${++message_index}.opus`,

		request = {
			input: { text: chatter.message },
			voice: {
				languageCode: voice.split('-').slice(0, 2).join('-'),
				name: voice
			},
			audioConfig: {audioEncoding: 'OGG_OPUS'},
		},

		promise = new Promise((resolve, reject) => {
			ttsClient.synthesizeSpeech(request)
				.then(resolve, reject)
		})
			.then(([response]) => {
				return writeFileAsync(filename, response.audioContent, 'binary');
			})
			.then(() => filename)
			.catch(console.error)

	say_queue.push(promise);

	promise.then(() => _sayNextMessageGoogle());
}

function say_osx(chatter) {
  say_queue.push(chatter);
  _sayNextMessageOSX();
}


if (config.chat_voice && config.chat_voice.enabled) {
	module.exports = eval(`say_${config.chat_voice.provider}`);
}
else {
	module.exports = _.noop;
}

