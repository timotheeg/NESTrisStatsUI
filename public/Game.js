const FIELD_ANALYSIS_IGNORED_ROWS = 3;

class Row {
	constructor(line, row_idx) {
		this.cells = line.split('');
		this.idx = row_idx;

		const emptys = this.emptys = [];

		this.cells.forEach((val, idx) => {
			if (val === '0') emptys.push(idx);
		});

		if (emptys.length === 1) {
			this.well = emptys[0] + 1;
		}
	}
}

class Column {
	constructor(cells, col_idx) {
		this.cells = cells;
		this.idx = col_idx;

		const len = this.cells.length;

		this.top_fill_idx = len;

		for (let idx = 0; idx < len; idx++) {
			if (this.cells[idx] != '0') {
				this.top_fill_idx = idx;
				break;
			}
		}

		this.has_holes = this.cells.indexOf('0', this.top_fill_idx) > -1;
	}
}

class Board {
	constructor(board_str, top_rows_to_ignore) {
		this.rows = Array();

		const columns = Array(10).fill().map(_ => []);

		for (let y = top_rows_to_ignore; y < 20; y++) {
			const row = new Row(board_str.substr(10 * y, 10), this.rows.length);
			this.rows.push(row);

			row.cells.forEach((value, idx) => {
				columns[idx].push(value);
			});
		}

		this.columns = columns.map((col, idx) => new Column(col, idx));

		const tetris_top_row = this.getTetrisTopRow();

		this.stats = {
			top_idx:           columns.reduce((acc, col) => Math.min(acc, col.top_fill_idx), 20),
			is_tetris_ready:   !!this.tetris_top_row,
			has_perfect_slope: this.hasPerfectSlope(),
			has_double_well:   this.hasDoubleWell(),
		};
	}

	getTetrisTopRow() {
		for (let idx = this.rows.length; idx-- > 4;) {
			const row = this.rows[idx];

			if (!row.well) continue;

			// blocked below and free above
			if (this.columns[row.well - 1].top_fill_idx !== idx + 1) continue;

			// well is 4 row deep
			if (row.well != this.rows[idx-1].well
				|| row.well != this.rows[idx-2].well
				|| row.well !=  this.rows[idx-3].well
			) continue;

			return this.rows[idx-3];
		}

		return null;
	}

	hasPerfectSlope() {
		let height_idx = -1;

		for (let col of this.columns) {
			if (col.has_holes) return false;
			if (col.top_fill_idx < height_idx) return false;

			height_idx = col.top_fill_idx;
		}

		return true;
	}

	hasDoubleWell() {
		if (
			!this.is_tetris_ready
			|| this.tetris_top_row.idx === 0 // tetris ready all the way to the top
			|| this.tetris_top_row.well != 10
		) return false;

		for (let idx = this.tetris_top_row.idx; idx--; ) {
			let prev_row = this.rows[idx];

			if (prev_row.well === 10) continue; // tetris well still going!
			if (prev_row.emptys.length == 2 && prev_row.emptys[0] === 8 && prev_row.emptys[1] === 9) {
				return true;
			}

			return false;
		}

		return false;
	}
}

class Game {
	constructor(event) {
		// will store all pieces that have been played in the game
		this.pieces = [];

		this.line_events = []; // entry will be added every time lines are cleared

		this.data = {
			start_level: event.level,

			level: event.level,
			burn:  0,

			score: {
				current:    event.score,
				transition: null
			},

			i_droughts: {
				count: 0,
				cur:   0,
				last:  0,
				max:   0
			},

			das: {
				cur:   0,
				total: 0, // running total, used for average computation
				avg:   0,
				great: 0,
				ok:    0,
				bad:   0
			},

			pieces: {
				count: 0
			},

			lines: {
				count: event.lines,
			},

			points: {
				count: event.score,
				drops: {
					count:   0,
					percent: 0
				}
			}
		}

		PIECES.forEach(name => {
			this.data.pieces[name] = {
				count:   0,
				percent: 0,
				drought: 0,
				indexes: []
			}
		});

		[1, 2, 3, 4].forEach(name => {
			this.data.lines[name] = {
				count:   0,
				lines:   0,
				percent: 0
			};

			this.data.points[name] = {
				count:   0,
				percent: 0
			};
		});
	}

