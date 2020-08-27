// The entry file of your WebAssembly module.

import { Color, ImageData, luma, crop } from './image_tools';

export const Uint32ArrayId = idof<Uint32Array>();
export const Uint8ArrayId = idof<Uint8Array>();
export const Float64ArrayId = idof<Float64Array>();

let task_score: Task;
let task_level: Task;
let task_lines: Task;
let task_preview: Task;
let task_field: Task;
let task_color1: Task;
let task_color2: Task;
let task_instant_das: Task;
let task_cur_piece_das: Task;
let task_cur_piece: Task;
let palette: Uint8Array;

class Task {
	crop: Crop

	constructor(crop: Crop) {
		this.crop = crop;
	}
}

class DigitsTask extends Task {
	num_digits: u8
	first_digit_max_len: u8

	constructor(crop: Crop, num_digits: u8, first_digit_max_len: u8) {
		super(crop);

		this.num_digits = num_digits;
		this.first_digit_max_len = first_digit_max_len;
	}
}

class Crop {
	x: u32
	y: u32
	w: u32
	h: u32

	constructor(x:u32, y:u32, w:u32, h:u32) {
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
	}
}

export class OCRResult {
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

	constructor() {
		this.color1 = new Color(0, 0, 0);
		this.color2 = new Color(0, 0, 0);
		this.field = new Uint8Array(200);
	}
}

export function set_task_score(x:u32, y:u32, w:u32, h:u32): void {
	task_score = new DigitsTask(new Crop(x, y, w, h), 6, 14);
}

export function set_task_level(x:u32, y:u32, w:u32, h:u32): void {
	task_level = new DigitsTask(new Crop(x, y, w, h), 2, 4);
}

export function set_task_lines(x:u32, y:u32, w:u32, h:u32): void {
	task_lines = new DigitsTask(new Crop(x, y, w, h), 3, 5);
}

export function set_task_instant_das(x:u32, y:u32, w:u32, h:u32): void {
	task_instant_das = new DigitsTask(new Crop(x, y, w, h), 2, 3);
}

export function set_task_cur_piece_das(x:u32, y:u32, w:u32, h:u32): void {
	task_cur_piece_das = new DigitsTask(new Crop(x, y, w, h), 2, 3);
}

export function set_task_preview(x:u32, y:u32, w:u32, h:u32): void {
	task_preview = new Task(new Crop(x, y, w, h));
}

export function set_task_field(x:u32, y:u32, w:u32, h:u32): void {
	task_field = new Task(new Crop(x, y, w, h));
}

export function set_task_color1(x:u32, y:u32, w:u32, h:u32): void {
	task_color1 = new Task(new Crop(x, y, w, h));
}

export function set_task_color2(x:u32, y:u32, w:u32, h:u32): void {
	task_color2 = new Task(new Crop(x, y, w, h));
}

export function set_task_cur_piece(x:u32, y:u32, w:u32, h:u32): void {
	task_cur_piece = new Task(new Crop(x, y, w, h));
}

let templates: Float64Array;

export function setTemplates(_templates: Float64Array): void {
	templates = _templates;
}

export function setPalette(flat_colors: Uint8Array): void {
	// flatten array of following structure
	// [c1, c2, c3, c4, c5, c6] representing rgb for color1, color2 times 10 reference level
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

function ocrDigits(source: ImageData, task: Task, num_digits: u8): void {

}


export function processFrame(width: u32, height: u32, data: Uint8Array): OCRResult {
	const source = new ImageData(width, height, data);

	return new OCRResult();
}
