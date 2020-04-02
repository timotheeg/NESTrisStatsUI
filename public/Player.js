class Player {
	constructor(name, dom) {
		this.name = name;
		this.dom = dom;

		this.reset();
	}

	reset() {
		this.preview = '';
		this.score = 0;
		this.lines = 0;
		this.level = 0;
		this.rtr = 0;
	}

	getScore() {
		return this.score;
	}

	setScoreDiff(difference) {
		dom.score_diff.textContent = difference;

		if (difference < 0) {
			dom.score_diff.classList.remove('winning');
			dom.score_diff.classList.add('losing');
		}
		else {
			dom.score_diff.classList.remove('losing');
			dom.score_diff.classList.add('winning');
		}
	}

	onFrame(data) {
		dom.score.textContent = data.score;
		dom.lines.textContent = data.lines;
		dom.level.textContent = data.level;

		this.score = parseInt(data.score, 10);
		this.lines = parseInt(data.lines, 10);
		this.level = parseInt(data.level, 10);

		this.renderField();

		if (data.preview != this.preview) {
			this.preview = data.preview;
			this.renderPreview()
		}
	}

	renderPreview() {

	}

	renderField() {

	}
}