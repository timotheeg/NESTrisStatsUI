// const exports = {};
// importScripts('./loader.js');
const loader = exports;

// importScripts('./image_tools.js');

let asmodule;

const PALETTE = [[[65, 40, 228], [86, 168, 254]], [[3, 127, 1], [125, 199, 6]], [[139, 14, 179], [211, 96, 255]], [[64, 41, 225], [85, 210, 45]], [[154, 19, 87], [64, 205, 111]], [[65, 206, 112], [134, 131, 255]], [[146, 38, 2], [90, 91, 87]], [[97, 18, 215], [82, 0, 20]], [[64, 40, 227], [151, 43, 4]], [[147, 39, 3], [211, 137, 32]]];

const DIGITS = "0123456789ABCDEF".split('');

DIGITS.unshift('null');

const PATTERN_MAX_INDEXES = {
	'D': 11,
	'T': 4,
	'B': 3
};

let templates;

const scale_canvas = new OffscreenCanvas(
	(6 * 8 - 1) * 2, // longest string is score of 6 digits
	14
);
const scale_canvas_ctx = scale_canvas.getContext('2d', { alpha: false, lowLatency: true });
scale_canvas_ctx.imageSmoothingQuality = 'medium';


const scaled_field_canvas = new OffscreenCanvas(80, 160);
const scaled_field_canvas_ctx = scaled_field_canvas.getContext('2d');
scaled_field_canvas_ctx.imageSmoothingQuality = 'medium';


let raw_canvas;
let raw_canvas_ctx;

function roundedLuma(r, g, b) {
	return Math.round(r * 0.299 + g * 0.587 + b * 0.114);
}

