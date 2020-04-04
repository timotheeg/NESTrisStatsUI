if (!CanvasRenderingContext2D.prototype.clear) {
	CanvasRenderingContext2D.prototype.clear = function (preserveTransform) {
		if (preserveTransform) {
			this.save();
			this.setTransform(1, 0, 0, 1, 0, 0);
		}

		this.clearRect(0, 0, this.canvas.width, this.canvas.height);

		if (preserveTransform) {
			this.restore();
		}
	};
}

function getPercent(ratio) {
	const percent = Math.round(ratio * 100);

	return percent >= 100 ? '100' : (percent).toString().padStart(2, '0') + '%';
}

function css_size(css_pixel_width) {
	return parseInt(css_pixel_width.replace(/px$/, ''), 10)
}

function peek(arr) {
	return arr[arr.length - 1];
}
