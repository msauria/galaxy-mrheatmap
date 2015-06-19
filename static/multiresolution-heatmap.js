function reload( canvas, config ){
    updateForm( config );
    fetchData( config )
        .done( function( resp ){
            render( canvas, config, resp.data );
        });
}

function setUp( canvas, config ){
    config = _.defaults( config, {
        start1      : 0,
        start2      : 0,
        window_size : 100000,
        resolution  : 20000,

        canvasWidth : 320,
        canvasHeight: 320,
        minColor    : '002288',
        maxColor    : 'ffffff'
    });
    canvas.setAttribute( 'width', config.canvasWidth );
    canvas.setAttribute( 'height', config.canvasHeight );

    var wheelZoomAccumulator = 0;
    var debouncedLoad = _.debounce( function(){
            config.window_size -= wheelZoomAccumulator * 1000;
            wheelZoomAccumulator = 0;
            console.debug( 'window:size:', config.window_size );
            reload( canvas, config );
        }, 300 );

    panAndZoom( canvas, {
        onpan   : _.debounce( function( delta, ev ){
            console.debug( 'onpan', delta );
            var percDelta = {
                x: delta.x / config.canvasWidth,
                y: delta.y / config.canvasHeight
            };
            console.debug( percDelta );
            var sequenceDelta = {
                x: percDelta.x * config.window_size,
                y: percDelta.y * config.window_size
            };
            console.debug( sequenceDelta );
            config.start1 -= sequenceDelta.x;
            config.start2 -= sequenceDelta.y;
            reload( canvas, config );
        }, 300 ),

        onzoom  : function( delta, ev ){
            console.debug( 'onzoom', delta );
            wheelZoomAccumulator += delta.zoomY;
            console.debug( 'wheelZoomAccumulator:', wheelZoomAccumulator );

            debouncedLoad( delta, ev );
        }
    });
    return config;
}
