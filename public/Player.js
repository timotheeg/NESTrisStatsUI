const EFF_LINE_VALUES = [0, 40, 50, 100, 300];

function renderBlock(level, block_index, pixel_size, ctx, pos_x, pos_y) {
	let color;

	if (block_index < 1 || block_index > 3) {
		return;
	}

	switch (block_index) {
		case 1:
			// inefficient because it draws the area twice
			// check speed and optimize if necessary
			color = LEVEL_COLORS[level % 10][0];

			ctx.fillStyle = color;
			ctx.fillRect(
				pos_x,
				pos_y,
				pixel_size * 7,
				pixel_size * 7
			);

			ctx.fillStyle = 'white';
			ctx.fillRect(
				pos_x,
				pos_y,
				pixel_size,
				pixel_size
			);

			ctx.fillRect(
				pos_x + pixel_size,
				pos_y + pixel_size,
				pixel_size * 5,
				pixel_size * 5
			);

			break;

		case 2:
		case 3:
			color = LEVEL_COLORS[level % 10][block_index - 2];

			ctx.fillStyle = color;
			ctx.fillRect(
				pos_x,
				pos_y,
				pixel_size * 7,
				pixel_size * 7
			);

			ctx.fillStyle = 'white';
			ctx.fillRect(
				pos_x,
				pos_y,
				pixel_size,
				pixel_size
			);
			ctx.fillRect(
				pos_x + pixel_size,
				pos_y + pixel_size,
				pixel_size * 2,
				pixel_size
			);
			ctx.fillRect(
				pos_x + pixel_size,
				pos_y + pixel_size * 2,
				pixel_size,
				pixel_size
			);

			break;
	}

	/**/
	ctx.fillStyle = 'black';
	ctx.fillRect(
		pos_x,
		pos_y + pixel_size * 7,
		pixel_size * 7,
		pixel_size
	);
	ctx.fillRect(
		pos_x + pixel_size * 7,
		pos_y,
		pixel_size,
		pixel_size * 8
	);
	/**/
}


/*
	dom: {
		score:   text element
		level:   text element
		lines:   text element
		trt:     text element
		preview: div for canva
		field:   div for canva
	}

	options: {
		preview_pixel_size: int
		field_pixel_size: int
	}
*/

class Player {
	constructor(dom, options) {
		this.dom = dom;
		this.options = options;

		this.field_pixel_size = this.options.field_pixel_size || this.options.pixel_size;
		this.preview_pixel_size = this.options.preview_pixel_size || this.options.pixel_size;
		this.render_running_trt_rtl = !!this.options.running_trt_rtl;

		this.clear_events = [];

		this.numberFormatter = new Intl.NumberFormat();

		const styles = getComputedStyle(dom.field);

		// Avatar Block
		this.avatar = document.createElement('div');
		this.avatar.classList.add('avatar');
		Object.assign(this.avatar.style, {
			position:           'absolute',
			top:                `${this.field_pixel_size * 8 * 2}px`,
			left:               `${css_size(styles.padding) - this.field_pixel_size}px`,
			width:              `${css_size(styles.width) + this.field_pixel_size * 2}px`,
			height:             `${css_size(styles.width) + this.field_pixel_size * 2}px`,
			backgroundRepeat:   'no-repeat',
			backgroundSize:     'cover',
			backgroundPosition: '50% 50%',
			filter:              'brightness(0.20)'
		});
		dom.field.appendChild(this.avatar);

		// Field Flash
		this.field_bg = document.createElement('div');
		this.field_bg.classList.add('background');
		Object.assign(this.field_bg.style, {
			position: 'absolute',
			top:      `${css_size(styles.padding) - this.field_pixel_size}px`,
			left:     `${css_size(styles.padding) - this.field_pixel_size}px`,
			width:    `${css_size(styles.width) + this.field_pixel_size * 2}px`,
			height:   `${css_size(styles.height) + this.field_pixel_size * 2}px`
		});
		dom.field.appendChild(this.field_bg);

		// set up field and preview canvas
		['field', 'preview', 'running_trt']
			.forEach(name => {
				console.log(name);

				const styles = getComputedStyle(dom[name]);
				const canvas = document.createElement('canvas');

				canvas.style.position = 'absolute';
				canvas.style.top = styles.padding;
				canvas.style.left = styles.padding;

				canvas.setAttribute('width', styles.width);
				canvas.setAttribute('height', styles.height);

				dom[name].appendChild(canvas);

				this[`${name}_ctx`] = canvas.getContext('2d');
			});


		this.field_ctx.canvas.style.top = `${this.field_pixel_size}px`;
		this.field_ctx.canvas.style.left = `${this.field_pixel_size}px`;
		this.field_bg.appendChild(this.field_ctx.canvas);

		if (this.render_running_trt_rtl) {
			this.running_trt_ctx.canvas.style.transform = 'scale(-1, 1)';
		}

		// buils audio objects
		this.sounds = {
			tetris: new Audio('./Tetris_Clear.mp3')
		};

		this.reset();
	}

