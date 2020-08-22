// includes the crop ratio based on the standard template

const tWidth = 512;
const tHeight = 448;

// crops in [x, y, w, h]
const normalized_crops = {
	score: [364, 112, 94, 14],
	lines: [304, 42, 46, 14],
	level: [416, 320, 30, 14]
	field: [192, 80, 160, 320],
	stats: [96, 176, 46, 206],
	preview: [],
	color1: [76, 212, 10, 10],
	color2: [76, 246, 10, 10],
	instant_das: [],
	cur_piece_das: [],
	cur_piece: [],
};

// make everything ratios based on template dimensions
// todo: howto account for deinterlacing?
for (const coords of Object.values(normalized_crops)) {
	if (coords.length <= 0) continue;

	coords[0] /= tWidth;
	coords[1] /= tWidth;
	coords[2] /= tHeight;
	coords[3] /= tHeight;
}
