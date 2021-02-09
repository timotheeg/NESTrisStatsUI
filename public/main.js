const dom = new DomRefs(document);

// initial setup for colors based con constants.js
for (const {name, color} of Object.values(LINES)) {
	[...document.querySelectorAll(`tr.${name} th`)].forEach(node => node.style.color = color);
}

if (dom.das) {
	for (const [rating, color] of Object.entries(DAS_COLORS)) {
		const das_label = document.querySelector(`#das .${rating} .label`);

		if (!das_label) continue;

		das_label.style.color = color;
	}

	for (const [type, color] of Object.entries(BOARD_COLORS)) {
		const label = document.querySelector(`#board_stats .${type}`);

		if (!label) continue;

		label.style.color = color;
	}
}

const API = {
	message:     onMessage,
	player_data: renderPastGamesAndPBs,
	frame:       onFrame,
};

const chat_and_pbs_conn = new Connection(3339);

chat_and_pbs_conn.onMessage = function(frame) {
	try{
		const [type, ...args] = frame;

		API[type](...args);
	}
	catch(e) {
		// socket.close();
		console.error(e);
	}
}

// get High Scores
getStats();


function onTetris() {
	let remaining_frames = 12;

	function steps() {
		dom.stream_bg.element.style.backgroundColor = (--remaining_frames % 2) ? 'white' : 'black';

		if (remaining_frames <= 0) {
			window.cancelAnimationFrame(tetris_animation_ID);
		}
		else {
			window.requestAnimationFrame(steps);
		}
	}

	const tetris_animation_ID = window.requestAnimationFrame(steps);

	// TODO play sound
}

const user_colors = {};

function getUserColor(username) {
	if (!(username in user_colors)) {
		user_colors[username] = `hsl(${~~(360 * Math.random())},${~~(80 + 20 * Math.random())}%,${~~(50 + 20 * Math.random())}%)`;
	}

	return user_colors[username];
}

function onMessage(entry) {
	const p = document.createElement('p');
	p.classList.add('message');

	const name = document.createElement('span');
	name.classList.add('name');
	name.textContent = entry.display_name;
	name.style.color = entry.color || getUserColor(entry.username);

	const divider = document.createElement('br');

	const msg = document.createElement('span');
	msg.classList.add('text');
	msg.textContent = entry.message;

	p.appendChild(name);
	p.appendChild(divider);
	p.appendChild(msg);

	dom.chat.element.appendChild(p);

	dom.chat.element.scrollTop = dom.chat.element.scrollHeight - dom.chat.element.clientHeight;
}

const LINE_CLEAR_IGNORE_FRAMES = 7;

let
	game = null,
	gameid = -1,
	last_valid_state = null,

	pending_delay_frames = 3,

	pending_game = true,
	pending_piece = -1,
	pending_line = -1,

	line_animation_remaining_frames = 0,
	pending_single = false,
	game_frames = [];

