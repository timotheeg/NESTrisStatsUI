const fs = require('fs');

class Config {
	constructor() {
		this.load();
	}

	load(json) {
		// sync bad ... don't care
		// let it throw and crash if config is not present or invalid
		const conf = fs.readFileSync('./config.json', 'UTF-8');

		Object.assign(this, JSON.parse(conf));
	}

	save() {
		// sync bad ... don't care
		fs.writeFileSync('./config.json', JSON.stringify(this, null, 4), 'UTF-8')
	}
}

module.exports = new Config();