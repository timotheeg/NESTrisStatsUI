export class Color {
	r: u8
	g: u8
	b: u8
}

export class ImageData {
	width: u32
	height: u32
	data: Uint8Array

	constructor(width:u32, height:u32, data:Uint8Array) {
		this.width = width;
		this.height = height;

		if (data) {
			this.data = data;
		}
		else {
			this.data = new Uint8Array(width * height);
		}
	}
}

@inline
export function luma(r: u8, g: u8, b: u8): f64 {
	return r * 0.299 + g * 0.587 + b * 0.114;
}

export function crop(source:ImageData, x: u32, y:u32, w:u32, h:u32, target:ImageData): ImageData {
	if (!target) {
		target = new ImageData(w, h);
	}

	for (let row_idx:u32 = 0; row_idx < h; row_idx++) {
		const start_idx = ((row_idx + y) * source.width + x) << 2;
		const slice = source.data.subarray( // subarray allow passing by references
			start_idx,
			start_idx + w * 4
		);
		target.data.set(slice, row_idx * w * 4);
	}

	return target;
}