function onFrame(event, debug) {
	// game_frames.push({ ...event });

	// transformation
	const transformed = {
		gameid: event.gameid,
		diff: {
			cleared_lines: 0,
			score:         0,
			cur_piece_das: false,
			cur_piece:     false,
			next_piece:    false,
			stage_blocks:  0
		},

		score:         parseInt(event.score, 10),
		lines:         parseInt(event.lines, 10),
		level:         parseInt(event.level, 10),
		cur_piece_das: dom.das ? parseInt(event.cur_piece_das, 10) : -1,
		instant_das:   dom.das ? parseInt(event.instant_das, 10) : -1,
		cur_piece:     event.cur_piece,
		next_piece:    event.preview,
		stage: {
			num_blocks: event.field.replace(/0+/g, '').length,
			field:      event.field
		}
	};

	if (debug) {
		debugger;
	}

	if (pending_game) {
		if (game && game.id === transformed.gameid) {
			// this discards which are considered within a game
			// but don't actually show gameplay
			// i.e. rocket animation, score, menu
			return;
		}

		pending_game = false;

		game = new Game(transformed);
		gameid = game.id;

		clearStage();
		renderPiece(transformed);
		renderLine(transformed);

		last_valid_state = { ...transformed };

		line_animation_remaining_frames = 0;

		pending_piece = 1;
	}

	if (!game.over) {
		// game is ongoing, quick check on possible transitions

		// Is game over?
		if (transformed.stage.num_blocks === 200) {
			reportGame(game);
			pending_game = true;

			renderStage(transformed.level, transformed.stage.field);
			return;
		}

		// Has new game started before player waited for the fill animation?
		if (game.id != transformed.gameid) {
			reportGame(game);
			pending_game = true;
			return
		}
	}

	renderInstantDas(transformed.instant_das);

	// quick check for das loss
	if (transformed.cur_piece_das && transformed.instant_das === 0) {
		if (game.pieces.length) {
			game.onDasLoss();
			renderDas();
		}
	}

	// populate diff
	const diff = transformed.diff;

	diff.level         = transformed.level !== last_valid_state.level;
	diff.cleared_lines = transformed.lines - last_valid_state.lines;
	diff.score         = transformed.score - last_valid_state.score;
	diff.cur_piece_das = transformed.cur_piece_das !== last_valid_state.cur_piece_das;
	diff.cur_piece     = transformed.cur_piece !== last_valid_state.cur_piece;
	diff.next_piece    = transformed.next_piece !== last_valid_state.next_piece;
	diff.stage_blocks  = transformed.stage.num_blocks - last_valid_state.stage.num_blocks;

	// check if a change to cur_piece_stats
	if (--pending_piece === 0) {
		if (transformed.cur_piece && transformed.next_piece && !isNaN(transformed.cur_piece_das) && transformed.cur_piece_das <= 16) {
			game.onPiece(transformed);
			renderPiece(transformed);

			Object.assign(last_valid_state, {
				cur_piece: transformed.cur_piece,
				next_piece: transformed.next_piece,
				cur_piece_das: transformed.cur_piece_das
			});
		}
		else {
			pending_piece = 1; // check again next frame
		}
	}

	// check for score change
	if (--pending_line === 0) {
		if (
			transformed.score
			&& !isNaN(transformed.lines)
			&& !isNaN(transformed.level)
			&& diff.score >= 0
			&& diff.cleared_lines >= 0
		) {
			game.onLine(transformed);
			renderLine();

			Object.assign(last_valid_state, {
				score: transformed.score,
				lines: transformed.lines,
				level: transformed.level
			});
		}
		else {
			pending_line = 1; // check again next frame
		}
	}
	else if(pending_line < 0 && diff.score) {
		// always wait one frame to read score and line
		// this is to protect against transition blur causing incorrect OCR
		pending_line = pending_delay_frames;
	}

	if (!isNaN(transformed.level) && transformed.level != null) {
		renderStage(transformed.level, transformed.stage.field);
		renderNextPiece(transformed.level, transformed.next_piece);
	}

	if (last_valid_state.stage.field == transformed.stage.field) return;

	last_valid_state.stage.field = transformed.stage.field

	if (line_animation_remaining_frames-- > 0) return;

	if (diff.stage_blocks === 4) {
		last_valid_state.stage = transformed.stage;
		pending_piece = pending_delay_frames;
	}
	else {
		// assuming we aren't dropping any frame, the number of blocks only reduces when the
		// line animation starts, the diff is twice the number of lines being cleared.
		//
		// Note: diff.stage_blocks can be negative at weird amounts when the piece is rotated
		// while still being at the top of the field with some block moved out of view

		switch(diff.stage_blocks) {
			case -8:
				onTetris();
			case -6:
				// indicate animation for triples and tetris_rate
				line_animation_remaining_frames = LINE_CLEAR_IGNORE_FRAMES - 1;
				last_valid_state.stage.num_blocks += (diff.stage_blocks * 5); // equivalent to fast forward on how many blocks will have gone after the animation

				break;

			case -4:
				if (pending_single) {
					// verified single (second frame of clear animation)
					line_animation_remaining_frames = LINE_CLEAR_IGNORE_FRAMES - 2;
					last_valid_state.stage.num_blocks -= 10;
				}
				else
				{
					// genuine double
					line_animation_remaining_frames = LINE_CLEAR_IGNORE_FRAMES - 1;
					last_valid_state.stage.num_blocks -= 20;
				}

				pending_single = false;
				break;

			case -2:
				// -2 can happen on the first clear animation frame of a single
				// -2 can also happen when the piece is at the top of the field and gets rotated and is then partially off field
				// to differentiate the 2, we must wait for the next frame, if it goes to -4, then it is the clear animation continuing
				pending_single = true;
				break;

			default:
				pending_single = false;
		}
	}
}