	onPiece() {

	}

	onTetris() {
		let remaining_frames = 12;

		const steps = () => {
			const bg_color = (--remaining_frames % 2) ? 'white' : 'rgba(0,0,0,0)';

			this.field_bg.style.background = bg_color;

			if (remaining_frames > 0) {
				this.tetris_animation_ID = window.requestAnimationFrame(steps);
			}
		}

		this.tetris_animation_ID = window.requestAnimationFrame(steps);
		this.sounds.tetris.play();
	}

	clearTetrisAnimation() {
		window.cancelAnimationFrame(this.tetris_animation_ID);
	}

	reset() {
		this.clear_events.length = 0;
		this.preview = '';
		this.score = 0;
		this.lines = 0;
		this.level = 0;
		this.field_num_blocks = 0;
		this.field_string = '';

		this.lines_trt = 0;
		this.total_eff = 0;

		this.preview_ctx.clear();
		this.field_ctx.clear();
		this.running_trt_ctx.clear();

		this.clearTetrisAnimation();
		this.field_bg.style.background = 'rbga(0,0,0,0)';
	}

	getScore() {
		return this.score;
	}

	setDiff() {
		// noop
	}

	getScoreFromScoreString(score_str) {
		const lead = parseInt(score_str.charAt(0), 16);
		const tail = parseInt(score_str.slice(1), 10);

		return (lead * 100000) + tail;
	}

	setAvatar(url) {
		this.avatar.style.backgroundImage = `url('${url}')`;
	}

	setName(name) {
		this.dom.name.textContent = name;
	}

	setFrame(data) {
		['lines', 'level'].forEach(field => {
			if (data[field]) {
				this.dom[field].textContent = data[field];
			}
		});

		if (data.score) {
			this.score = this.getScoreFromScoreString(data.score);
			this.dom.score.textContent = this.numberFormatter.format(this.score);
		}

		const level = parseInt(data.level, 10);
		const num_blocks = data.field.replace(/0+/g, '').length;

		const lines = parseInt(data.lines, 10);

		if (lines === 0 && (num_blocks === 0 || num_blocks == 4)) {
			// New game
			this.lines = 0;
			this.lines_trt = 0;
			this.total_eff = 0;
			this.dom.trt.textContent = '---';
			this.dom.eff.textContent = '---';
			this.clear_events.length = 0;
			this.running_trt_ctx.clear();
			this.field_num_blocks = num_blocks;
			this.field_string = data.field;
			this.clear_animation_remaining_frames = -1;
		}

		if (!isNaN(level)) {
			this.level = level;

			this.renderField(this.level, data.field);
			this.renderPreview(this.level, data.preview);
			this.updateField(data.field, num_blocks);
		}

		if (isNaN(lines)
			|| lines === 0
			|| lines === this.lines
			|| this.clear_animation_remaining_frames >= 0
		) return;

		const cleared = lines - this.lines;

		if (cleared === 4) {
			this.lines_trt += 4;
		}

		const line_value = cleared <=4 ? EFF_LINE_VALUES[cleared] : EFF_LINE_VALUES[1];


		this.total_eff += line_value * cleared;

		const trt = this.lines_trt / lines;
		const eff = this.total_eff / lines;

		this.clear_events.push({ trt, eff, cleared });
		this.dom.trt.textContent = getPercent(trt);
		this.dom.eff.textContent = Math.round(eff).toString().padStart(3, '0');
		this.renderRunningTRT();
		this.lines = lines;
	}

