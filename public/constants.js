const

	PIECES = ['T', 'J', 'Z', 'O', 'S', 'L', 'I'],

	// generate colors at https://paletton.com/

	LINES = {
		1: { name: 'singles', color: '#1678FF' },
		2: { name: 'doubles', color: '#FF9F00' },
		3: { name: 'triples', color: '#FF00B9' },
		4: { name: 'tetris',  color: '#FFFFFF' },
	},

	BOARD_COLORS = {
		floor:        '#747474',
		height:       '#BBBBBB',
		tetris_ready: '#8438AE',
		clean_slope:  '#11988E',
		double_well:  '#F8F81B',
	},

	FIELD_ANALYSIS_IGNORED_ROWS = 4,

	DAS_COLORS = {
		absent: 'white',
		great:  'limegreen',
		ok:     'orange',
		bad:    'red',
	},

	DAS_THRESHOLDS = {
		0:  'bad',
		1:  'bad',
		2:  'bad',
		3:  'bad',
		4:  'bad',
		5:  'bad',
		6:  'bad',
		7:  'bad',
		8:  'bad',
		9:  'bad',
		10: 'ok',
		11: 'ok',
		12: 'ok',
		13: 'ok',
		14: 'ok',
		15: 'great',
		16: 'great',
	},

	DROUGHT_PANIC_THRESHOLD = 13,

	SCORE_BASES = [0, 40, 100, 300, 1200],

	EFF_LINE_VALUES = [0, 40, 50, 100, 300],

	// arrays of color 1 and color 2
	LEVEL_COLORS = [
	    [ '#4A32FF', '#4AAFFE' ],
	    [ '#009600', '#6ADC00' ],
	    [ '#B000D4', '#FF56FF' ],
	    [ '#4A32FF', '#00E900' ],
	    [ '#C8007F', '#00E678' ],
	    [ '#00E678', '#968DFF' ],
	    [ '#C41E0E', '#666666' ],
	    [ '#8200FF', '#780041' ],
	    [ '#4A32FF', '#C41E0E' ],
	    [ '#C41E0E', '#F69B00' ],
	],

	BLOCK_PIXEL_SIZE = 3,

	PIECE_COLORS = {
		T: 1,
		J: 2,
		Z: 3,
		O: 1,
		S: 2,
		L: 3,
		I: 1
	}
;

DAS_THRESHOLDS[-1] = 'absent';