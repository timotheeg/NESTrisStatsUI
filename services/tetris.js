'use strict'

const
	db = require('better-sqlite3')('tetris.db'),

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
		`select start_level, score, tetris_rate from scores where name=? order by score desc limit 11`
	),

	best_today = db.prepare(
		`select start_level, score, tetris_rate from scores where name=? and datetime >= ? and datetime < ? order by score desc limit 11`
	)
;

let current_player = 'TIM';

module.exports = async function (fastify, opts) {
	fastify.post('/report_game', async function (request, reply) {

		// TODO: figure out whey headers are not sent as application/json
		if (typeof request.body === 'string') {
			request.body = JSON.parse(request.body); // let it throw if it's not json
		}

		const
			now = new Date(),
			tomorrow = new Date(now),
			data = {
				...request.body,
				name:         current_player,
				cur_score:    request.body.score.current,
				lines_count:  request.body.lines.count,
				tetris_rate:  request.body.lines[4].percent,
				num_droughts: request.body.i_droughts.count,
				max_drought:  request.body.i_droughts.max,
				das_avg:      request.body.das.avg
			};

		tomorrow.setDate(now.getDate() + 1);

		// insert game
		db.transaction(() => insert.run(data))();

		const res = {
			current_player,
			pbs: [
				pbs.get(current_player, 15),
				pbs.get(current_player, 18),
				pbs.get(current_player, 19),
			],
			high_scores: {
				overall: best_overall.all(current_player),
				today:   best_today.all(current_player, now.toISOString().split('T')[0], tomorrow.toISOString().split('T')[0])
			}
		};

		return res
	});

	fastify.register(require('fastify-formbody'));
	fastify.post('/set_player', async function (request, reply) {
		if (request.body.username === 'TRISTAN') {
			current_player = request.body.username;
		}
		else {
			current_player = 'TIM';	
		}

		return { current_player };
	});
}
