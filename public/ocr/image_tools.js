// bicubic interpolation taken from
// https://www.strauss-engineering.ch/js-bilinear-interpolation.html

function ivect(ix, iy, w) {
    // byte array, r,g,b,a
    return((ix + w * iy) * 4);
}

var BicubicInterpolation = (function(){
    return function(x, y, values){
        var i0, i1, i2, i3;

        i0 = TERP(x, values[0][0], values[1][0], values[2][0], values[3][0]);
        i1 = TERP(x, values[0][1], values[1][1], values[2][1], values[3][1]);
        i2 = TERP(x, values[0][2], values[1][2], values[2][2], values[3][2]);
        i3 = TERP(x, values[0][3], values[1][3], values[2][3], values[3][3]);
        return TERP(y, i0, i1, i2, i3);
    };
    /* Yay, hoisting! */
    function TERP(t, a, b, c, d){
        return 0.5 * (c - a + (2.0*a - 5.0*b + 4.0*c - d + (3.0*(b - c) + d - a)*t)*t)*t + b;
    }
})();


function bicubic(srcImg, destImg) {
    var yscale = destImg.height / srcImg.height;
    var xscale = destImg.width / srcImg.width;

    var i, j;
    var dx, dy;
    var repeatX, repeatY;
    var offset_row0, offset_row1, offset_row2, offset_row3;
    var offset_col0, offset_col1, offset_col2, offset_col3;
    var red_pixels, green_pixels, blue_pixels, alpha_pixels;
    for (i = 0; i < destImg.height; ++i) {
        iyv = i / yscale;
        iy0 = Math.floor(iyv);

        // We have to special-case the pixels along the border and repeat their values if neccessary
        repeatY = 0;
        if(iy0 < 1) repeatY = -1;
        else if(iy0 > srcImg.height - 3) repeatY = iy0 - (srcImg.height - 3);

        for (j = 0; j < destImg.width; ++j) {
            ixv = j / xscale;
            ix0 = Math.floor(ixv);

            // We have to special-case the pixels along the border and repeat their values if neccessary
            repeatX = 0;
            if(ix0 < 1) repeatX = -1;
            else if(ix0 > srcImg.width - 3) repeatX = ix0 - (srcImg.width - 3);

            offset_row1 = ((iy0)   * srcImg.width + ix0) * 4;
            offset_row0 = repeatY < 0 ? offset_row1 : ((iy0-1) * srcImg.width + ix0) * 4;
            offset_row2 = repeatY > 1 ? offset_row1 : ((iy0+1) * srcImg.width + ix0) * 4;
            offset_row3 = repeatY > 0 ? offset_row2 : ((iy0+2) * srcImg.width + ix0) * 4;

            offset_col1 = 0;
            offset_col0 = repeatX < 0 ? offset_col1 : -4;
            offset_col2 = repeatX > 1 ? offset_col1 : 4;
            offset_col3 = repeatX > 0 ? offset_col2 : 8;

            //Each offset is for the start of a row's red pixels
            red_pixels = [[srcImg.data[offset_row0+offset_col0], srcImg.data[offset_row1+offset_col0], srcImg.data[offset_row2+offset_col0], srcImg.data[offset_row3+offset_col0]],
                              [srcImg.data[offset_row0+offset_col1], srcImg.data[offset_row1+offset_col1], srcImg.data[offset_row2+offset_col1], srcImg.data[offset_row3+offset_col1]],
                              [srcImg.data[offset_row0+offset_col2], srcImg.data[offset_row1+offset_col2], srcImg.data[offset_row2+offset_col2], srcImg.data[offset_row3+offset_col2]],
                              [srcImg.data[offset_row0+offset_col3], srcImg.data[offset_row1+offset_col3], srcImg.data[offset_row2+offset_col3], srcImg.data[offset_row3+offset_col3]]];
            offset_row0++;
            offset_row1++;
            offset_row2++;
            offset_row3++;
            //Each offset is for the start of a row's green pixels
            green_pixels = [[srcImg.data[offset_row0+offset_col0], srcImg.data[offset_row1+offset_col0], srcImg.data[offset_row2+offset_col0], srcImg.data[offset_row3+offset_col0]],
                              [srcImg.data[offset_row0+offset_col1], srcImg.data[offset_row1+offset_col1], srcImg.data[offset_row2+offset_col1], srcImg.data[offset_row3+offset_col1]],
                              [srcImg.data[offset_row0+offset_col2], srcImg.data[offset_row1+offset_col2], srcImg.data[offset_row2+offset_col2], srcImg.data[offset_row3+offset_col2]],
                              [srcImg.data[offset_row0+offset_col3], srcImg.data[offset_row1+offset_col3], srcImg.data[offset_row2+offset_col3], srcImg.data[offset_row3+offset_col3]]];
            offset_row0++;
            offset_row1++;
            offset_row2++;
            offset_row3++;
            //Each offset is for the start of a row's blue pixels
            blue_pixels = [[srcImg.data[offset_row0+offset_col0], srcImg.data[offset_row1+offset_col0], srcImg.data[offset_row2+offset_col0], srcImg.data[offset_row3+offset_col0]],
                              [srcImg.data[offset_row0+offset_col1], srcImg.data[offset_row1+offset_col1], srcImg.data[offset_row2+offset_col1], srcImg.data[offset_row3+offset_col1]],
                              [srcImg.data[offset_row0+offset_col2], srcImg.data[offset_row1+offset_col2], srcImg.data[offset_row2+offset_col2], srcImg.data[offset_row3+offset_col2]],
                              [srcImg.data[offset_row0+offset_col3], srcImg.data[offset_row1+offset_col3], srcImg.data[offset_row2+offset_col3], srcImg.data[offset_row3+offset_col3]]];
            /*
            offset_row0++;
            offset_row1++;
            offset_row2++;
            offset_row3++;
            //Each offset is for the start of a row's alpha pixels
            alpha_pixels =[[srcImg.data[offset_row0+offset_col0], srcImg.data[offset_row1+offset_col0], srcImg.data[offset_row2+offset_col0], srcImg.data[offset_row3+offset_col0]],
                              [srcImg.data[offset_row0+offset_col1], srcImg.data[offset_row1+offset_col1], srcImg.data[offset_row2+offset_col1], srcImg.data[offset_row3+offset_col1]],
                              [srcImg.data[offset_row0+offset_col2], srcImg.data[offset_row1+offset_col2], srcImg.data[offset_row2+offset_col2], srcImg.data[offset_row3+offset_col2]],
                              [srcImg.data[offset_row0+offset_col3], srcImg.data[offset_row1+offset_col3], srcImg.data[offset_row2+offset_col3], srcImg.data[offset_row3+offset_col3]]];
            /**/

            // overall coordinates to unit square
            dx = ixv - ix0; dy = iyv - iy0;

            idxD = ivect(j, i, destImg.width);

            destImg.data[idxD] = BicubicInterpolation(dx, dy, red_pixels);

            destImg.data[idxD+1] =  BicubicInterpolation(dx, dy, green_pixels);

            destImg.data[idxD+2] = BicubicInterpolation(dx, dy, blue_pixels);

            // not needed
            destImg.data[idxD+3] = 255;
            // destImg.data[idxD+3] = BicubicInterpolation(dx, dy, alpha_pixels);
        }
    }
}

function crop(source, x, y, w, h, target=null) {
    if (!target) {
        target = new ImageData(w, h);
    }

    for (let row_idx = 0; row_idx < h; row_idx++) {
        const start_idx = ((row_idx + y) * source.width + x) << 2;
        const slice = source.data.subarray( // subarray allow passing by references
            start_idx,
            start_idx + w * 4
        );
        target.data.set(slice, row_idx * w * 4);
    }

    return target;
}