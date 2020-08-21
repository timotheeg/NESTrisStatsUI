export class Result {
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

export class Config {
	score:         Task;
	level:         Task;
	lines:         Task;
	preview:       Task;
	field:         Task;
	color1:        Task;
	color2:        Task;
	instant_das:   Task;
	cur_piece_das: Task;
	cur_piece:     Task;
	stats:         Task;
}

export class Task {
	crop: [u32, u32, u32, u32]
	patterns: Uint8Array?
}