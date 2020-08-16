const PATTERN_MAX_INDEXES = {
	'D': 11,
	'T': 4,
	'B': 3
};

function snakeToCamel(snake) {
	return (snake
		.split('_')
		.map(token => `${token[0].toUpperCase()}${token.slice(1)}`)
		.join(''));
}

// timing decorator
function timingDecorator(name, func) { // func must be prebound
	return function(...args) {
		performance.mark(`start_${name}`);

		const res = func(...args);

		performance.mark(`end_${name}`);
		performance.measure(name, `start_${name}`, `end_${name}`);

		return res;
	}
}

class TetrisOCR extends EventTarget {
	constructor(templates, config) {
		super();

		this.templates = templates;
		this.config = config;

		this.processConfig();

		this.block_img = new ImageData(7, 7);
		this.small_block_img = new ImageData(5, 5);

		// decorate relevant functions to capture timings
		this.deinterlace = timingDecorator('deinterlace', this.deinterlace.bind(this));

		[
			'score',
			'level',
			'lines',
			'color1',
			'color2',
			'preview',
			'field',
			'instant_das',
			'cur_piece_das',
			'cur_piece',
		]
		.forEach(name => {
			const camel_name = `scan${snakeToCamel(name)}`;
			const method = this[camel_name].bind(this);
			this[camel_name] = timingDecorator(name, method);
		});
	}

	processConfig() {
		const bounds = {
			top:    0xFFFFFFFF,
			left:   0xFFFFFFFF,
			bottom: -1,
			right:  -1,
		}

		for (const task of Object.values(this.config.tasks)) {
			const { crop: [x, y, w, h] } = task;

			bounds.top    = Math.min(bounds.top,    y);
			bounds.left   = Math.min(bounds.left,   x);
			bounds.bottom = Math.max(bounds.bottom, y + h);
			bounds.right  = Math.max(bounds.right,  x + w);

			task.crop_img = new ImageData(w, h);

			if (task.pattern) {
				// scale based on digit pattern
				task.scale_img = new ImageData(
					(8 * task.pattern.length - 1) * 2,
					14
				);
			}
			else if (task.resize) {
				task.scale_img = new ImageData(...task.resize);
			}
		}

		this.config.digit_img = new ImageData(14, 14);
		this.config.capture_bounds = bounds;
		this.config.capture_area = {
			x: bounds.left,
			y: bounds.top,
			w: bounds.right - bounds.left,
			h: bounds.bottom - bounds.top,
		};
	}

	getDigit(pixel_data, max_check_index) {
		const sums = new Uint32Array(max_check_index).fill(0);
		const size = pixel_data.length >>> 2;

		for (let p_idx = size; p_idx--; ) {
			const offset_idx = p_idx << 2;
			const luma = roundedLuma(
				pixel_data[offset_idx],
				pixel_data[offset_idx + 1],
				pixel_data[offset_idx + 2],
			);

			for (let t_idx=max_check_index; t_idx--; ) {
				const diff = luma - this.templates[t_idx][p_idx];
				sums[t_idx] += diff * diff;
			}
		}

		let min_val = 0xFFFFFFFF;
		let min_idx = -1;

		for (let s_idx=sums.length; s_idx--; ) {
			if (sums[s_idx] < min_val) {
				min_val = sums[s_idx];
				min_idx = s_idx;
			}
		}

		return min_idx;
	}

	initCaptureContext(frame) {
		this.capture_canvas = document.createElement('canvas');

		this.capture_canvas.width = frame.width;
		this.capture_canvas.height = frame.height;

		this.capture_canvas_ctx = this.capture_canvas.getContext('2d');
		this.capture_canvas_ctx.imageSmoothingEnabled = 'false';

		// On top of the capture context, we need one more canvas for the scaled field
		// because the performance of OffScreenCanvas are horrible, and same gvoes for the bicubic lib for any image that's not super small :(


		// TODO: get rid of this additional canvas when we can T_T
		this.scaled_field_canvas = document.createElement('canvas');

		this.scaled_field_canvas.width = this.config.tasks.field.resize[0];
		this.scaled_field_canvas.height = this.config.tasks.field.resize[1];

		this.scaled_field_canvas_ctx = this.scaled_field_canvas.getContext('2d');
		this.scaled_field_canvas_ctx.imageSmoothingQuality = 'medium';
	}