function getDigit(pixel_data, max_check_index) {
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
			const diff = luma - templates[t_idx][p_idx];
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

async function getTemplateData(digit) {
	console.log('loading ', digit);
	const response = await fetch(`./${digit.toLowerCase()}.png`);
	const blob = await response.blob();
	const data = await createImageBitmap(blob);

	scale_canvas_ctx.drawImage(data,
		0, 0,  7,  7,
		0, 0, 14, 14 // 2x scaling
	);

	const img_data = scale_canvas_ctx.getImageData(0, 0, 14, 14);
	const lumas = new Uint8ClampedArray(img_data.width * img_data.height).fill(0);
	const pixel_data = img_data.data;

	for (let idx=0; idx < lumas.length; idx++) {
		const offset_idx = idx << 2;

		lumas[idx] = roundedLuma(
			pixel_data[offset_idx],
			pixel_data[offset_idx + 1],
			pixel_data[offset_idx + 2],
		);
	}

	return lumas;
}

async function loadDigits() {
	return await Promise.all(DIGITS.map(getTemplateData));
}

let ready = false;
// let config = null;
let drop_frames = 0;

self.onmessage = function(msg) {
	switch (msg.data.command) {
		case 'set_config': {
			setConfig(msg.data.config);
			break;
		}
		case 'frame': {
			if (!ready || !config) return;

			/*
			if (working) {
				// drop frame
				drop_frames++;
				break;
			}
			/**/

			processFrame2(msg.data.frame);
		}
	}
}

function setConfig(_config) {
	// config = _config;

	processConfig();

	raw_canvas = new OffscreenCanvas(config.width, config.height);
	raw_canvas_ctx = raw_canvas.getContext('2d', { alpha: false, lowLatency: true });
}

function processConfig() {
	const bounds = {
		top:    0xFFFFFFFF,
		left:   0xFFFFFFFF,
		bottom: -1,
		right:  -1,
	}

	for (const task of Object.values(config.tasks)) {
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

	config.digit_img = new ImageData(14, 14);
	config.capture_bounds = bounds;
	config.capture_area   = {
		x: bounds.left,
		y: bounds.top,
		w: bounds.right - bounds.left,
		h: bounds.bottom - bounds.top,
	};
}

async function processFrame2(frame) {
	performance.mark('start');

	// load the raw frame
	raw_canvas_ctx.drawImage(frame, 0, 0, config.width, config.height);

	performance.mark('draw_end');

	const source_img = deinterlace();

	performance.mark('deinterlace_end');

	const score = ocrDigits(source_img, config.tasks.score);

	performance.mark('score_end');

	const level = ocrDigits(source_img, config.tasks.level);

	performance.mark('level_end');

	const lines = ocrDigits(source_img, config.tasks.lines);

	performance.mark('lines_end');

	const field = await scanField(source_img, config.tasks.field, PALETTE[level % 10]);

	performance.mark('field_end');

	const preview = await scanPreview(source_img, config.tasks.preview);

	performance.mark('preview_end');
	performance.mark('end');


	performance.measure('draw', 'start', 'draw_end');

	performance.measure('deinterlace', 'draw_end', 'deinterlace_end');
	performance.measure('di_crop', 'di_start', 'di_crop_end');
	performance.measure('di_process', 'di_crop_end', 'di_process_end');


	performance.measure('score', 'deinterlace_end', 'score_end');
	performance.measure('level', 'score_end', 'level_end');
	performance.measure('lines', 'level_end', 'lines_end');
	performance.measure('field', 'lines_end', 'field_end');
	performance.measure('preview', 'field_end', 'preview_end');
	performance.measure('total', 'start', 'field_end');

	// console.log(performance.getEntriesByType("measure"));

	const res = { score, level, lines, field, perf: {} };

	const measures = performance.getEntriesByType("measure").forEach(m => {
		res.perf[m.name] =  m.duration.toFixed(3);
	});


	performance.clearMarks();
	performance.clearMeasures();

	onMessage(res);
}

// TODO: do with assembly
// TODO: only deinterlace what's needed (find lowest y crop value)
function deinterlace() {
	performance.mark('di_start');

	const pixels = capture_ctx.getImageData(
		config.capture_area.x, 0,
		config.capture_area.w, config.capture_bounds.bottom * 2 // * 2 to account for interlacing
	);

	performance.mark('di_crop_end');

	const pixels_per_rows = config.capture_area.w * 4;
	const max_rows = config.capture_bounds.bottom;

	for (let row_idx = 1; row_idx < max_rows; row_idx++) {
		pixels.data.copyWithin(
			pixels_per_rows * row_idx,
			pixels_per_rows * row_idx * 2,
			pixels_per_rows * (row_idx * 2 + 1)
		);
	}

	performance.mark('di_process_end');

	// raw_canvas_ctx.putImageData(pixels, capture_area.x, 0, 0, 0, pixels_per_rows, max_rows);
	// processed_ctx.putImageData(pixels, config.capture_area.x, 0, 0, 0, pixels_per_rows, max_rows);

	return pixels;
}

function ocrDigits(source_img, task) {
	const [raw_x, y, w, h] = task.crop;
	const nominal_width = 8 * task.pattern.length - 1;
	const x = raw_x - config.capture_area.x;

	crop(source_img, x, y, w, h, task.crop_img);
	bicubic(task.crop_img, task.scale_img);

	let t_crop = 0;
	let ocr = 0;

	const digits = new Array(task.pattern.length);

	let then, now;

	for (let idx=digits.length; idx--; ) {
		then = performance.now();
		const char = task.pattern[idx];
		crop(task.scale_img, idx * 16, 0, 14, 14, config.digit_img)

		t_crop += performance.now() - then;
		then = performance.now();

		/**/
		const digit = getDigit(config.digit_img.data, PATTERN_MAX_INDEXES[char]); // only check numerical digits and null
		/**/
		/*
		const as_array = asmodule.__allocArray(asmodule.Uint8ArrayId, config.digit_img.data);
		then = performance.now();

		const digit = asmodule.getDigit(
			as_array,
			PATTERN_MAX_INDEXES[char]
		);
		/**/

		ocr += performance.now() - then;

		if (!digit) return null;

		digits[idx] = digit - 1;
	}

	return digits.reverse().reduce((acc, v, idx) => acc += v * Math.pow(10, idx), 0);
}

function scanColors(source_img, task) {}

function scanPreview(source_img, task) {}

async function scanField(source_img, task, _colors) {
	const [raw_x, y, w, h] = task.crop;
	const x = raw_x - config.capture_area.x;
	const colors = [
		[0, 0, 0],
		[0xFF, 0xFF, 0xFF],
		..._colors
	];

	/*
	crop(source_img, x, y, w, h, task.crop_img);
	bicubic(task.crop_img, task.scale_img);
	/**/

	const resized = await createImageBitmap(
		source_img,
		x, y, w, h,
		{
			resizeWidth: task.resize[0],
			resizeHeight: task.resize[1],
			resizeQuality: 'medium'
		}
	);

	/*
	scaled_field_canvas_ctx.drawImage(resized, 0, 0);
	const field_img = scaled_field_canvas_ctx.getImageData(0, 0, ...task.resize);
	/**/

	/**/
	const ctx = dom.field_scaled.getContext('2d');
	ctx.drawImage(resized, 0, 0);
	const field_img = ctx.getImageData(0, 0, ...task.resize);
	/**/

	// simple array for now
	const field = [];

	// we will read 3 judiciously positionned pixels per block
	const pix_refs = [
		[2, 4],
		[4, 4],
		[5, 2]
	];

	/**/
	for (let ridx = 0; ridx < 20; ridx++) {
		for (let cidx = 0; cidx < 10; cidx++) {
			const block_offset = (ridx * 10 + cidx) * 8 * 4;

			const channels = pix_refs
				.map(([x, y]) => {
					const col_idx = block_offset + x * 10 * 8 * 4 + y * 4
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
	/**/

	return field.join('');
}


(async function init() {
	try {
		const importObject = {
			env: {
				abort(_msg, _file, line, column) {
					console.error("abort called at index.ts:" + line + ":" + column);
				}
			}
		};

		const { exports } = await loader.instantiate(
			fetch("./build/optimized.wasm"),
			importObject
		);

		asmodule = exports;

		// load the digit templates for OCR
		const luma_templates = templates = await loadDigits();
		const size = luma_templates[0].length;
		const merged_templates = new Uint8Array(luma_templates.length * size);

		luma_templates.forEach((template, idx) => {
			merged_templates.set(template, idx * size);
		});

		asmodule.setTemplates(
			asmodule.__retain(asmodule.__allocArray(asmodule.Uint8ArrayId, merged_templates))
		);

		ready = true;
	}
	catch(err) {
		console.error(err);
	}
})();
