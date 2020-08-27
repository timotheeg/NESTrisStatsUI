export class Color {
	r: u8
	g: u8
	b: u8

	constructor(r:u8, g:u8, b:u8) {
		this.r = r;
		this.g = g;
		this.b = b;
	}
}

export class ImageData {
	width: u32
	height: u32
	data: Uint8Array

	constructor(width:u32, height:u32, data:Uint8Array) {
		this.width = width;
		this.height = height;
		this.data = data;
	}

	static getEmptyImageData(width:u32, height:u32): ImageData {
		return new ImageData(width, height, new Uint8Array(width * height));
	}
}

class Point {
	x: u32
	y: u32

	constructor(x, y) {
		this.x = x;
		this.y = y;
	}
}

@inline
export function luma(r: u8, g: u8, b: u8): f64 {
	return r * 0.299 + g * 0.587 + b * 0.114;
}

export function crop(source:ImageData, x:u32, y:u32, w:u32, h:u32, target:ImageData): ImageData {
	if (!target) {
		target = ImageData.getEmptyImageData(w, h);
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


// bicubic interpolation taken from
// https://www.strauss-engineering.ch/js-bilinear-interpolation.html

@inline
function TERP(t:f64, a:f64, b:f64, c:f64, d:f64): f64 {
	return 0.5 * (c - a + (2.0*a - 5.0*b + 4.0*c - d + (3.0*(b - c) + d - a)*t)*t)*t + b;
}

@inline
function BicubicInterpolation(x:f64, y:f64, values:u8[]): u8 {
	const i0 = TERP(x, values[0], values[1], values[2], values[3]);
	const i1 = TERP(x, values[4], values[5], values[6], values[7]);
	const i2 = TERP(x, values[8], values[9], values[10], values[11]);
	const i3 = TERP(x, values[12], values[13], values[14], values[15]);

	// do we need explicit 0-255 clamping here
	return <u8>nearest(TERP(y, i0, i1, i2, i3));
}

export function getBicubicPixels(srcImg:ImageData, dw: f64, dh:f64, destCoords: Point[]): Color[] {
	const sdata = srcImg.data;
	const sw:u32 = srcImg.width;
	const sh:u32 = srcImg.height;
	const yscale:f64 = dh / sh;
	const xscale:f64 = dw / sw;

	const buffer = new Array<u8>(16);

	// [x, y] are in the destination reference
	return destCoords.map(dest_point => {
		const x:u32 = dest_point.x;
		const y:u32 = dest_point.y;
		const ixv:f64 = x / xscale;
		const iyv:f64 = y / yscale;
		const ix0:f64 = Math.floor(ixv);
		const iy0:f64 = Math.floor(iyv);

		// We have to special-case the pixels along the border and repeat their values if neccessary
		let repeatY:i32 = 0;
		if(iy0 < 1) repeatY = -1;
		else if(iy0 > sh - 3) repeatY = iy0 - (sh - 3);

		// We have to special-case the pixels along the border and repeat their values if neccessary
		let repeatX:i32 = 0;
		if(ix0 < 1) repeatX = -1;
		else if(ix0 > sw - 3) repeatX = ix0 - (sw - 3);

		const offset_row1:i32 = ((iy0)   * sw + ix0) * 4;
		const offset_row0:i32 = repeatY < 0 ? offset_row1 : ((iy0-1) * sw + ix0) * 4;
		const offset_row2:i32 = repeatY > 1 ? offset_row1 : ((iy0+1) * sw + ix0) * 4;
		const offset_row3:i32 = repeatY > 0 ? offset_row2 : ((iy0+2) * sw + ix0) * 4;

		const offset_col1:i32 = 0;
		const offset_col0:i32 = repeatX < 0 ? offset_col1 : -4;
		const offset_col2:i32 = repeatX > 1 ? offset_col1 : 4;
		const offset_col3:i32 = repeatX > 0 ? offset_col2 : 8;

		const offsets:i32[] = [
			offset_row0+offset_col0, offset_row0+offset_col1, offset_row0+offset_col2, offset_row0+offset_col3,
			offset_row1+offset_col0, offset_row1+offset_col1, offset_row1+offset_col2, offset_row1+offset_col3,
			offset_row2+offset_col0, offset_row2+offset_col1, offset_row2+offset_col2, offset_row2+offset_col3,
			offset_row3+offset_col0, offset_row3+offset_col1, offset_row3+offset_col2, offset_row3+offset_col3,
		];

		const dx:f64 = ixv - ix0;
		const dy:f64 = iyv - iy0;
		const col:Color = new Color(0, 0, 0);

		offsets.forEach((offset, idx) => buffer[idx] = sdata[offset]);
		col.r = BicubicInterpolation(dx, dy, buffer);

		offsets.forEach((offset, idx) => buffer[idx] = sdata[offset + 1]);
		col.g = BicubicInterpolation(dx, dy, buffer);

		offsets.forEach((offset, idx) => buffer[idx] = sdata[offset + 2]);
		col.b = BicubicInterpolation(dx, dy, buffer);

		return col;
	});
}