	async processFrame(frame) {
		if (!this.capture_canvas_ctx) {
			this.initCaptureContext(frame);
		}

		performance.mark('start');

		// load the raw frame
		this.capture_canvas_ctx.drawImage(frame, 0, 0, frame.width, frame.height);

		performance.mark('draw_end');

		const source_img = this.deinterlace();

		const score = this.scanScore(source_img);
		const level = this.scanLevel(source_img);
		const lines = this.scanLines(source_img);

		let color1, color2;

		if (this.config.tasks.color1) { // assumes the color tasks are a unit
			color1 = this.scanColor1(source_img);
			color2 = this.scanColor2(source_img);
		}

		const colors = color1 && color2 ? [color1, color2] : this.config.palette[level % 10];

		const field = await this.scanField(source_img, colors);
		const preview = this.scanPreview(source_img);

		let instant_das, cur_piece_das, cur_piece;

		if (this.config.tasks.instant_das) { // assumes all 3 das tasks are a unit
			instant_das = this.scanInstantDas(source_img);
			cur_piece_das = this.scanCurPieceDas(source_img);
			cur_piece = this.scanCurPiece(source_img);
		}

		performance.mark('end');

		performance.measure('draw_frame', 'start', 'draw_end');
		performance.measure('total', 'start', 'end');

		const res = {
			score,
			level,
			lines,
			preview,
			instant_das,
			cur_piece_das,
			cur_piece,
			field,
			color1,
			color2,
			perf: {},
		};

		const measures = performance.getEntriesByType("measure").forEach(m => {
			res.perf[m.name] =  m.duration.toFixed(3);
		});

		performance.clearMarks();
		performance.clearMeasures();

		this.onMessage(res);
	}

	scanScore(source_img) {
		return this.ocrDigits(source_img, this.config.tasks.score);
	}

	scanLevel(source_img) {
		return this.ocrDigits(source_img, this.config.tasks.level);
	}

	scanLines(source_img) {
		return this.ocrDigits(source_img, this.config.tasks.lines);
	}

	scanColor1(source_img) {
		return this.scanColor(source_img, this.config.tasks.color1);
	}

	scanColor2(source_img) {
		return this.scanColor(source_img, this.config.tasks.color2);
	}

	scanInstantDas(source_img) {
		return this.ocrDigits(source_img, this.config.tasks.instant_das);
	}

	scanCurPieceDas(source_img) {
		return this.ocrDigits(source_img, this.config.tasks.cur_piece_das);
	}


	deinterlace() {
		const pixels = this.capture_canvas_ctx.getImageData(
			this.config.capture_area.x, 0,
			this.config.capture_area.w, this.config.capture_bounds.bottom * 2 // * 2 to account for interlacing
		);

		const pixels_per_rows = this.config.capture_area.w * 4;
		const max_rows = this.config.capture_bounds.bottom;

		for (let row_idx = 1; row_idx < max_rows; row_idx++) {
			pixels.data.copyWithin(
				pixels_per_rows * row_idx,
				pixels_per_rows * row_idx * 2,
				pixels_per_rows * (row_idx * 2 + 1)
			);
		}

		this.config.deinterlaced_img = pixels;

		return pixels;
	}

	ocrDigits(source_img, task) {
		const [raw_x, y, w, h] = task.crop;
		const x = raw_x - this.config.capture_area.x;

		const nominal_width = 8 * task.pattern.length - 1;
		const digits = new Array(task.pattern.length);

		crop(source_img, x, y, w, h, task.crop_img);
		bicubic(task.crop_img, task.scale_img);

		for (let idx=digits.length; idx--; ) {
			const char = task.pattern[idx];

			crop(task.scale_img, idx * 16, 0, 14, 14, this.config.digit_img)

			const digit = this.getDigit(this.config.digit_img.data, PATTERN_MAX_INDEXES[char]);

			if (!digit) return null;

			digits[idx] = digit - 1;
		}

		return digits.reverse().reduce((acc, v, idx) => acc += v * Math.pow(10, idx), 0);
	}

	static isBlock(img, expected_count=49) {
		const block_presence_threshold = 0.7;
		const black_luma_limit = 15;
		const img_data = img.data;

		let sum = 0;

		for (let idx=img.width * img.height; idx--; ) {
			const offset_idx = idx << 2;
			sum += roundedLuma(
				img_data[offset_idx],
				img_data[offset_idx + 1],
				img_data[offset_idx + 2],
			) <  black_luma_limit ? 0 : 1;
		};

		return sum >= Math.floor(expected_count * block_presence_threshold);
	}

