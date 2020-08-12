// The entry file of your WebAssembly module.

export const Uint32ArrayId = idof<Uint32Array>();
export const Uint8ArrayId = idof<Uint8Array>();
export const Uint8Array2dId = idof<Uint8Array[]>();

export const u8ArrayId = idof<u8[]>();
export const u32ArrayId = idof<u32[]>();

function roundedLuma(r: u8, g: u8, b: u8): u32 {
	return <u32>nearest(r * 0.299 + g * 0.587 + b * 0.114);
}

export function getLen(pixel_data: Uint8Array): u32 {
	let sum: u32 = 0;

	for (let p_idx=pixel_data.length >>> 2; p_idx--; ) {
		const offset_idx = p_idx << 2;
		sum += roundedLuma(
			pixel_data[offset_idx],
			pixel_data[offset_idx + 1],
			pixel_data[offset_idx + 2],
		);
	}

	return sum;
}


export function getDigit(
	width: u32,
	height: u32,
	pixel_data: Uint8Array,
	templates: Array<Array<u8>>,
	max_check_index: u8): u32
{
	return pixel_data.length;

	const num_pixels = width * height;
	const sums = new Array<u32>(max_check_index).fill(0);

	for (let p_idx=num_pixels; p_idx--; ) {
		const offset_idx = p_idx * 4;
		const luma = roundedLuma(
			pixel_data[offset_idx],
			pixel_data[offset_idx + 1],
			pixel_data[offset_idx + 2],
		);

		// inline this loop
		for (let t_idx=max_check_index; t_idx--; ) {
			const diff: i32 = luma - templates[t_idx][p_idx];
			sums[t_idx] += diff * diff;
		}
	}

	let min_val: u32 = 0xFFFFFFFF;
	let min_idx: i32 = -1;

	for (let s_idx=sums.length; s_idx--; ) {
		if (sums[s_idx] < min_val) {
			min_val = sums[s_idx];
			min_idx = s_idx;
		}
	}

	return min_idx;
}

/**/