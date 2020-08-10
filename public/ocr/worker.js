console.log('w1');

const DIGITS = "0123456789ABCDEF".split('');

DIGITS.unshift('null');

const PATTERN_MAX_INDEXES = {
	'D': 11,
	'T': 4,
	'B': 3
};


let templates;


const scale_canvas = new OffscreenCanvas(256, 256);
scale_canvas_ctx = scale_canvas.getContext('2d');
scale_canvas_ctx.imageSmoothingQuality = 'medium';

let raw_canvas;


// brute force processing
// candidate for assembly optimization
function getDigit(img_data, max_check_index) {
	const num_pixels = img_data.width * img_data.height;
	const pixel_data = img_data.data;

	if (!max_check_index) {
		max_check_index = templates.length;
	}

	const sums = new Uint32Array(max_check_index).fill(0);

	for (let p_idx=num_pixels; p_idx--; ) {
		const offset_idx = p_idx * 4;
		const luma = roundedLuma(
			pixel_data[offset_idx],
			pixel_data[offset_idx + 1],
			pixel_data[offset_idx + 2],
		);

		// inline this loop
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
		const offset_idx = idx * 4;

		lumas[idx] = roundedLuma(
			pixel_data[offset_idx],
			pixel_data[offset_idx + 1],
			pixel_data[offset_idx + 2],
		);
	}

	return lumas;
}

function roundedLuma(r, g, b) {
	return Math.round(r * 0.299 + g * 0.587 + b * 0.114);
}

async function loadDigits() {
	return await Promise.all(DIGITS.map(getTemplateData));
}

let ready = false;
let config = null;
let drop_frames = 0;

self.onmessage = function(msg) {
	switch (msg.data.command) {
		case 'set_config': {
			setConfig(msg.data.config);
			break;
		}
		case 'frame': {
			if (!ready) return;

			/*
			if (working) {
				// drop frame
				drop_frames++;
				break;
			}
			/**/

			processFrame(msg.data.frame);
		}
	}
}

function setConfig(_config) {
	config = _config;
	ready = true;

	raw_canvas = new OffscreenCanvas(config.width, config.height);
}

function processFrame(frame) {
	// load the raw frame
	raw_canvas.getContext('2d').drawImage(frame, 0, 0, config.width, config.height);

	deinterlace();

	const res = {
		score: ocrDigits(config.tasks.score),
		level: ocrDigits(config.tasks.level),
		lines: ocrDigits(config.tasks.lines),
	};

	self.postMessage(res);
}

// do with assembly
function deinterlace() {
	const ctx = raw_canvas.getContext('2d');
	const pixels = ctx.getImageData(0, 0, config.width, config.height);
	const pixels_per_rows = pixels.width * 4;
	const max_rows = pixels.height / 2;

	for (let row_idx = 1; row_idx < max_rows; row_idx++) {
		const slice = pixels.data.slice(
			pixels_per_rows * row_idx * 2,
			pixels_per_rows * (row_idx * 2 + 1)
		);

		pixels.data.set(slice, pixels_per_rows * row_idx);
	}

	ctx.putImageData(pixels, 0, 0, 0, 0, pixels_per_rows, max_rows);
}

function ocrDigits(task) {
	const [x, y, w, h] = task.crop;
	const nominal_width = 8 * task.pattern.length - 1;

	// draw 2x scale with smoothing
	scale_canvas_ctx.drawImage(
		raw_canvas,
		x, y, w, h,
		0, 0, nominal_width * 2, 14
	);

	const digits = new Array(task.pattern.length);

	for (let idx=0; idx<6; idx++) {
		const char = task.pattern[idx];
		const image_data = scale_canvas_ctx.getImageData(idx * 16, 0, 14, 14);
		const digit = getDigit(image_data, PATTERN_MAX_INDEXES[char]); // only check numerical digits and null

		if (!digit) return null;

		digits[idx] = digit - 1;
	}

	// TODO: compute the number, rather than returning an array of digits
	// TODO: can add in the for loop above
	return digits;
}


async function init() {
	try {
		templates = await loadDigits();
		console.log(templates);
		ready = true;
	}
	catch(err) {
		console.error(err);
	}
}

init();