const dom = {
	bestof:  document.querySelector('#bestof'),
	p1_name:  document.querySelector('#bestof'),
	p1_name:  document.querySelector('#bestof'),
};

const state = {
	maxBestof: 11,
	bestof: 3,

	victories: {
		'1': 0,
		'2': 0
	},
};

const remoteAPI = {
	setBestOf: function() {},
	setWins: function(player_num, num_wins) {},
	setName: function(player_num, name) {
		console.log('setName', player_num, name);
	}
}

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
				setPlayerNumWins(player_num, idx);
			};

			if (idx && idx <= state.victories[player_num]) {
				span.classList.add('win');
			}

			victories.append(span);
		});
	});

	remoteAPI.setBestOf(n);
}

function setPlayerNumWins(player_num, num_wins) {
	console.log('setPlayerNumWins', player_num, num_wins);

	state.victories[player_num] = num_wins;
	setBestOf(state.bestof); // overkill but re-renders everything
}

function clearVictories() {
	console.log('clearVictories');

	for (let key in state.victories) {
		state.victories[key] = 0;
	}
	setBestOf(state.bestof);
}

function reset() {
	console.log('reset');

	clearVictories();

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
			state.victories[player_num] += 1;
			setBestOf(state.bestof);
		}
	});

	document.querySelector('#clear_victories').onclick = clearVictories;
	document.querySelector('#reset').onclick = reset;

	reset();
}

bootstrap();