	onDasLoss() {
		if (!this.pieces.length) return;

		this.pieces[this.pieces.length - 1].das_loss = true;
	}

	// event: {score, level, lines, das, cur_piece, next_piece, }
	onPiece(event) {
		const p = event.cur_piece;

		this.data.pieces.count++;
		this.data.pieces[p].count++;

		PIECES.forEach(name => {
			const stats = this.data.pieces[name];

			stats.percent = stats.count / this.data.pieces.count;
			stats.drought++;
		});

		this.data.pieces[p].drought = 0;

		if (p != 'I') {
			this.data.i_droughts.cur++;

			if (this.data.i_droughts.cur == DROUGHT_PANIC_THRESHOLD) {
				this.data.i_droughts.count++;
			}

			if (this.data.i_droughts.cur > this.data.i_droughts.max) {
				this.data.i_droughts.max = this.data.i_droughts.cur;
			}
		}
		else {
			if (this.data.i_droughts.cur > 0) {
				this.data.i_droughts.last = this.data.i_droughts.cur;
			}

			this.data.i_droughts.cur = 0;
		}

		this.data.pieces[p].drought = 0;

		// update das
		const das_stats = this.data.das;
		das_stats.cur   =  event.cur_piece_das;
		das_stats.total += event.cur_piece_das;
		das_stats.avg   =  das_stats.total / this.data.pieces.count;
		das_stats[DAS_THRESHOLDS[das_stats.cur]]++; // great, ok, bad

		const piece_data = {
			piece: p,
			das:   event.cur_piece_das,
			index: this.pieces.length
		};

		this.pieces.push(piece_data);
		this.data.pieces[p].indexes.push(piece_data);
	}

	onLine(event) {
		const
			num_lines    = event.lines - this.data.lines.count,
			lines_score  = this.getScore(event.level, num_lines),
			actual_score = event.score - this.data.score.current;

		// update total lines and points
		this.data.lines.count = event.lines;
		this.data.points.count = event.score;

		// update drop score
		this.data.points.drops.count += actual_score - lines_score;

		if (num_lines) {
			if (num_lines > 0 && num_lines <= 4) {
				// update lines stats for clearing type (single, double, etc...)
				this.data.lines[num_lines].count += 1;
				this.data.lines[num_lines].lines += num_lines;

				// update points stats for clearing type (single, double, etc...)
				this.data.points[num_lines].count += lines_score;

				// update percentages for everyone
				for (let clear_type=4; clear_type; clear_type--) {
					const line_stats = this.data.lines[clear_type];
					line_stats.percent = line_stats.lines / this.data.lines.count;
				}
			}
			else {
				console.log('invalid num_lines', num_lines, event);
			}

			// record line event
			this.line_events.push({
				num_lines,
				tetris_rate: this.data.lines[4].percent
			});
		}

		// update percentages for everyone
		for (let clear_type = 4; clear_type; clear_type--) {
			const point_stats = this.data.points[clear_type];
			point_stats.percent = point_stats.count / event.score;
		}

		// update stat for drops
		this.data.points.drops.percent = this.data.points.drops.count / event.score;

		// update score
		this.data.score.current = event.score;

		// check transition score
		if (event.level > this.data.level) {
			if (this.data.score.transition === null && event.level === this.data.start_level + 1) {
				this.data.score.transition = event.score;
			}
		}

		// update level
		this.data.level = event.level;

		// update burn if needed
		if (num_lines) {
			if (num_lines < 4) {
				this.data.burn += num_lines;
			}
			else {
				this.data.burn = 0;
			}
		}
	}

	getScore(level, num_lines) {
		return SCORE_BASES[num_lines] * (level + 1)
	}

	toString(encoding='json') {
		return JSON.stringify(this.data);
	}
}