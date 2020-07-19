const
	Promise   = require('bluebird'),
	fs        = require('fs'),
	{ spawn } = require('child_process'),
	TTS       = require('@google-cloud/text-to-speech'),
	ttsClient = new TTS.TextToSpeechClient(),
	config    = require('./config'),
	player    = require('play-sound')(opts = {}),
	_         = require('lodash'),

	URL_RE = /\bhttps?:\/\/[^\s]+\b/g
;

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
			'en-IN-Wavenet-D',

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


function log(...args) {
	console.log('voice', ...args);
}

function getVoice(username) {
	let introduced = true;

	if (!voice_map.has(username)) {
		introduced = false;

		let voice = config.chat_voice.twitch_mappings[config.chat_voice.provider][username];

		if (!voice) {
			const voices = ordered_voices[config.chat_voice.provider];

			voice_index = (voice_index + 1) % voices.length;
			voice = voices[voice_index];
		}

		voice_map.set(username, voice);
	}

	return [introduced, voice_map.get(username)];
}

function _sayNextMessageOSX(from_previous_message_complete) {
  if (!from_previous_message_complete && saying) return;

  if (!say_queue.length) {
    saying = false;
    return;
  }

  saying = true;

  const chatter = say_queue.shift();
  const [_, voice] = getVoice(chatter.username);

  // Using spawn to have guaranteed arg safety (no command injection)
  // see: https://www.owasp.org/index.php/Command_Injection
  // doc: https://nodejs.org/api/child_process.html#child_process_asynchronous_process_creation
  const say = spawn('say', [
    '-v',
    voice,
    chatter.message
  ]);

  say.stderr.on('error', console.error);

  say.on('close', (code) => {
    console.log(`[${chatter.username}] said [${chatter.message}] with exit code [${code}]`);
    setTimeout(_sayNextMessageOSX, 1500, true); // force 1.5s pause between messages
  });
}

function _sayNextMessageGoogle() {
	log('_sayNextMessageGoogle', { saying });

	if (saying) return;

	if (!say_queue.length) {
		log('_sayNextMessageGoogle queue is empty');
		return;
	}

	log('_sayNextMessageGoogle', {
		fulfilled: say_queue[0].isFulfilled(),
		rejected: say_queue[0].isRejected(),
		pending: say_queue[0].isPending()
	});

	// say_queue[0] cannot be rejected because the promise chain is always caught
	if (!say_queue[0].isFulfilled()) return;

	// message is ready to be said, let's go!
	saying = true;

	const promise = say_queue.shift();

	let path;

	promise
		.then(filename => {
			log('_sayNextMessageGoogle', 'preparring to say', filename);

			path = filename;
			return playAsync(filename);
		})
		.catch(console.error)
		.then(() => unlinkAsync(path))
		.catch(console.error)
		.delay(1500)
		.then(() => { saying = false })
		.then(_sayNextMessageGoogle);
}

function say_google(chatter) {
	const
		[_, voice] = getVoice(chatter.username),
		filename = `message.${++message_index}.opus`,

		request = {
			input: { text: chatter.message },
			voice: {
				languageCode: voice.split('-').slice(0, 2).join('-'),
				name: voice
			},
			audioConfig: {audioEncoding: 'OGG_OPUS'},
		};

	log('synthesizeSpeech', filename, request);

	// Wrap with a bluebird Promise to have introspectionn later on
	const
		promise = new Promise((resolve, reject) => ttsClient.synthesizeSpeech(request).then(resolve, reject))
			.then(([response]) => {
				log('synthesizeSpeech response', filename);
				return writeFileAsync(filename, response.audioContent, 'binary');
			})
			.then(() => filename)
			.catch(console.error)

	say_queue.push(promise);

	promise.then(_sayNextMessageGoogle);
}

function say_osx(chatter) {
  say_queue.push(chatter);
  _sayNextMessageOSX();
}


module.exports = _.noop;

if (config.chat_voice && config.chat_voice.enabled) {
	const say = eval(`say_${config.chat_voice.provider}`);

	module.exports = function(chatter) {
		if (chatter.username == "classictetrisbot") return;

		const [introduced] = getVoice(chatter.username);

		if (!introduced) {
			say({ ...chatter, message: `${chatter.display_name} is now chatting with this voice.` });
		}

		say({ ...chatter, message: chatter.message.replace(URL_RE, 'a URL') });
	};
}
