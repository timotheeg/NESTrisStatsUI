// The entry file of your WebAssembly module.

import { Color, ImageData, luma, crop } from './image_tools';

export const Uint32ArrayId = idof<Uint32Array>();
export const Uint8ArrayId = idof<Uint8Array>();
export const Float64ArrayId = idof<Float64Array>();

let task_score: boolean = false;
let task_level: boolean = false;
let task_lines: boolean = false;
let task_preview: boolean = false;
let task_field: boolean = false;
let task_color1: boolean = false;
let task_color2: boolean = false;
let task_instant_das: boolean = false;
let task_cur_piece_das: boolean = false;
let task_cur_piece: boolean = false;
let task_stats: boolean = false;


class OCRResult {
	score: i32
	level: i32
	lines: i32
	preview: i32
	color1: Color
	color2: Color
	instant_das: i32
	cur_piece_das: i32
	cur_piece: i32
	field: Uint8Array
}

export function processFrame(width: u32, height: u32, data: Uint8Array): OCRResult {
	return new OCRResult();
}

function set_task_score(x:u32, y:u32, w:u32, h:u32) {
	task_score = true;

}

let templates: Float64Array;

export function setTemplates(_templates: Float64Array): void {
	templates = _templates;
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
