// pulled from trackster
var Color = function (rgb, a) {
    /**
     * The end goal here, is to parse the arguments
     * into an integer triplet, such as `128, 255, 0`
     *
     * This facilitates operations and conversions.
     */
    if (Array.isArray(rgb)) {
        this.rgb = rgb;
    } else if (rgb.length == 6) {
        this.rgb = rgb.match(/.{2}/g).map(function (c) {
            return parseInt(c, 16);
        });
    } else if (rgb.length == 7) {
        this.rgb = rgb.substring(1,7).match(/.{2}/g).map(function (c) {
            return parseInt(c, 16);
        });
    } else {
        this.rgb = rgb.split('').map(function (c) {
            return parseInt(c + c, 16);
        });
    }
    this.alpha = typeof(a) === 'number' ? a : 1;
};
Color.prototype = {
    eval: function () { return this; },

    //
    // If we have some transparency, the only way to represent it
    // is via `rgba`. Otherwise, we use the hex representation,
    // which has better compatibility with older browsers.
    // Values are capped between `0` and `255`, rounded and zero-padded.
    //
    toCSS: function () {
        if (this.alpha < 1.0) {
            return "rgba(" + this.rgb.map(function (c) {
                return Math.round(c);
            }).concat(this.alpha).join(', ') + ")";
        } else {
            return '#' + this.rgb.map(function (i) {
                i = Math.round(i);
                i = (i > 255 ? 255 : (i < 0 ? 0 : i)).toString(16);
                return i.length === 1 ? '0' + i : i;
            }).join('');
        }
    },

    toHSL: function () {
        var r = this.rgb[0] / 255,
            g = this.rgb[1] / 255,
            b = this.rgb[2] / 255,
            a = this.alpha;

        var max = Math.max(r, g, b), min = Math.min(r, g, b);
        var h, s, l = (max + min) / 2, d = max - min;

        if (max === min) {
            h = s = 0;
        } else {
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2;               break;
                case b: h = (r - g) / d + 4;               break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s, l: l, a: a };
    },

    toARGB: function () {
        var argb = [Math.round(this.alpha * 255)].concat(this.rgb);
        return '#' + argb.map(function (i) {
            i = Math.round(i);
            i = (i > 255 ? 255 : (i < 0 ? 0 : i)).toString(16);
            return i.length === 1 ? '0' + i : i;
        }).join('');
    },

    mix: function (color2, weight) {
        color1 = this;

        var p = weight; // .value / 100.0;
        var w = p * 2 - 1;
        var a = color1.toHSL().a - color2.toHSL().a;

        var w1 = (((w * a == -1) ? w : (w + a) / (1 + w * a)) + 1) / 2.0;
        var w2 = 1 - w1;

        var rgb = [color1.rgb[0] * w1 + color2.rgb[0] * w2,
                   color1.rgb[1] * w1 + color2.rgb[1] * w2,
                   color1.rgb[2] * w1 + color2.rgb[2] * w2];

        var alpha = color1.alpha * p + color2.alpha * (1 - p);

        return new Color(rgb, alpha);
    }
};

var LinearRamp = function( start_color, end_color, start_value, end_value ) {
    /**
     * Simple linear gradient
     */
    this.start_color = new Color( start_color );
    this.end_color = new Color( end_color );
    this.start_value = start_value;
    this.end_value = end_value;
    this.value_range = end_value - start_value;
};

LinearRamp.prototype.map_value = function( value ) {
    value = Math.max( value, this.start_value );
    value = Math.min( value, this.end_value );
    value = ( value - this.start_value ) / this.value_range;
    // HACK: just red for now
    // return "hsl(0,100%," + (value * 100) + "%)"
    return this.start_color.mix( this.end_color, 1 - value ).toCSS();
};

