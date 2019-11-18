const events = require('./sample_chat_events');
const speak = require('./voiceover');

function addWithDelay() {
	if (events.length) {
		speak(events.shift())
	}
}

setInterval(addWithDelay, 2500);