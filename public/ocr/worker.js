console.log('w1');

const digits = "0123456789ABCDEF".split('');
digits.unshift('null');

let templates;

async function getTemplateData(digit) {
	console.log('loading ', digit);
	const response = await fetch(`./${digit.toLowerCase()}.png`);
	const blob = await response.blob();
	const data = await createImageBitmap(blob);

	const canvas = new OffscreenCanvas(14, 14);
	const ctx = canvas.getContext('2d');

	ctx.imageSmoothingQuality = 'medium';
	ctx.drawImage(data,
		0, 0,  7,  7,
		0, 0, 14, 14 // 2x scaling
	);
	
	const img_data = ctx.getImageData(0, 0, 14, 14);
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
	return await Promise.all(digits.map(getTemplateData));
}


let ready = false;
let drop_frames = 0;

self.onMessage = function(msg) {
	switch (msg.command) {
		case 'set_config': {
			break;
		}
		case 'frame': {
			if (!ready) return;

			if (working) {
				// drop frame
				drop_frames++;
				break;
			}

			processFrame();
		}
	}
}

function processFrame(frame) {
	const res = {};

	tasks.forEach(task => {
		res[task.name]
	});
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