// The entry file of your WebAssembly module.

export const Uint32ArrayId = idof<Uint32Array>();
export const Uint8ArrayId = idof<Uint8Array>();
export const Float64ArrayId = idof<Float64Array>();


// a flattened 2d array of 17 templates of 196 bytes each
let templates: Float64Array;

export function setTemplates(_templates: Float64Array): void {
	templates = _templates;
}

@inline
function luma(r: u8, g: u8, b: u8): f64 {
	return r * 0.299 + g * 0.587 + b * 0.114;
}

export function getDigit(
	pixel_data: Uint8Array,
	max_check_index: u8): i32
{
	const sums = new Float64Array(max_check_index);
	const size = pixel_data.length >>> 2;

	for (let p_idx = size; p_idx--; ) {
		const offset_idx = p_idx << 2;
		const pixel_luma = luma(
			pixel_data[offset_idx],
			pixel_data[offset_idx + 1],
			pixel_data[offset_idx + 2],
		);

		for (let t_idx=max_check_index; t_idx--; ) {
			const diff: f64 = pixel_luma - templates[size * t_idx + p_idx];
			sums[t_idx] += diff * diff;
		}
	}

	let min_val: f64 = Infinity;
	let min_idx: i32 = -1;

	for (let s_idx=sums.length; s_idx--; ) {
		if (sums[s_idx] < min_val) {
			min_val = sums[s_idx];
			min_idx = s_idx;
		}
	}

	return min_idx;
}