function getStats() {
    fetch(
		'http://localhost:3000/get_stats',
		{ mode: 'no-cors' }
	)
	.then(response => response.json())
	.then(renderPastGamesAndPBs)
	.catch(console.error) // noop
}

function reportGame(game) {
	if (game.reported) return;

	game.over = true;
	game.reported = true;

    fetch(
		'http://localhost:3000/report_game',
		{
			method: 'POST', // *GET, POST, PUT, DELETE, etc.
			mode: 'no-cors', // no-cors, cors, *same-origin
			headers: new Headers({'content-type': 'application/json'}),
			body: JSON.stringify(game.data),
		}
	)
	.then(response => response.json())
	.then(renderPastGamesAndPBs)
	.catch(console.error) // noop
}

function clearStage() {
	dom.droughts.cur.ctx.clear();
	dom.droughts.last.ctx.clear();
	dom.droughts.max.ctx.clear();

	dom.pieces.element.classList.remove('l0', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9');
	dom.next.element.classList.remove('l0', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9');

	stage_currently_rendered = null;
	next_piece_currently_rendered = null;
}

function renderPastGamesAndPBs(data) {
	dom.pbs.name.textContent = data.current_player;
	dom.high_scores.name.textContent = data.current_player;

	// pbs
	data.pbs.forEach(record => {
		if (!record) return;

		const row = dom.pbs[`s${record.start_level}`];

		if (!row) return;

		row.end_level.textContent =   record.end_level.toString().padStart(2, '0');
		row.score.textContent =       record.score.toString().padStart(6, '0');
		row.lines.textContent =       record.lines.toString().padStart(3, '0');
		row.das_avg.textContent =     record.das_avg.toFixed(1).padStart(4, '0');
		row.tetris_rate.textContent = getPercent(record.tetris_rate);
	});

	// high scores
	['today', 'overall'].forEach(category => {
		if (data.high_scores[category].length <= 0) {
			data.high_scores[category].push(null);
		}

		dom.high_scores[category].innerHTML = data.high_scores[category].slice(0, 5).map(record => {
			if (!record || record.start_level == null) {
				record = {
					score: 0,
					tetris_rate: 0,
					start_level: 0
				};
			}

			return '<tr>' + [
				record.start_level.toString().padStart(2, '0'),
				record.score.toString().padStart(6, '0'),
				getPercent(record.tetris_rate)
			].map(content => `<td>${content}</td>`).join('') + '</tr>';

		}).join('');
	});
}

// return a [0-1] ratio as percentage over exacly 3 characters: 100 OR XX%
function getPercent(ratio) {
	const percent = Math.round(ratio * 100);

	return percent >= 100 ? '100' : (percent).toString().padStart(2, '0') + '%';
}

function renderLine() {
	// massive population of all data shown on screen

	// do the small boxes first
	dom.tetris_rate.value.textContent = getPercent(game.data.lines[4].percent);
	dom.efficiency.value.textContent = (Math.floor(game.data.score.normalized / game.data.lines.count) || 0).toString().padStart(3, '0');
	dom.level.value.textContent = game.data.level.toString().padStart(2, '0');
	dom.burn.count.textContent = game.data.burn.toString().padStart(2, '0');

	const line_count = game.data.lines.count.toString().padStart(3, '0');

	if (dom.lines) {
		dom.lines.count.textContent = line_count
	}

	dom.score.current.textContent = game.data.score.current.toString().padStart(6, '0');

	if (game.data.score.transition) {
		dom.score.transition.textContent = game.data.score.transition.toString().padStart(6, '0');
	}
	else {
		dom.score.transition.textContent = '------';
	}

	// lines and points
	dom.lines_stats.count.textContent = line_count;
	dom.points.count.textContent = game.data.score.current.toString().padStart(6, '0');

	for (const [num_lines, values] of Object.entries(LINES)) {
		const { name } = values;

		dom.lines_stats[name].count.textContent = game.data.lines[num_lines].count.toString().padStart(3, '0');
		dom.lines_stats[name].lines.textContent = game.data.lines[num_lines].lines.toString().padStart(3, '0');
		dom.lines_stats[name].percent.textContent = getPercent(game.data.lines[num_lines].percent)

		dom.points[name].count.textContent = game.data.points[num_lines].count.toString().padStart(6, '0');
		dom.points[name].percent.textContent = getPercent(game.data.points[num_lines].percent);
	}

	dom.points.drops.count.textContent = game.data.points.drops.count.toString().padStart(6, '0');
	dom.points.drops.percent.textContent = getPercent(game.data.points.drops.percent);

	dom.lines_stats.trt_ctx.clear();

	const
		trt_ctx = dom.lines_stats.trt_ctx,
		pixel_size = 4,
		max_pixels = Math.floor(trt_ctx.canvas.width / (pixel_size + 1)),
		y_scale = (trt_ctx.canvas.height - pixel_size) / pixel_size,
		cur_x = 0,
		to_draw = game.line_events.slice(-1 * max_pixels);

	for (let idx = to_draw.length; idx--;) {
		const { num_lines, tetris_rate } = to_draw[idx];

		trt_ctx.fillStyle = LINES[num_lines].color;
		trt_ctx.fillRect(
			idx * (pixel_size + 1),
			Math.round((1 - tetris_rate) * y_scale * pixel_size),
			pixel_size,
			pixel_size
		);
	}

	// set piece colors for piece distribution
	dom.pieces.element.classList.remove(`l${(game.data.level - 1) % 10}`)
	dom.pieces.element.classList.add(`l${game.data.level % 10}`)

	dom.next.element.classList.remove(`l${(game.data.level - 1) % 10}`)
	dom.next.element.classList.add(`l${game.data.level % 10}`)
}

function renderPiece(event) {
	dom.pieces.count.textContent = game.data.pieces.count.toString().padStart(3, '0');

	dom.pieces.deviation.textContent = (game.data.pieces.deviation * 100).toFixed(1);
	dom.pieces.deviation_28.textContent = (game.data.pieces.deviation_28 * 100).toFixed(1);
	dom.pieces.deviation_56.textContent = (game.data.pieces.deviation_56 * 100).toFixed(1);

	let
		pixel_size = 4,
		max_pixels = Math.floor(dom.pieces.T.ctx.canvas.width / (pixel_size + 1)),
		draw_start = Math.max(0, game.pieces.length - max_pixels);

	PIECES.forEach(name => {
		const
			piece_data    = game.data.pieces[name],
			ctx           = dom.pieces[name].ctx,
			indexes       = piece_data.indexes,
			drought_color = name == 'I' ? 'orange' : '#747474';

		dom.pieces[name].count.textContent   = piece_data.count.toString().padStart(3, '0');
		dom.pieces[name].drought.textContent = piece_data.drought.toString().padStart(2, '0');
		dom.pieces[name].percent.textContent = getPercent(piece_data.percent);

		ctx.resetTransform();
		ctx.clear();
		ctx.transform(1, 0, 0, 1, - draw_start * (pixel_size + 1), 0);

		for (let idx = 0; idx < indexes.length; idx++) {
			const
				piece_idx = indexes[idx].index,
				das       = indexes[idx].das,
				color     = DAS_COLORS[ DAS_THRESHOLDS[das] ];

				ctx.fillStyle = color;
				ctx.fillRect(
					piece_idx * (pixel_size + 1),
					0,
					pixel_size,
					pixel_size
				);

				const last_piece_idx = idx > 0 ? indexes[idx - 1].index : -1;

				if (piece_idx - last_piece_idx - 1 < DROUGHT_PANIC_THRESHOLD) {
					continue;
				}

				ctx.fillStyle = drought_color;
				ctx.fillRect(
					(last_piece_idx + 1) * (pixel_size + 1),
					0,
					(piece_idx - last_piece_idx - 1) * (pixel_size + 1) - 1,
					pixel_size
				);
		};

		// handle current drought if necessary
		if (piece_data.drought >= DROUGHT_PANIC_THRESHOLD) {
			// TODO: animate drought bar from 0 to DROUGHT_PANIC_THRESHOLD
			let start_x = 0;

			if (indexes.length) {
				start_x = (indexes[indexes.length - 1].index + 1) * (pixel_size + 1);
			}

			ctx.fillStyle = drought_color;
			ctx.fillRect(
				start_x,
				0,
				piece_data.drought * (pixel_size + 1) - 1,
				pixel_size
			);
		}
	});

	// droughts
	// TODO: Use Canvas rather than span
	dom.droughts.count.textContent = game.data.i_droughts.count.toString().padStart(3, '0');
	dom.droughts.cur.value.textContent = game.data.i_droughts.cur.toString().padStart(2, '0');
	dom.droughts.last.value.textContent = game.data.i_droughts.last.toString().padStart(2, '0');
	dom.droughts.max.value.textContent = game.data.i_droughts.max.toString().padStart(2, '0');

	pixel_size = 2;
	max_pixels = Math.floor(dom.droughts.cur.ctx.canvas.width / (pixel_size + 1));
	color     = 'orange';

	const
		cur_drought  = game.data.i_droughts.cur,
		cur_ctx      = dom.droughts.cur.ctx,

		last_drought = game.data.i_droughts.last,
		last_ctx     = dom.droughts.last.ctx,

		max_drought  = game.data.i_droughts.max,
		max_ctx      = dom.droughts.max.ctx;

	if (cur_drought > 0) {
		if (cur_drought <= max_pixels) {
			cur_ctx.fillStyle = color;
			cur_ctx.fillRect(
				(cur_drought - 1) * (pixel_size + 1),
				0,
				pixel_size,
				cur_ctx.canvas.height
			);
		}

		if (max_drought === cur_drought) {
			// draw the same block current has
			max_ctx.fillStyle = color;
			max_ctx.fillRect(
				(max_drought - 1) * (pixel_size + 1),
				0,
				pixel_size,
				max_ctx.canvas.height
			);
		}
	}
	else {
		// clear current but not max (only a new game would clear max)
		cur_ctx.clear();
	}

	// we clear and redraw the last gauge,
	// could be optimize by storing previous value and redraw on change,
	// but this will do for now
	last_ctx.clear();
	last_ctx.fillStyle = color;
	for (idx = Math.min(last_drought, max_pixels); idx-- > 0; ) {
		last_ctx.fillRect(
			idx * (pixel_size + 1),
			0,
			pixel_size,
			last_ctx.canvas.height
		);
	}

	if (game.data.i_droughts.cur >= DROUGHT_PANIC_THRESHOLD) {
		if (game.data.i_droughts.max == game.data.i_droughts.cur) {
			dom.droughts.element.classList.remove('panic');
			dom.droughts.element.classList.add('max_panic'); // doing this to synchronize animation
		}
		else {
			dom.droughts.element.classList.remove('max_panic');
			dom.droughts.element.classList.add('panic');
		}
	}
	else {
		dom.droughts.element.classList.remove('max_panic');
		dom.droughts.element.classList.remove('panic');
	}

	// das
	if (dom.das) {
		renderDas()
	}

	renderNextPiece(event.level, event.next_piece);
}

function renderInstantDas(das) {
	if (!dom.das) return;
	if (isNaN(das) || das < 0) return;

	dom.das.instant.textContent = das.toString().padStart(2, '0');

	const
		ctx = dom.das.gauge_ctx,
		pixel_size = 3,
		height = dom.das.gauge_ctx.canvas.height;

	// TODO: optimize!
	ctx.clear();

	ctx.fillStyle = 'orange';

	for (let idx = das; idx--; ) {
		ctx.fillRect(
			idx * (pixel_size + 1),
			0,
			pixel_size,
			height
		);
	}
}

function renderDas() {
	dom.das.avg.textContent = game.data.das.avg.toFixed(1).padStart(4, '0');
	dom.das.great.textContent = game.data.das.great.toString().padStart(3, '0');
	dom.das.ok.textContent = game.data.das.ok.toString().padStart(3, '0');
	dom.das.bad.textContent = game.data.das.bad.toString().padStart(3, '0');

	// assume same width for das and board stats
	dom.das.ctx.clear();
	dom.board_stats.ctx.clear();

	pixel_size = 4;
	max_pixels = Math.floor(dom.das.ctx.canvas.width / (pixel_size + 1));
	cur_x = 0;
	to_draw = game.pieces.slice(-1 * max_pixels);

	dom.board_stats.ctx.fillStyle = BOARD_COLORS.floor;
	dom.board_stats.ctx.fillRect(
		0,
		60,
		dom.board_stats.ctx.canvas.width,
		1
	);

	for (let idx = 0; idx < to_draw.length; idx++) {
		const
			piece = to_draw[idx]
			das = piece.das,
			color = DAS_COLORS[ DAS_THRESHOLDS[das] ];

		if (piece.das_loss) {
			dom.das.ctx.fillStyle = '#550000';
			dom.das.ctx.fillRect(
				idx * (pixel_size + 1),
				0,
				pixel_size,
				pixel_size * 17
			);
		}

		dom.das.ctx.fillStyle = color;
		dom.das.ctx.fillRect(
			idx * (pixel_size + 1),
			(16 - das) * (pixel_size - 1),
			pixel_size,
			pixel_size
		);

		const board_stats = piece.board;

		if (piece.lines && piece.lines.num_lines) {
			dom.board_stats.ctx.fillStyle = LINES[piece.lines.num_lines].color;

			dom.board_stats.ctx.fillRect(
				idx * (pixel_size + 1) + (pixel_size),
				0,
				1,
				60
			);
		}

		dom.board_stats.ctx.fillStyle = BOARD_COLORS.height;

		for (let yidx = 20; yidx-- > board_stats.top_idx; ) {
			dom.board_stats.ctx.fillRect(
				idx * (pixel_size + 1),
				yidx * (pixel_size - 1),
				pixel_size,
				2
			);
		}

		if (board_stats.tetris_ready) {
			dom.board_stats.ctx.fillStyle = BOARD_COLORS.tetris_ready;
			dom.board_stats.ctx.fillRect(
				idx * (pixel_size + 1) - 1,
				62,
				pixel_size + 1,
				pixel_size
			);
		}

		if (board_stats.clean_slope) {
			dom.board_stats.ctx.fillStyle = BOARD_COLORS.clean_slope;
			dom.board_stats.ctx.fillRect(
				idx * (pixel_size + 1) - 1,
				67,
				pixel_size + 1,
				pixel_size
			);
		}

		if (board_stats.double_well) {
			dom.board_stats.ctx.fillStyle = BOARD_COLORS.double_well;
			dom.board_stats.ctx.fillRect(
				idx * (pixel_size + 1) - 1,
				72,
				pixel_size + 1,
				pixel_size
			);
		}

		if (piece.in_drought) {
			dom.board_stats.ctx.fillStyle = BOARD_COLORS.drought;
			dom.board_stats.ctx.fillRect(
				idx * (pixel_size + 1) - 1,
				77,
				pixel_size + 1,
				pixel_size
			);
		}
	}
}

function renderBlock(level, block_index, ctx, pos_x, pos_y) {
	let color;

	switch (block_index) {
		case 1:
			// inefficient because it draws the area twice
			// check speed and optimize if necessary
			color = LEVEL_COLORS[level % 10][0];

			ctx.fillStyle = color;
			ctx.fillRect(
				pos_x,
				pos_y,
				BLOCK_PIXEL_SIZE * 7,
				BLOCK_PIXEL_SIZE * 7
			);

			ctx.fillStyle = 'white';
			ctx.fillRect(
				pos_x,
				pos_y,
				BLOCK_PIXEL_SIZE,
				BLOCK_PIXEL_SIZE
			);

			ctx.fillRect(
				pos_x + BLOCK_PIXEL_SIZE,
				pos_y + BLOCK_PIXEL_SIZE,
				BLOCK_PIXEL_SIZE * 5,
				BLOCK_PIXEL_SIZE * 5
			);

			break;

		case 2:
		case 3:
			color = LEVEL_COLORS[level % 10][block_index - 2];

			ctx.fillStyle = color;
			ctx.fillRect(
				pos_x,
				pos_y,
				BLOCK_PIXEL_SIZE * 7,
				BLOCK_PIXEL_SIZE * 7
			);

			ctx.fillStyle = 'white';
			ctx.fillRect(
				pos_x,
				pos_y,
				BLOCK_PIXEL_SIZE,
				BLOCK_PIXEL_SIZE
			);
			ctx.fillRect(
				pos_x + BLOCK_PIXEL_SIZE,
				pos_y + BLOCK_PIXEL_SIZE,
				BLOCK_PIXEL_SIZE * 2,
				BLOCK_PIXEL_SIZE
			);
			ctx.fillRect(
				pos_x + BLOCK_PIXEL_SIZE,
				pos_y + BLOCK_PIXEL_SIZE * 2,
				BLOCK_PIXEL_SIZE,
				BLOCK_PIXEL_SIZE
			);

			break;

		default:
			/*
			ctx.clearRect(
				pos_x,
				pos_y,
				BLOCK_PIXEL_SIZE * 7,
				BLOCK_PIXEL_SIZE * 7
			);
			/**/
	}
}

let stage_currently_rendered = null;

function renderStage(level, stage_string) {
	const
		stage_id = `${level}${stage_string}`;

	if (stage_id === stage_currently_rendered) return;

	stage_currently_rendered = stage_id;

	const
		ctx = dom.stage.ctx,
		pixels_per_block = BLOCK_PIXEL_SIZE * (7 + 1);

	ctx.clear();

	for (let x = 0; x < 10; x++) {
		for (let y = 0; y < 20; y++) {
			renderBlock(
				level,
				parseInt(stage_string[y * 10 + x], 10),
				ctx,
				x * pixels_per_block,
				y * pixels_per_block
			);
		}
	}
}

let next_piece_currently_rendered = null;

function renderNextPiece(level, next_piece) {
	if (
		level === null
		|| isNaN(level)
		|| !next_piece
	) {
		return;
	}

	const
		piece_id = `${level}${next_piece}`;

	if (piece_id === next_piece_currently_rendered) return;

	next_piece_currently_rendered = piece_id;

	const
		ctx              = dom.next.ctx,
		col_index        = PIECE_COLORS[next_piece],
		pixels_per_block = BLOCK_PIXEL_SIZE * (7 + 1);
		x_offset_3       = Math.floor((ctx.canvas.width - pixels_per_block * 3 + BLOCK_PIXEL_SIZE) / 2),
		positions        = [];

	ctx.clear();

	let
		pos_x = 0,
		pos_y = 0,
		x_idx = 0;

	switch(next_piece) {
		case 'I':
			pos_y = Math.floor((ctx.canvas.height - BLOCK_PIXEL_SIZE * 7) / 2);

			positions.push([x_idx++ * pixels_per_block, pos_y]);
			positions.push([x_idx++ * pixels_per_block, pos_y]);
			positions.push([x_idx++ * pixels_per_block, pos_y]);
			positions.push([x_idx++ * pixels_per_block, pos_y]);
			break;

		case 'O':
			pos_x = Math.floor((ctx.canvas.width - pixels_per_block * 2 + BLOCK_PIXEL_SIZE) / 2);

			positions.push([pos_x, pos_y]);
			positions.push([pos_x, pos_y + pixels_per_block]);
			positions.push([pos_x + pixels_per_block, pos_y]);
			positions.push([pos_x + pixels_per_block, pos_y + pixels_per_block]);
			break;

		case 'T':
		case 'J':
		case 'L':
			// top line is the same for both pieces
			positions.push([x_offset_3 + x_idx++ * pixels_per_block, pos_y]);
			positions.push([x_offset_3 + x_idx++ * pixels_per_block, pos_y]);
			positions.push([x_offset_3 + x_idx++ * pixels_per_block, pos_y]);

			if (next_piece == 'L') {
				x_idx = 0;
			}
			else if (next_piece == 'T') {
				x_idx = 1;
			}
			else {
				x_idx = 2;
			}

			positions.push([x_offset_3 + x_idx * pixels_per_block, pos_y + pixels_per_block]);
			break;

		case 'Z':
		case 'S':
			positions.push([x_offset_3 + pixels_per_block, pos_y]);
			positions.push([x_offset_3 + pixels_per_block, pos_y + pixels_per_block]);

			if (next_piece == 'Z') {
				positions.push([x_offset_3, pos_y]);
				positions.push([x_offset_3 + pixels_per_block * 2, pos_y + pixels_per_block]);
			}
			else {
				positions.push([x_offset_3, pos_y + pixels_per_block]);
				positions.push([x_offset_3 + pixels_per_block * 2, pos_y]);
			}
	}

	positions.forEach(([pos_x, pos_y]) => {
		renderBlock(level, col_index, ctx, pos_x, pos_y);
	});
}