	renderPreview(level, preview) {
		const piece_id = `${level}${preview}`;

		if (piece_id === this.current_preview) return;

		this.current_preview = piece_id;

		const
			ctx              = this.preview_ctx,
			col_index        = PIECE_COLORS[preview],
			pixels_per_block = this.preview_pixel_size * (7 + 1),
			x_offset_3       = Math.ceil((ctx.canvas.width - pixels_per_block * 3) / 2),
			positions        = [];

		ctx.clear();

		let
			pos_x = 0,
			pos_y = Math.ceil((ctx.canvas.height - pixels_per_block * 2) / 2),
			x_idx = 0;

		switch(preview) {
			case 'I':
				pos_x = Math.ceil((ctx.canvas.width - pixels_per_block * 4) / 2);
				pos_y = Math.ceil((ctx.canvas.height - pixels_per_block) / 2);

				positions.push([pos_x + pixels_per_block * 0, pos_y]);
				positions.push([pos_x + pixels_per_block * 1, pos_y]);
				positions.push([pos_x + pixels_per_block * 2, pos_y]);
				positions.push([pos_x + pixels_per_block * 3, pos_y]);
				break;

			case 'O':
				pos_x = Math.ceil((ctx.canvas.width - pixels_per_block * 2 + this.preview_pixel_size) / 2);

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

				if (preview == 'L') {
					x_idx = 0;
				}
				else if (preview == 'T') {
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

				if (preview == 'Z') {
					positions.push([x_offset_3, pos_y]);
					positions.push([x_offset_3 + pixels_per_block * 2, pos_y + pixels_per_block]);
				}
				else {
					positions.push([x_offset_3, pos_y + pixels_per_block]);
					positions.push([x_offset_3 + pixels_per_block * 2, pos_y]);
				}
		}

		positions.forEach(([pos_x, pos_y]) => {
			renderBlock(
				level,
				col_index,
				this.preview_pixel_size,
				ctx,
				pos_x,
				pos_y
			);
		});
	}

	updateField(field_string, num_blocks) {
		if (field_string == this.field_string) return;

		// state is considered valid, track data
		this.field_string = field_string;

		if (this.clear_animation_remaining_frames-- > 0) return;

		const block_diff = num_blocks - this.field_num_blocks;

		if (block_diff === 4) {
			this.field_num_blocks = num_blocks;
			this.onPiece(); // read piece data on next frame if needed
			return;
		}

		const CLEAR_ANIMATION_NUM_FRAMES = 7;

		// assuming we aren't dropping any frame, the number of blocks only reduces when the
		// line animation starts, the diff is twice the number of lines being cleared.
		//
		// Note: diff.stage_blocks can be negative at weird amounts when the piece is rotated
		// while still being at the top of the field with some block moved out of view

		switch(block_diff) {
			case -8:
				this.onTetris();
			case -6:
				// indicate animation for triples and tetris
				this.clear_animation_remaining_frames = CLEAR_ANIMATION_NUM_FRAMES - 1;
				this.field_num_blocks += (block_diff * 5); // equivalent to fast forward on how many blocks will have gone after the animation

				break;

			case -4:
				if (this.pending_single) {
					// verified single (second frame of clear animation)
					this.clear_animation_remaining_frames = CLEAR_ANIMATION_NUM_FRAMES - 2;
					this.field_num_blocks -= 10;
				}
				else
				{
					// genuine double
					this.clear_animation_remaining_frames = CLEAR_ANIMATION_NUM_FRAMES - 1;
					this.field_num_blocks -= 20;
				}

				this.pending_single = false;
				break;

			case -2:
				// -2 can happen on the first clear animation frame of a single
				// -2 can also happen when the piece is at the top of the field and gets rotated and is then partially off field
				// to differentiate the 2, we must wait for the next frame, if it goes to -4, then it is the clear animation continuing
				this.pending_single = true;
				break;

			default:
				this.pending_single = false;
		}
	}

	renderField(level, field_string) {
		const stage_id = `${level}${field_string}`;

		if (stage_id === this.current_field) return;

		this.current_field = stage_id;

		const pixels_per_block = this.field_pixel_size * (7 + 1);

		this.field_ctx.clear();

		for (let x = 0; x < 10; x++) {
			for (let y = 0; y < 20; y++) {
				renderBlock(
					level,
					parseInt(field_string[y * 10 + x], 10),
					this.field_pixel_size,
					this.field_ctx,
					x * pixels_per_block,
					y * pixels_per_block
				);
			}
		}
	}

	renderRunningTRT() {
		const
			ctx = this.running_trt_ctx,
			rtl = this.render_running_trt_rtl,
			current_trt = this.clear_events[this.clear_events.length - 1].trt,
			pixel_size_line_clear = 4,
			pixel_size_baseline = 2;

		let pixel_size, max_pixels, y_scale;

		ctx.clear();

		// show the current tetris rate baseline
		// always vertically centered on the line clear event dot
		pixel_size = pixel_size_baseline;
		max_pixels = Math.floor(ctx.canvas.width / (pixel_size + 1));
		y_scale = (ctx.canvas.height - pixel_size_line_clear) / pixel_size;

		const pos_y = Math.round(
			((1 - current_trt) * y_scale * pixel_size)
			+
			(pixel_size_line_clear - pixel_size_baseline) / 2
		);

		ctx.fillStyle = 'grey'; // '#686868';

		for (let idx = max_pixels; idx--; ) {
			ctx.fillRect(
				idx * (pixel_size + 1),
				pos_y,
				pixel_size,
				pixel_size
			);
		}


		// Show the individual line clear events
		pixel_size = pixel_size_line_clear;
		max_pixels = Math.floor(ctx.canvas.width / (pixel_size + 1));
		y_scale = (ctx.canvas.height - pixel_size) / pixel_size;

		let
			to_draw = this.clear_events.slice(-1 * max_pixels),
			len = to_draw.length;

		for (let idx = len; idx--;) {
			const { cleared, trt } = to_draw[idx];
			const lines_data = LINES[cleared]
			const color = LINES[cleared] ? LINES[cleared].color : 'grey';

			ctx.fillStyle = color;
			ctx.fillRect(
				idx * (pixel_size + 1),
				Math.round((1 - trt) * y_scale * pixel_size),
				pixel_size,
				pixel_size
			);
		}
	}
}
