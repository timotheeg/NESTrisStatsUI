// The entry file of your WebAssembly module.

export const Uint32ArrayId = idof<Uint32Array>();
export const Uint8ArrayId = idof<Uint8Array>();
export const Uint8Array2dId = idof<Uint8Array[]>();

export const u8ArrayId = idof<u8[]>();
export const u32ArrayId = idof<u32[]>();


// a flattened 2d array of 17 templates of 196 bytes each
let templates: Uint8Array;

export function setTemplates(_templates: Uint8Array): void {
	templates = _templates;
}

@inline
function roundedLuma(r: u8, g: u8, b: u8): u32 {
	return <u32>nearest(r * 0.299 + g * 0.587 + b * 0.114);
}

export function getDigit(
	pixel_data: Uint8Array,
	max_check_index: u8): u32
{
	const sums = new Array<u32>(max_check_index).fill(0);
	const size = pixel_data.length >>> 2;

	for (let p_idx = size; p_idx--; ) {
		const offset_idx = p_idx << 2;
		const luma = roundedLuma(
			pixel_data[offset_idx],
			pixel_data[offset_idx + 1],
			pixel_data[offset_idx + 2],
		);

		for (let t_idx=max_check_index; t_idx--; ) {
			const diff: i32 = luma - templates[size * t_idx + p_idx];
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


export function crop<T>(data: T[], x: u32, y: u32, w: u32, h: u32): T[] {

}