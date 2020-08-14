const PATTERN_MAX_INDEXES = {
	'D': 11,
	'T': 4,
	'B': 3
};

class TetrisOCR extends EventTarget {
	constructor(templates, config) {
		super();

		this.templates = templates;
		this.config = config;

		this.processConfig();

		this.block_img = new ImageData(7, 7);
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

		// On top of the capture context, we need one more canvas for the scaled field
		// because the performance of OffScreenCanvas are horrible, and same gvoes for the bicubic lib for any image that's not super small :(


		// TODO: get rid of this additional canvas when we can T_T
		this.scaled_field_canvas = document.createElement('canvas');

		this.scaled_field_canvas.width = this.config.tasks.field.resize[0];
		this.scaled_field_canvas.heiht = this.config.tasks.field.resize[1];

		this.scaled_field_canvas_ctx = this.scaled_field_canvas.getContext('2d');
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

		performance.mark('deinterlace_end');

		const score = this.ocrDigits(source_img, this.config.tasks.score);

		performance.mark('score_end');

		const level = this.ocrDigits(source_img, this.config.tasks.level);

		performance.mark('level_end');

		const lines = this.ocrDigits(source_img, this.config.tasks.lines);

		performance.mark('lines_end');

		const field = await this.scanField(source_img, this.config.tasks.field, this.config.palette[level % 10]);

		performance.mark('field_end');

		const preview = await this.scanPreview(source_img, this.config.tasks.preview);

		performance.mark('preview_end');
		performance.mark('end');

		performance.measure('draw', 'start', 'draw_end');
		performance.measure('deinterlace', 'draw_end', 'deinterlace_end');
		performance.measure('score', 'deinterlace_end', 'score_end');
		performance.measure('level', 'score_end', 'level_end');
		performance.measure('lines', 'level_end', 'lines_end');
		performance.measure('field', 'lines_end', 'field_end');
		performance.measure('preview', 'field_end', 'preview_end');
		performance.measure('total', 'start', 'end');

		const res = { score, level, lines, field, preview, perf: {} };

		const measures = performance.getEntriesByType("measure").forEach(m => {
			res.perf[m.name] =  m.duration.toFixed(3);
		});

		performance.clearMarks();
		performance.clearMeasures();

		this.onMessage(res);
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

	scanPreview(source_img, task) {
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
				return 'T';
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

	async scanField(source_img, task, _colors) {
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
					.map(v => Math.round(v / 3));

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
