if (!CanvasRenderingContext2D.prototype.clear) {
	CanvasRenderingContext2D.prototype.clear = function (preserveTransform) {
		if (preserveTransform) {
			this.save();
			this.setTransform(1, 0, 0, 1, 0, 0);
		}

		this.clearRect(0, 0, this.canvas.width, this.canvas.height);

		if (preserveTransform) {
			this.restore();
		}
	};
}


function renderBlock(level, block_index, pixel_size, ctx, pos_x, pos_y) {
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

		default:
			/*
			ctx.clearRect(
				pos_x,
				pos_y,
				pixel_size * 7,
				pixel_size * 7
			);
			/**/
	}
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

		// set up canvas
		['field', 'preview']
			.forEach(name => {
				const styles = getComputedStyle(dom[name]);
				const canvas = document.createElement('canvas');

				canvas.setAttribute('width', styles.width);
				canvas.setAttribute('height', styles.height);

				dom[name].appendChild(canvas);

				this[`${name}_ctx`] = canvas.getContext('2d');
			})

		this.reset();
	}

	reset() {
		this.preview = '';
		this.score = 0;
		this.lines = 0;
		this.level = 0;
		this.trt = 0;

		this.preview_ctx.clear();
		this.field_ctx.clear();
	}

	getScore() {
		return this.score;
	}

	setFrame(data) {
		this.dom.score.textContent = data.score;
		this.dom.lines.textContent = data.lines;
		this.dom.level.textContent = data.level;

		this.score = parseInt(data.score, 10);
		this.lines = parseInt(data.lines, 10);
		this.level = parseInt(data.level, 10);

		this.renderField(this.level, data.field);
		this.renderPreview(this.level, data.preview);
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
}