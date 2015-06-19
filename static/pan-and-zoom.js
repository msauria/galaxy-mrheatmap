function panAndZoom( target, options ){
    options = jQuery.extend( {
        dblclickZoom : 500
    }, options );
    console.debug( options );

    function getElementMouseCoords( event, element ){
        // console.debug( event.offsetX, event.offsetY );
        // console.debug( event.originalEvent.offsetX, event.originalEvent.offsetY );
        // console.debug( event.pageX, event.pageY );
        // console.debug( event.originalEvent.pageX, event.originalEvent.pageY );
        // console.debug( event.clientX, event.clientY );
        // console.debug( event.originalEvent.clientX, event.originalEvent.clientY );
        // jq's offsetX,Y is what we want (x,y rel. to element)
        var mouseCoords = { x: event.offsetX, y: event.offsetY };
        // but is only implemented in some browsers - if undefined, calc here
        if( mouseCoords.x === undefined ){
            var elementOffset = $( element ).offset();
            mouseCoords.x = event.originalEvent.pageX - elementOffset.left;
            mouseCoords.y = event.originalEvent.pageY - elementOffset.top;
        }
        return mouseCoords;
    }

    if( options.onpan ){
        var lastCoords = { x: null, y: null },
            mouseMove = function _mouseMove( ev ){
                // console.debug( ev.pageX, ev.pageY, ev );
                var currentCoords = getElementMouseCoords( ev, this );
                    delta = {
                        x: currentCoords.x - lastCoords.x,
                        y: currentCoords.y - lastCoords.y
                    };
                // console.debug( 'last:', lastCoords, 'current:', currentCoords, 'delta:', delta );
                options.onpan.call( this, delta, ev );
            };

        $( target )
            .mousedown( function( ev ){
                console.debug( 'mousedown:', ev );
                lastCoords = getElementMouseCoords( ev, this );
                $( this ).on( 'mousemove', mouseMove );
            })
            .mouseup( function( ev ){
                console.debug( 'mouseup:', ev );
                $( this ).off( 'mousemove', mouseMove );
            });
    }

    if( options.onzoom ){
        $( target )
            .on( 'wheel', function( ev ){
                // console.debug( 'wheel:', ev.originalEvent.deltaX, ev.originalEvent.deltaY, ev );
                ev.preventDefault();
                ev.stopPropagation();

                if( ev.originalEvent.deltaY ){
                    var zoomData = getElementMouseCoords( ev, this );
                    zoomData.zoomY = -ev.originalEvent.deltaY;
                    options.onzoom.call( this, zoomData, ev );
                }
            })
            .on( 'dblclick', function( ev ){
                // console.debug( 'dbclick:', ev );
                ev.preventDefault();
                ev.stopPropagation();
                //NOTE: dblclick triggers mousedown,up twice

                var zoomData = getElementMouseCoords( ev, this );
                zoomData.zoomY = ev.altKey? -( options.dblclickZoom ) : options.dblclickZoom;
                options.onzoom.call( this, zoomData, ev );
            });
    }
}

