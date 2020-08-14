// bicubic interpolation taken from
// https://www.strauss-engineering.ch/js-bilinear-interpolation.html


function TERP(t, a, b, c, d){
	return 0.5 * (c - a + (2.0*a - 5.0*b + 4.0*c - d + (3.0*(b - c) + d - a)*t)*t)*t + b;
}

function BicubicInterpolation(x, y, values){
	const i0 = TERP(x, values[0], values[1], values[2], values[3]);
	const i1 = TERP(x, values[4], values[5], values[6], values[7]);
	const i2 = TERP(x, values[8], values[9], values[10], values[11]);
	const i3 = TERP(x, values[12], values[13], values[14], values[15]);

	return TERP(y, i0, i1, i2, i3);
}

function bicubic(srcImg, destImg) {
	const sdata = srcImg.data;
	const sw = srcImg.width;
	const sh = srcImg.height;
	const dw = destImg.width;
	const dh = destImg.height;
	const yscale = dh / sh;
	const xscale = dw / sw;

	for (let i = 0; i < dh; ++i) {
		const iyv = i / yscale;
		const iy0 = Math.floor(iyv);

		// We have to special-case the pixels along the border and repeat their values if neccessary
		let repeatY = 0;
		if(iy0 < 1) repeatY = -1;
		else if(iy0 > sh - 3) repeatY = iy0 - (sh - 3);

		for (let j = 0; j < dw; ++j) {
			const ixv = j / xscale;
			const ix0 = Math.floor(ixv);

			// We have to special-case the pixels along the border and repeat their values if neccessary
			let repeatX = 0;
			if(ix0 < 1) repeatX = -1;
			else if(ix0 > sw - 3) repeatX = ix0 - (sw - 3);

			const offset_row1 = ((iy0)   * sw + ix0) * 4;
			const offset_row0 = repeatY < 0 ? offset_row1 : ((iy0-1) * sw + ix0) * 4;
			const offset_row2 = repeatY > 1 ? offset_row1 : ((iy0+1) * sw + ix0) * 4;
			const offset_row3 = repeatY > 0 ? offset_row2 : ((iy0+2) * sw + ix0) * 4;

			const offset_col1 = 0;
			const offset_col0 = repeatX < 0 ? offset_col1 : -4;
			const offset_col2 = repeatX > 1 ? offset_col1 : 4;
			const offset_col3 = repeatX > 0 ? offset_col2 : 8;

			const offsets = [
				offset_row0+offset_col0, offset_row0+offset_col1, offset_row0+offset_col2, offset_row0+offset_col3,
				offset_row1+offset_col0, offset_row1+offset_col1, offset_row1+offset_col2, offset_row1+offset_col3,
				offset_row2+offset_col0, offset_row2+offset_col1, offset_row2+offset_col2, offset_row2+offset_col3,
				offset_row3+offset_col0, offset_row3+offset_col1, offset_row3+offset_col2, offset_row3+offset_col3,
			];

			const dx = ixv - ix0;
			const dy = iyv - iy0;
			const idxD = (i * dw + j) << 2;

			const red_pixels = offsets.map(offset => sdata[offset]);
			destImg.data[idxD] = BicubicInterpolation(dx, dy, red_pixels);

			const green_pixels = offsets.map(offset => sdata[offset+1]);
			destImg.data[idxD+1] = BicubicInterpolation(dx, dy, green_pixels);

			const blue_pixels = offsets.map(offset => sdata[offset+2]);
			destImg.data[idxD+2] = BicubicInterpolation(dx, dy, blue_pixels);

			// const alpha_pixels = offsets.map(offset => sdata[offset+2]);
			// destImg.data[idxD+3] = BicubicInterpolation(dx, dy, alpha_pixels);
			destImg.data[idxD+3] = 255;
		}
	}
}

function crop(source, x, y, w, h, target=null) {
	if (!target) {
		target = new ImageData(w, h);
	}

	for (let row_idx = 0; row_idx < h; row_idx++) {
		const start_idx = ((row_idx + y) * source.width + x) << 2;
		const slice = source.data.subarray( // subarray allow passing by references
			start_idx,
			start_idx + w * 4
		);
		target.data.set(slice, row_idx * w * 4);
	}

	return target;
}