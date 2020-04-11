const dom = {
	bestof:  document.querySelector('#bestof'),
	p1_name:  document.querySelector('#bestof'),
	p1_name:  document.querySelector('#bestof'),
};

let connected = false;

const ws = new WebSocket('ws://localhost:4000');

ws.addEventListener('open', function (event) {
    connected = true;
});

const state = {
	maxBestof: 13,
	bestof: 3,

	victories: {
		'1': 0,
		'2': 0
	},
};

function send(...args) {
	if (!connected) return;

	ws.send(JSON.stringify(args));
}

const remoteAPI = {
	setBestOf: function(n) {
		send('setBestOf', n);
	},
	setVictories: function(player_num, num_wins) {
		send('setVictories', player_num, num_wins);
	},
	setName: function(player_num, name) {
		send('setName', player_num, name);
	},
	resetVictories: function() {
		send('resetVictories');
	}
};

function setBestOfOptions(n, selected) {
	const select = dom.bestof;

	for (;  n >= 3; n-= 2) {
		const option = document.createElement('option');
		option.value = n;
		option.textContent = n;

		if (n === selected) {
			option.setAttribute('selected', 'selected')
		}

		select.prepend(option);
	}

	select.onchange = function() {
		const value = parseInt(this.value, 10);

		console.log('Selecting Best of', value);
		setBestOf(value);
	}
}

function setBestOf(n) {
	state.bestof = n;

	const heart = '&#338';
	const num_heart = Math.ceil(n / 2);

	[1, 2].forEach(player_num => {
		const victories = document.querySelector(`#victories .p${player_num}`);

		victories.innerHTML = '';

		const items = new Array(num_heart + 1).join('.').split('').map(_ => heart);

		items.unshift('-');

		items.forEach((val, idx) => {
			const span = document.createElement('span');

			span.innerHTML = val;

			span.onclick = function() {
				setVictories(player_num, idx);
			};

			if (idx && idx <= state.victories[player_num]) {
				span.classList.add('win');
			}

			victories.append(span);
		});
	});

	remoteAPI.setBestOf(n);
}

function setVictories(player_num, num_wins) {
	console.log('setVictories', player_num, num_wins);

	state.victories[player_num] = num_wins;
	setBestOf(state.bestof); // overkill but re-renders everything
	remoteAPI.setVictories(player_num, num_wins);
}

function resetVictories() {
	console.log('resetVictories');

	for (let key in state.victories) {
		state.victories[key] = 0;
	}

	setBestOf(state.bestof);

	remoteAPI.resetVictories();
}

function reset() {
	console.log('reset');

	resetVictories();

	[1, 2].forEach(player_num => {
		const input = document.querySelector(`#names .p${player_num} input`);

		input.value = '';
		input.onchange();
	});
}

function bootstrap() {
	setBestOfOptions(state.maxBestof, state.bestof);
	setBestOf(state.bestof);

	[1, 2].forEach(player_num => {
		const pName = document.querySelector(`#names .p${player_num} input`);

		pName.onchange
			= pName.onkeyup
			= pName.onkeydown
			= pName.onblur
			= function() {
				remoteAPI.setName(player_num, this.value.trim());
			};

		const winBtn = document.querySelector(`#wins .p${player_num} button`);

		winBtn.onclick = function() {
			setVictories(player_num, state.victories[player_num] + 1);
		};
	});

	document.querySelector('#clear_victories').onclick = resetVictories;
	document.querySelector('#reset').onclick = reset;

	reset();
}

bootstrap();