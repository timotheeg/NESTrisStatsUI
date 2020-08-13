// const exports = {};
// importScripts('./loader.js');
const loader = exports;

// importScripts('./image_tools.js');

let asmodule;

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
scale_canvas_ctx = scale_canvas.getContext('2d', { alpha: false, lowLatency: true });
scale_canvas_ctx.imageSmoothingQuality = 'medium';

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
			task.scale_img = new ImageData(
				(8 * task.pattern.length - 1) * 2,
				14
			);
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

function processFrame2(frame) {
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

	performance.measure('draw', 'start', 'draw_end');

	performance.measure('deinterlace', 'draw_end', 'deinterlace_end');
	performance.measure('di_crop', 'di_start', 'di_crop_end');
	performance.measure('di_process', 'di_crop_end', 'di_process_end');
	performance.measure('di_write', 'di_process_end', 'di_write_end');


	performance.measure('score', 'deinterlace_end', 'score_end');
	performance.measure('level', 'score_end', 'level_end');
	performance.measure('lines', 'level_end', 'lines_end');
	performance.measure('total', 'start', 'lines_end');
	performance.measure('ocr_scale', 'ocr_start', 'ocr_scale_end');
	performance.measure('ocr_reckon', 'ocr_scale_end', 'ocr_reckon_end');

	// console.log(performance.getEntriesByType("measure"));

	const res = { score, level, lines, perf: {} };

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

	const pixels = raw_canvas_ctx.getImageData(
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

	performance.mark('di_write_end');

	return pixels;
}

function ocrDigits(source_img, task) {
	const [raw_x, y, w, h] = task.crop;
	const nominal_width = 8 * task.pattern.length - 1;

	const x = raw_x - config.capture_area.x;

	performance.mark('ocr_start');

	crop(source_img, x, y, w, h, task.crop_img);
	bicubic(task.crop_img, task.scale_img);

	dom.score_scaled.getContext('2d').putImageData(task.scale_img, 0, 0)

	performance.mark('ocr_scale_end');

	let t_crop = 0;
	let alloc = 0;
	let ocr = 0;

	const digits = new Array(task.pattern.length);

	let then, now;

	for (let idx=digits.length; idx--; ) {
		then = performance.now();
		const char = task.pattern[idx];
		// const image_data = scale_canvas_ctx.getImageData(idx * 16, 0, 14, 14);
		crop(task.scale_img, idx * 16, 0, 14, 14, config.digit_img)

		t_crop += performance.now() - then;
		then = performance.now();

		/**/
		const digit = getDigit(config.digit_img.data, PATTERN_MAX_INDEXES[char]); // only check numerical digits and null
		/**/
		/*
		const as_array = asmodule.__retain(asmodule.__allocArray(asmodule.Uint8ArrayId, image_data.data));
		alloc += performance.now() - then;
		then = performance.now();

		const digit = asmodule.getDigit(
			as_array,
			PATTERN_MAX_INDEXES[char]
		);

		asmodule.__release(as_array);
		/**/

		ocr += performance.now() - then;

		// if (!digit) return null;

		digits[idx] = digit - 1;
	}

	performance.mark('ocr_reckon_end');

	// TODO: compute the number, rather than returning an array of digits
	// TODO: can add in the for loop above
	return [...digits, {crop: t_crop.toFixed(3), alloc: alloc.toFixed(3), ocr: ocr.toFixed(3)}];
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
