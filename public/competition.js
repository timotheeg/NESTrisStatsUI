// very simple RPC system to allow server to send data to client

const players = [1, 2].map(num => new CompetitionPlayer(
	{
		score:   document.querySelector(`.score.p${num} .header`),
		diff:    document.querySelector(`.score.p${num} .content`),
		level:   document.querySelector(`.level.p${num} .content`),
		lines:   document.querySelector(`.lines.p${num} .content`),
		trt:     document.querySelector(`.tetris_rate.p${num} .content`),
		preview: document.querySelector(`.next_piece.p${num}`),
		field:   document.querySelector(`.board.p${num}`)
	},
	{
		field_pixel_size: 3,
		preview_pixel_size: 2
	}
));

class TetrisCompetitionAPI {
	constructor() {
		this.first_to = 3; // defaults to Best of 5

		this.resetVictories();
	}

	resetVictories() {
		this.victories = {1:0, 2:0};

		this._repaintVictories(1);
		this._repaintVictories(2);
	}

	setName(player_num, name) {
		document.querySelector(`.name.p${player_num} .header`).textContent = name || `Player ${player_num}`;
	}

	setFirstTo(num_games_to_win) {
		this.first_to = num_games_to_win;

		this._repaintVictories(1);
		this._repaintVictories(2);
	}

	setBestOf(num_games) {
		this.first_to = Math.ceil(num_games / 2);

		this._repaintVictories(1);
		this._repaintVictories(2);
	}

	setVictories(player_num, num_victories) {
		this.victories[player_num] = num_victories;

		this._repaintVictories(player_num);
	}

	winner(player_num) {
		this.victories[player_num]++;

		this._repaintVictories(player_num);
	}

	_repaintVictories(player_num) {
		const hearts = document.querySelector(`.name.p${player_num} .content`);

		// clear all the hearts
		while (hearts.childNodes.length) {
			hearts.removeChild(hearts.childNodes[0]);
		}

		const victories = this.victories[player_num]

		// reset to specified value
		for (let idx = 0; idx < this.first_to; idx++) {
			const heart = document.createElement('span');

			heart.innerHTML = '&#338;'; // represented as a heart in the font

			if (idx < victories) {
				heart.classList.add('win');
			}

			hearts.appendChild(heart);
		}
	}

	frame(player_num, data) {
		const
			index       = player_num - 1,
			player      = players[index],
			otherPlayer = players[(index+1) % 2],
			otherScore  = otherPlayer.getScore();

		player.setFrame(data);

		const score = player.getScore();

		if (isNaN(score) || isNaN(otherScore)) return;

		const diff  = score - otherScore;

		player.setDiff(diff);
		otherPlayer.setDiff(-diff);
	}
};


const API = new TetrisCompetitionAPI();

const socket = new WebSocket('ws://127.0.0.1:4003');

socket.addEventListener('message', (frame => {
	try{
		const [method, ...args] = JSON.parse(frame.data); // expect array of format [api_method_name, arg1, arg2, ...]

		API[method].apply(API, args);
	}
	catch(e) {
		console.error(e);
	}
}));

