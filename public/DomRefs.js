// Sort of like a pageObject to have quick references to the things that matter

class DomRefs {
	constructor(doc) {
		this.stream_bg = {
			element: doc.querySelector('#stream_bg')
		};

		this.chat = {
			element: doc.querySelector('#chat .content')
		};

		// store refs by component
		this.tetris_rate = {
			element: doc.querySelector('#tetris_rate'),
			value:   doc.querySelector('#tetris_rate .content')
		};

		this.burn = {
			element: doc.querySelector('#burn'),
			count:   doc.querySelector('#burn .content')
		};

		this.level = {
			element: doc.querySelector('#level'),
			value:   doc.querySelector('#level .content')
		};

		this.lines = {
			element: doc.querySelector('#lines'),
			count:   doc.querySelector('#lines .content')
		};

		this.next = {
			element: doc.querySelector('#next_piece'),
			piece:   doc.querySelector('#next_piece .content .piece')
		};

		this.stage = {
			element: doc.querySelector('#tetris_stage'),
			ctx:     doc.querySelector('#tetris_stage canvas').getContext('2d')
		};

		// ===============================================================
		// ===============================================================

		const droughts = doc.querySelector('#droughts');

		this.droughts = {
			element: droughts,

			count: droughts.querySelector('.header .count'),

			cur: {
				element: droughts.querySelector('.hgauge.current'),
				ctx:     droughts.querySelector('.hgauge.current .gauge canvas').getContext('2d'),
				value:   droughts.querySelector('.hgauge.current .value')
			},
			last: {
				element: droughts.querySelector('.hgauge.last'),
				ctx:     droughts.querySelector('.hgauge.last .gauge canvas').getContext('2d'),
				value:   droughts.querySelector('.hgauge.last .value')
			},
			max: {
				element: droughts.querySelector('.hgauge.max'),
				ctx:     droughts.querySelector('.hgauge.max .gauge canvas').getContext('2d'),
				value:   droughts.querySelector('.hgauge.max .value')
			},
		};

		// ===============================================================
		// ===============================================================

		const pbs = doc.querySelector('#pbs');

		this.pbs = {
			element: pbs,
			name: pbs.querySelector('.header .name')
		};

		['s15', 's18', 's19'].forEach(level_class => {
			this.pbs[level_class] = {
				start_level: pbs.querySelector(`.${level_class} .start_level`),
				end_level:   pbs.querySelector(`.${level_class} .end_level`),
				score:       pbs.querySelector(`.${level_class} .score`),
				lines:       pbs.querySelector(`.${level_class} .lines`),
				das_avg:     pbs.querySelector(`.${level_class} .das_avg`),
				tetris_rate: pbs.querySelector(`.${level_class} .tetris_rate`),
			};
		});

		// ===============================================================
		// ===============================================================

		const high_scores = doc.querySelector('#high_scores');

		this.high_scores = {
			element: high_scores,

			name:    high_scores.querySelector('.header .name'),
			today:   high_scores.querySelector('.today tbody'),
			overall: high_scores.querySelector('.overall tbody'),
		};

		// ===============================================================
		// ===============================================================

		const score = doc.querySelector('#score');

		this.score = {
			element:    score,
			current:    score.querySelector('.content .running .value'),
			transition: score.querySelector('.content .transition .value'),
		};

		// ===============================================================
		// ===============================================================

		const das = doc.querySelector('#das');

		this.das = {
			element: das, 

			avg:   das.querySelector('.avg .count'),

			great: das.querySelector('.great .count'),
			ok:    das.querySelector('.ok .count'),
			bad:   das.querySelector('.bad .count'),

			ctx:   das.querySelector('.content canvas').getContext('2d'),
		};

		// ===============================================================
		// ===============================================================

		const lines_stats = doc.querySelector('#lines_stats');

		this.lines_stats = {
			element:     lines_stats,
			trt_ctx:     lines_stats.querySelector('canvas').getContext('2d'),
			count:       lines_stats.querySelector('.header .count'),
		};

		[
			'singles',
			'doubles',
			'triples',
			'tetris'
		]
		.forEach(category => {
			const row = lines_stats.querySelector(`tr.${category}`);

			this.lines_stats[category] = {
				count:   row.querySelector('.count'),
				lines:   row.querySelector('.line_count'),
				percent: row.querySelector('.percent'),
			}
		});

		// ===============================================================
		// ===============================================================

		const points = doc.querySelector('#points');

		this.points = {
			element: points,
			count:   points.querySelector('.header .count'),
		};

		[
			'drops',
			'singles',
			'doubles',
			'triples',
			'tetris'
		]
		.forEach(category => {
			const row = points.querySelector(`tr.${category}`);

			this.points[category] = {
				count:   row.querySelector('.count'),
				percent: row.querySelector('.percent'),
			}
		});

		// ===============================================================
		// ===============================================================

		const piece_stats = doc.querySelector('#piece_stats');

		this.pieces = {
			element: piece_stats,
			count:   piece_stats.querySelector(`.header .count`)
		};

		PIECES.forEach(name => {
			const piece_row = piece_stats.querySelector(`.piece.${name}`);

			this.pieces[name] = {
				count:   piece_row.querySelector('.count'),
				drought: piece_row.querySelector('.drought'),
				percent: piece_row.querySelector('.percent'),
				ctx:     piece_row.querySelector('canvas').getContext('2d')
			};
		});
	}
}