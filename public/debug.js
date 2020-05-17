let timeline_idx = 0;

function splitField(field) {
	let rows = [], idx=0;

	do {
		row = field.substr(idx, 10);
		rows.push(row);
		idx += 10
	}
	while(idx<200);

	return rows.join('\n');
}

function oneFrame(debug=false) {
	const
		frame1_copy = {...frames[timeline_idx]},
		field1 = frame1_copy.field,

		frame2_copy = {...frames[timeline_idx+1]},
		field2 = frame2_copy.field;

	delete frame1_copy.field;
	delete frame2_copy.field;

	frame1_txt = ''
		+ timeline_idx
		+ ' '
		+ field1.replace(/0+/g, '').length
		+ '\n'
		+ JSON.stringify(frame1_copy)
		+ ' '
		+ splitField(field1);

	frame2_txt = ''
		+ (timeline_idx + 1)
		+ ' '
		+ field2.replace(/0+/g, '').length
		+ '\n'
		+ JSON.stringify(frame2_copy)
		+ ' '
		+ splitField(field2);

	document.querySelector('#cur_frame').value = frame1_txt;
	document.querySelector('#next_frame').value = frame2_txt;

	onFrame(frames[timeline_idx++], debug);
}

document.querySelector('#goto_next_frame').addEventListener('click', () => {
	oneFrame();
});

document.querySelector('#goto_next_frame_debug').addEventListener('click', () => {
	oneFrame(true);
});

let play_ID

function play() {
	function playFrame() {
		oneFrame()
		play_ID = window.requestAnimationFrame(playFrame);
	}

	playFrame();
}

function stop() {
	window.cancelAnimationFrame(play_ID);
}

document.querySelector('#play').addEventListener('click', play);
document.querySelector('#stop').addEventListener('click', stop);

document.querySelector('#skip .btn').addEventListener('click', () => {
	const
		input = document.querySelector('#skip .to').value,
		to = parseInt(input, 10);

	if (isNaN(to)) {
		console.error('invalid input', input);
		return;
	}

	while (timeline_idx < to ) {
		oneFrame();
	}
});