	scanPreview(source_img) {
		const task = this.config.tasks.preview;
		const [raw_x, y, w, h] = task.crop;
		const x = raw_x - this.config.capture_area.x;

		crop(source_img, x, y, w, h, task.crop_img);
		bicubic(task.crop_img, task.scale_img);

		// Trying side i blocks
		if (TetrisOCR.isBlock(crop(task.scale_img, 0, 3, 4, 7), 28)
			&& TetrisOCR.isBlock(crop(task.scale_img, 27, 3, 4, 7), 28)
		) {
			return 'I';
		}

		// now trying the 3x2 matrix for T, L, J, S, Z
		const top_row = [
			TetrisOCR.isBlock(crop(task.scale_img, 4, 0, 7, 7, this.block_img)),
			TetrisOCR.isBlock(crop(task.scale_img, 12, 0, 7, 7, this.block_img)),
			TetrisOCR.isBlock(crop(task.scale_img, 20, 0, 7, 7, this.block_img))
		];

		if (top_row[0] && top_row[1] && top_row[2]) { // J, T, L
			if (TetrisOCR.isBlock(crop(task.scale_img, 4, 8, 7, 7, this.block_img))) {
				return 'L';
			}
			if (TetrisOCR.isBlock(crop(task.scale_img, 12, 8, 7, 7, this.block_img))) {
				return 'T';
			}
			if (TetrisOCR.isBlock(crop(task.scale_img, 20, 8, 7, 7, this.block_img))) {
				return 'J';
			}

			return null;
		}

		if (top_row[1] && top_row[2]) {
			if (TetrisOCR.isBlock(crop(task.scale_img, 4, 8, 7, 7, this.block_img))
				&& TetrisOCR.isBlock(crop(task.scale_img, 12, 8, 7, 7, this.block_img))
			) {
				return 'S';
			}
		}

		if (top_row[0] && top_row[1]) {
			if (TetrisOCR.isBlock(crop(task.scale_img, 12, 8, 7, 7, this.block_img))
				&& TetrisOCR.isBlock(crop(task.scale_img, 20, 8, 7, 7, this.block_img))
			) {
				return 'Z';
			}
		}

		// lastly check for O
		if (
			TetrisOCR.isBlock(crop(task.scale_img, 8, 0, 7, 7, this.block_img))
			&& TetrisOCR.isBlock(crop(task.scale_img, 16, 0, 7, 7, this.block_img))
			&& TetrisOCR.isBlock(crop(task.scale_img, 8, 8, 7, 7, this.block_img))
			&& TetrisOCR.isBlock(crop(task.scale_img, 16, 8, 7, 7, this.block_img))
		) {
			return 'O';
		}

		return null;
	}

	scanCurPiece(source_img) {
		const task = this.config.tasks.cur_piece;
		const [raw_x, y, w, h] = task.crop;
		const x = raw_x - this.config.capture_area.x;

		// curPieces are not vertically aligned on the op row
		// L and J are rendered 1 pixel higher
		// than S, Z, T, O

		crop(source_img, x, y, w, h, task.crop_img);
		bicubic(task.crop_img, task.scale_img);

		// Trying side i blocks
		if (TetrisOCR.isBlock(crop(task.scale_img, 0, 4, 2, 5), 10)
			&& TetrisOCR.isBlock(crop(task.scale_img, 20, 4, 3, 5), 15)
		) {
			return 'I';
		}

		// now trying for L, J (top pixel alignment)
		let top_row = [
			TetrisOCR.isBlock(crop(task.scale_img, 2, 0, 5, 5, this.small_block_img), 15),
			TetrisOCR.isBlock(crop(task.scale_img, 8, 0, 5, 5, this.small_block_img), 15),
			TetrisOCR.isBlock(crop(task.scale_img, 14, 0, 5, 5, this.small_block_img), 15)
		];

		if (top_row[0] && top_row[1] && top_row[2]) {
			if (TetrisOCR.isBlock(crop(task.scale_img, 2, 6, 5, 5, this.small_block_img), 15)) {
				return 'L';
			}
			if (TetrisOCR.isBlock(crop(task.scale_img, 14, 6, 5, 5, this.small_block_img), 15)) {
				return 'J';
			}
		}

		// checking S, Z, T
		top_row = [
			TetrisOCR.isBlock(crop(task.scale_img, 2, 1, 5, 5, this.small_block_img), 15),
			TetrisOCR.isBlock(crop(task.scale_img, 8, 1, 5, 5, this.small_block_img), 15),
			TetrisOCR.isBlock(crop(task.scale_img, 14, 1, 5, 5, this.small_block_img), 15)
		];

		if (top_row[0] && top_row[1] && top_row[2]) {
			if (TetrisOCR.isBlock(crop(task.scale_img, 8, 7, 5, 5, this.small_block_img), 15)) {
				return 'T';
			}

			return null;
		}

		if (top_row[1] && top_row[2]) {
			if (TetrisOCR.isBlock(crop(task.scale_img, 2, 7, 5, 5, this.small_block_img), 15)
				&& TetrisOCR.isBlock(crop(task.scale_img, 8, 7, 5, 5, this.small_block_img), 15)
			) {
				return 'S';
			}
		}

		if (top_row[0] && top_row[1]) {
			if (TetrisOCR.isBlock(crop(task.scale_img, 8, 7, 5, 5, this.small_block_img), 15)
				&& TetrisOCR.isBlock(crop(task.scale_img, 14, 7, 5, 5, this.small_block_img), 15)
			) {
				return 'Z';
			}
		}

		// lastly check for O
		if (
			TetrisOCR.isBlock(crop(task.scale_img, 5, 1, 5, 5, this.small_block_img), 15)
			&& TetrisOCR.isBlock(crop(task.scale_img, 11, 1, 5, 5, this.small_block_img), 15)
			&& TetrisOCR.isBlock(crop(task.scale_img, 5, 7, 5, 5, this.small_block_img), 15)
			&& TetrisOCR.isBlock(crop(task.scale_img, 11, 7, 5, 5, this.small_block_img), 15)
		) {
			return 'O';
		}

		return null;
	}

