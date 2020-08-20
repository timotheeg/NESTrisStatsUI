const config = require('../config');
const fs = require('fs');



'use strict'

// if local db does not exist, create it and instantiate it
const db_filename = 'tetris.db';
let db_is_file;

try {
	db_is_file = fs.statSync(db_filename).isFile();
}
catch(err) {
	db_is_file = false;
}

const db = require('better-sqlite3')(db_filename);

if (!db_is_file) {
	// initial setup of the score table
	db.exec(`
		CREATE TABLE scores (
			datetime datetime,
			name text,
			start_level int,
			end_level int,
			score int,
			lines int,
			tetris_rate real,
			num_droughts int,
			max_drought int,
			das_avg real
		)
	`);
}

const
	insert = db.prepare(
		`INSERT INTO scores
		(
			datetime,
			name,
			start_level,
			end_level,
			score,
			lines,
			tetris_rate,
			num_droughts,
			max_drought,
			das_avg
		)
		VALUES
		(
			datetime(),
			@name,
			@start_level,
			@level,
			@cur_score,
			@lines_count,
			@tetris_rate,
			@num_droughts,
			@max_drought,
			@das_avg
		)`
	),

	pbs = db.prepare(
		`select start_level, end_level, score, lines, das_avg, tetris_rate from scores where name=? and start_level=? order by score desc limit 1`
	),

	best_overall = db.prepare(
		`select start_level, score, tetris_rate from scores where name=? order by score desc limit 5`
	),

	best_today = db.prepare(
		`select start_level, score, tetris_rate from scores where name=? and datetime>=datetime(?) order by score desc limit 5`
	)
;

let current_player = config.default_player;

module.exports = {
	getStats() {
		const now = new Date();
		const today = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate()
		);

		return {
			current_player,
			pbs: [
				pbs.get(current_player, 18),
				pbs.get(current_player, 19),
			],
			high_scores: {
				overall: best_overall.all(current_player),
				today:   best_today.all(current_player, today.toISOString())
			}
		};
	},

	saveGameResult(results) {
		db.transaction(() => insert.run({
			name: current_player,
			...results
		}))();

		const new_scores = this.getStats();

		this.onScoreUpdate(new_scores);

		return new_scores;
	},

	setUserName(username) {
		current_player = username;

		const new_scores = this.getStats();

		this.onScoreUpdate(new_scores);

		return { current_player };
	},

	onScoreUpdate() {},
};
