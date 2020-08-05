'use strict'

const TetrisDAO = require('../daos/tetris');

module.exports = async function (fastify, opts) {
	fastify.get('/get_stats', async () => {
		return TetrisDAO.getStats();
	});

	fastify.post('/report_game', async function (request, reply) {

		// TODO: figure out whey headers are not sent as application/json
		if (typeof request.body === 'string') {
			request.body = JSON.parse(request.body); // let it throw if it's not json
		}

		if (request.body.start_level == null) {
			const err = new TypeError("Invalid start_level");
			err.statusCode = 400;

			reply.done(err);
			return;
		}

		const
			data = {
				...request.body,
				cur_score:    request.body.score.current,
				lines_count:  request.body.lines.count,
				tetris_rate:  request.body.lines[4].percent,
				num_droughts: request.body.i_droughts.count,
				max_drought:  request.body.i_droughts.max,
				das_avg:      request.body.das.avg
			};

		return TetrisDAO.saveGameResult(data);
	});

	fastify.register(require('fastify-formbody'));
	fastify.post('/set_player', async function (request, reply) {
		return TetrisDAO.setUserName(request.body.username);
	});
}