	scanColor(source_img, task) {
		const [raw_x, y, w, h] = task.crop;
		const x = raw_x - this.config.capture_area.x;

		crop(source_img, x, y, w, h, task.crop_img);
		bicubic(task.crop_img, task.scale_img);

		const pix_refs = [
			[3, 2],
			[3, 3],
			[2, 3]
		];

		return pix_refs
			.map(([x, y]) => {
				const col_idx = y * 5 * 4 + x * 4;
				return task.scale_img.data.subarray(col_idx, col_idx + 3);
			})
			.reduce((acc, col) => {
				acc[0] += col[0];
				acc[1] += col[1];
				acc[2] += col[2];
				return acc;
			}, [0, 0, 0])
			.map(v => Math.round(v / pix_refs.length));
	}

	async scanField(source_img, _colors) {
		const task = this.config.tasks.field;
		const [raw_x, y, w, h] = task.crop;
		const x = raw_x - this.config.capture_area.x;
		const colors = [
			[0, 0, 0],
			[0xFF, 0xFF, 0xFF],
			..._colors
		];

		crop(source_img, x, y, w, h, task.crop_img);

		/*
		bicubic(task.crop_img, task.scale_img);
		const field_img = task.scale_img;
		/**/

		/**/
		const resized = await createImageBitmap(
			task.crop_img,
			0, 0, w, h,
			{
				resizeWidth: task.resize[0],
				resizeHeight: task.resize[1],
				resizeQuality: 'medium'
			}
		);

		this.scaled_field_canvas_ctx.drawImage(resized, 0, 0);
		const field_img = this.scaled_field_canvas_ctx.getImageData(0, 0, ...task.resize);

		task.scale_img.data.set(field_img.data);
		/**/

		// simple array for now
		const field = [];

		// we will read 3 judiciously positionned pixels per block
		const pix_refs = [
			[2, 4],
			[3, 3],
			[4, 4],
			[4, 2]
		];

		for (let ridx = 0; ridx < 20; ridx++) {
			for (let cidx = 0; cidx < 10; cidx++) {
				const block_offset = ((ridx * 10 * 8 * 8) + cidx * 8) * 4;

				const channels = pix_refs
					.map(([x, y]) => {
						const col_idx = block_offset + y * 10 * 8 * 4 + x * 4;
						return field_img.data.subarray(col_idx, col_idx + 3);
					})
					.reduce((acc, col) => {
						acc[0] += col[0];
						acc[1] += col[1];
						acc[2] += col[2];
						return acc;
					}, [0, 0, 0])
					.map(v => Math.round(v / pix_refs.length));

				let min_diff = 0xFFFFFFFF;
				let min_idx = -1;

				colors.forEach((col, col_idx) => {
					const sum = col.reduce((sum, c, idx) => sum += (c - channels[idx]) * (c - channels[idx]), 0);

					if (sum < min_diff) {
						min_diff = sum;
						min_idx = col_idx;
					}
				})

				field.push(min_idx);
			}
		}

		return field;
	}
}