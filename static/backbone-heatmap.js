
// ============================================================================
/** Observable for source of data (which dataset to pull data from) */
var MRHSource = ComposableModel.extend({
    defaults : {
        dataset_id : null,
    },

    /** Override to include headers and chroms */
    initialize : function( attributes, options ){
        ComposableModel.prototype.initialize.call( this, attributes, options );
        this._attributeToProperty( 'chroms', attributes.chroms );
        this._attributeToProperty( 'headers', attributes.headers );
    },

    /** return the current header based on chrom1 */
    availableChroms : function(){
        return this.chroms.chromosomes;
    },

    toString : function(){ return 'MRHSource'; },
});


// ----------------------------------------------------------------------------
/** Observable for what data to pull (settings sent to server-side provider) */
var MRHProvider = ComposableModel.extend({

    type : 'json',

    defaults : {
        chrom1 : null,
        start1 : null,
        stop1  : null,
        chrom2 : null,
        start2 : null,
        stop2  : null,
        // min_resolution : null,
        // max_resolution : null,
    },

    toString : function(){ return 'MRHProvider'; },
});


// ----------------------------------------------------------------------------
/** Model composed of both a data source and dataprovider settings */
var MRHDataConfig = ComposableModel.extend({

    composedOf : {
        source   : MRHSource,
        provider : MRHProvider,
    },

    /** Get data from the server using the source and provider settings */
    fetch : function( options ){
        var visualization = this,
            root = ( window.Galaxy? Galaxy.options.root : '/' ),
            url = root + 'api/datasets/' + this.get( 'dataset_id' ),
            params = { data_type : 'raw_data', provider : this.provider.type },
            resolutions = this._calcResolution( options );
        params = _.extend( params, this.toJSON(), resolutions );
        console.debug( params );
// TODO: cache xhr's for later abort when pan/zoom occurs during progressive fetching
        return jQuery.ajax( url, { data : params })
            .done( function( response ){
                console.info( 'data fetched:', response.data );
                window.data = response.data;
                visualization.trigger( 'data', response.data, this );
            })
            .fail( function(){
                console.error( arguments );
                visualization.trigger( 'error', arguments );
            });
    },

    _calcResolution : function( options ){
        var DEFAULT_RESOLUTION = 100,
            min_resolution = this.get( 'stop1' ) - this.get( 'start1' ) + 1;
        console.debug( '_calcResolution', options.resolution );
        return {
            min_resolution : min_resolution,
            max_resolution : Math.floor( ( min_resolution - 1 ) / ( options.resolution || DEFAULT_RESOLUTION ) )
        };
    },

    /** return the current header based on chrom1 */
    currentHeader : function(){
        // TODO: (? is chrom1 right?) - not chrom2 or depends?
        var currentChrom = this.provider.get( 'chrom1' );
        return this.source.headers[ currentChrom ];
    },

    toString : function(){ return 'MRHDataConfig'; },
});



// ----------------------------------------------------------------------------
/** Settings used for rendering: colors, sizes (non-data) */
var MRHRenderConfig = ComposableModel.extend({
    // instead of jsonableAttributes use (keys of) defaults
    defaults : {
        canvasWidth : 320,
        canvasHeight: 320,
        // minColor    : '002288',
        minColor    : '000000',
        maxColor    : 'ffffff'
    },

    toString : function(){ return 'MRHRenderConfig'; },
});


// ----------------------------------------------------------------------------
/** MRH configuration model composed of data (source and provider settings) and render (how to render the data) */
var MRHConfig = ComposableModel.extend({

    composedOf : {
        dataConfig   : MRHDataConfig,
        renderConfig : MRHRenderConfig,
    },

    /** fetch data by deferring to data config */
    fetch : function( options ){
        return this.dataConfig.fetch( options );
    },
    // TODO: save as Visualization

    toString : function(){ return 'MRHConfig'; },
});


// ============================================================================
/** Non-trackster visualization of MRH data */
var MRHStandaloneVisualization = Backbone.View.extend({

    model : MRHConfig,

    BLURRED_RATIO : 0.2,

    initialize : function( attributes, options ){
        this.zoom = 0.0;
        this.offset = { x : 0, y : 0 };
        this.setUp();
    },

    /** Convert mouse canvas coordinates x, y to sequence/locus coordinates
     *      NOTE: prone to small rounding errors
     */
    _mouseToSequenceCoords : function( x, y ){
        var modelJSON = this.model.toJSON(),
            sequenceWidth = modelJSON.stop1 - modelJSON.start1,
            sequenceHeight = modelJSON.stop2 - modelJSON.start2,
            percX = x / modelJSON.canvasWidth,
            percY = y / modelJSON.canvasHeight,
            sequenceX = percX * sequenceWidth,
            sequenceY = percY * sequenceHeight;
        return {
            x : modelJSON.start1 + sequenceX,
            y : modelJSON.start2 + sequenceY,
        };
    },

    /** Calculate new position and zoom level for dataConfig.provider viewport */
    _calcNewViewport : function( zoomCoords, zoomLevel ){
        var config = this.model.toJSON(),
            adjZoomLevel = zoomLevel * 1000,
            newWidth  = ( config.stop1 - config.start1 ) - adjZoomLevel,
            newHeight = ( config.stop2 - config.start2 ) - adjZoomLevel,
            halfWidth  = newWidth / 2,
            halfHeight = newHeight / 2,
            sequenceMouseCoords = this._mouseToSequenceCoords( zoomCoords.x, zoomCoords.y ),
            newStart1 = Math.floor( sequenceMouseCoords.x - halfWidth ),
            newStart2 = Math.floor( sequenceMouseCoords.y - halfHeight );
        return this._constrainViewport({
            start1 : newStart1,
            stop1 : newStart1 + newWidth,
            start2 : newStart2,
            stop2 : newStart2 + newHeight
        });
    },

    _constrainViewport : function( viewport ){
        // console.debug( 'constrainViewport:', viewport );
        var sequenceWidth = viewport.stop1 - viewport.start1,
            sequenceHeight = viewport.stop2 - viewport.start2,
            header = this.model.dataConfig.currentHeader();
        viewport.start1 = Math.max( viewport.start1, header.start );
        viewport.start1 = Math.min( viewport.start1, header.stop - sequenceWidth );
        viewport.stop1 = viewport.start1 + sequenceWidth;

        viewport.start2 = Math.max( viewport.start2, header.start );
        viewport.start2 = Math.min( viewport.start2, header.stop - sequenceHeight );
        viewport.stop2 = viewport.start2 + sequenceHeight;
        // console.debug( 'constrainViewport:', viewport );
        return viewport;
    },

    /** Add event listeners to the canvas for:
     *      panning: via mouse drag
     *      zooming: via mouse wheel or dblclick (alt+dblclick to zoom out)
     */
    setUp : function(){
        var visualization = this,
            config = this.model.toJSON(),
            canvas = this.$( 'canvas' );

        visualization.listenTo( visualization.model.dataConfig.provider, 'change', this.progressivelyRender, this );
        // visualization.listenTo( visualization.model.dataConfig, 'data', this.render, this );

        var wheelZoomAccumulator = 0,
            debouncedLoad = _.debounce( function( delta ){
                // console.debug( delta );
                visualization.model.set( visualization._calcNewViewport( delta, wheelZoomAccumulator ) );
                wheelZoomAccumulator = 0;
            }, 300 );

        panAndZoom( canvas, {
            onpan   : _.debounce( function( delta, ev ){
                // console.debug( 'onpan', delta );

                var config = visualization.model.toJSON(),
                    // header = visualization.model.dataConfig.currentHeader(),
                    sequenceWidth = config.stop1 - config.start1,
                    sequenceHeight = config.stop2 - config.start2,
                    percDelta = {
                        x: delta.x / config.canvasWidth,
                        y: delta.y / config.canvasHeight
                    };
                // console.debug( percDelta );

                var sequenceDelta = {
                        x: Math.floor( percDelta.x * sequenceWidth ),
                        y: Math.floor( percDelta.y * sequenceHeight )
                    };
                // console.debug( sequenceDelta );

                // TODO: doesn't work
                // var newViewport = visualization._constrainViewport({
                //     start1 : config.start1 - sequenceDelta.x,
                //     stop1  : config.stop1 - sequenceDelta.x,
                //     start2 : config.start2 - sequenceDelta.x,
                //     stop2  : config.stop2 - sequenceDelta.x,
                // });

                var newViewport = {};
                newViewport.start1 = Math.max( config.start1 - sequenceDelta.x, header.start );
                newViewport.start1 = Math.min( newViewport.start1, header.stop - sequenceWidth );
                // newViewport.start1 = config.start1 - sequenceDelta.x;
                newViewport.stop1 = newViewport.start1 + sequenceWidth;

                newViewport.start2 = Math.max( config.start2 - sequenceDelta.y, header.start );
                newViewport.start2 = Math.min( newViewport.start2, header.stop - sequenceHeight );
                // newViewport.start2 = config.start2 - sequenceDelta.y;
                newViewport.stop2 = newViewport.start2 + sequenceHeight;

                // console.debug( header.start, header.stop );
                // console.debug( newViewport.start1, newViewport.stop1 );
                // console.debug( newViewport.start2, newViewport.stop2 );

                visualization.model.set( newViewport );

            }, 300 ),

            onzoom  : function( delta, ev ){
                // console.debug( 'onzoom', delta );
                wheelZoomAccumulator += delta.zoomY;
                // console.debug( 'wheelZoomAccumulator:', wheelZoomAccumulator );
                debouncedLoad( delta, ev );
            }
        });

        this._setUpControls();
    },

    progressivelyRender : function(){
        var BLUR_FACTORS = [ 0.1, 0.2, 0.5 ],
            visualization = this,
            canvasSize = visualization.model.get( 'canvasWidth' );

        visualization._renderControls();
        BLUR_FACTORS.forEach( function( factor ){
            var resolution = Math.floor( canvasSize * factor );
            visualization.model.fetch({ resolution: resolution })
                .done( function( response ){ visualization._render( response.data ); });
        });
        // TODO: does this reliably happen last?
        visualization.model.fetch({ resolution: canvasSize })
            .done( function( response ){ visualization.render( response.data ); });
    },

    /** Update controls, the visualization itself, and the url */
    render : function( data ){
        console.debug( this + '.render:', arguments );
        this._renderControls();
        this.clearCanvas();
        this._render( data );

        // update url for copying if this is in its own top-level window
//TODO: add to progressive render
        if( window.parent === window && !this.embedded ){
            var params = jQuery.param( this.model.dataConfig.toJSON() ),
                newUrl = window.location.href.replace( /\?.*/, '?' + params );
            // console.debug( newUrl );
            window.history.pushState( null, null, newUrl );
        }
    },

    /** @type {Array} Objects describing the inputs that can be used to control the visualization */
    _controls : [
        // TODO: probably don't belong here
        { key: 'dataset_id', type : 'hidden' },

        { key: 'chrom1', label : 'Chromosome', type: 'select', options: [] },
        { key: 'start1', label : 'Coordinate 1 start', type : 'number', min : 0 },
        { key: 'stop1', label : 'Coordinate 1 stop', type : 'number', min : 0 },

        { key: 'chrom2', type: 'hidden' },
        { key: 'start2', label : 'Coordinate 2 start', type : 'number', min : 0 },
        { key: 'stop2', label : 'Coordinate 2 stop', type : 'number', min : 0  },

        // { key: 'min_resolution', label : 'Minimum resolution', type : 'number', min : 0 },
        // { key: 'max_resolution', label : 'Maximum resolution', type : 'number', min : 0 },
    ],

    _setUpControls : function(){
        var visualization = this;
        [ 'chrom1', 'chrom2' ].forEach( function( chromControlName ){
            var chromControlMap = _.findWhere( visualization._controls, { key: chromControlName });
            if( chromControlMap ){
                var availableChroms = visualization.model.dataConfig.source.availableChroms();
                chromControlMap.options = availableChroms;
                chromControlMap.selected = visualization.model.get( chromControlName );
            }
        });
    },

    /** Render/update the form with controls */
    _renderControls : function(){
        var $form = this.$( '.info form' );
        if( !$form.size() ){
            this.$( '.info' ).append( this._templateControls() );
        }
        this._updateControls();
    },

// TODO: factor form building out?
    /** Build the control form dom */
    _templateControls : function(){
        var visualization = this,
            $form = $( '<form/>' ),
            $table = $( '<table/>' ).appendTo( $form );

        function selectBuilder( control ){
            var $select = $( '<select/>' ).attr({ name : control.key }),
                $options = control.options.map( function( optionName ){
                    var $option = $( '<option/>' ).attr({ value : optionName }).text( optionName );
                    if( optionName === control.selected ){
                        $option.prop( 'selected', true );
                    }
                    return $option;
                });
            $select.append( $options );
            if( $options.length < 2 ){
                $select.prop( 'disabled', true );
                $select.attr( 'title', 'There are no other chromosomes available' );
            }
            return $select;
        }

        function inputBuilder( control ){
            var $input = $( '<input/>' ).attr({ id : control.key, name: control.key });
            _.each( _.omit( control, 'key', 'label' ), function( val, key ){
                $input.attr( key, val );
            });
            return $input;
        }

        this._controls.forEach( function( control ){
            if( control.type === 'hidden' ){
                $form.append( $( '<input/>' ).attr({ type : 'hidden', name : control.key }) );

            } else {
                var $tr = $( '<tr/>' ).appendTo( $table ),
                    $label = $( '<label/>' ).text( control.label ).attr( 'for', control.key ),
                    $control = control.type === 'select'? selectBuilder( control ): inputBuilder( control );
                $tr.append([
                    $( '<td/>' ).append( $label ),
                    $( '<td/>' ).append( $control )
                ]);
            }
        });
        $form.append( $( '<button/>' ).attr( 'type', 'Submit' ).text( 'Draw' ) );
        return $form;
    },

    /** Update the control form values from the model */
    _updateControls : function(){
        var visualization = this,
            $form = this.$( '.info form' ),
            fields = [
                'dataset_id',
                'chrom1', 'start1', 'stop1',
                'chrom2', 'start2', 'stop2',
                // 'min_resolution', 'max_resolution'
            ];
        fields.forEach( function( name ){
            var $field = $form.find( '[name=' + name + ']' ),
                value = visualization.model.get( name );
            // console.debug( name, value );
            $field.val( value );
        });
    },

    /** render the visualization */
    _render : function( data ){
        // TODO: needs refinement once the format is solid
        // console.debug( '_render:', data );
        data = data || [];
        var canvas = this.$( 'canvas' ).get( 0 ),
            config = this.model.toJSON(),
            header = this.model.dataConfig.currentHeader(),
            context = canvas.getContext( '2d' ),
            gradient = new LinearRamp(
                config.minColor, config.maxColor,
                header.minscore, header.maxscore
            ),
            canvasWidth = config.canvasWidth,
            canvasHeight = config.canvasHeight,
            regionWidth = config.stop1 - config.start1,
            regionHeight = config.stop2 - config.start2,
            offset = { x : 0, y : 0 };

        // console.debug(
        //     config.minColor, config.maxColor,
        //     config.expected_min, config.expected_max
        // );

        // these + offset can help UX/feedback on pan or zoom until the ajax returns
        if( this.zoom ){
            canvasWidth *= this.zoom;
            canvasHeight *= this.zoom;
            // console.debug( 'setting via zoom' );
        }

        var viewportToCanvasRatioX = canvasWidth / regionWidth,
            viewportToCanvasRatioY = canvasHeight / regionHeight;
        // console.debug( viewportToCanvasRatioX, viewportToCanvasRatioY );

        data.forEach( function( d, i ){
            var x1 = Math.floor( ( d.x1 - config.start1 ) * viewportToCanvasRatioX ),
                y1 = Math.floor( ( d.y1 - config.start2 ) * viewportToCanvasRatioY ),
                x2 = Math.floor( ( d.x2 - config.start1 ) * viewportToCanvasRatioX ),
                y2 = Math.floor( ( d.y2 - config.start2 ) * viewportToCanvasRatioY ),
                width = x2 - x1,
                height = y2 - y1,
                color = gradient.map_value( d.value );

            // if( i < 10 ){
            //     console.debug( '#' + i, d.x1, d.y1, d.x2, d.y2, d.x2 - d.x1, d.y2 - d.y1, d.value );
            //     console.debug( '#' + i, x1, y1, x2, y2, width, height, color );
            // }

            context.fillStyle = color;
            // context.fillStyle = 'rgba( 0, 0, 0, 0.1 )';
            context.fillRect( x1, y1, width, height );
        });
    },

    clearCanvas : function(){
        var canvas = this.$( 'canvas' ).get( 0 ),
            context = canvas.getContext( '2d' ),
            canvasWidth = this.model.get( 'canvasWidth' ),
            canvasHeight = this.model.get( 'canvasHeight' );

        canvas.setAttribute( 'width', canvasWidth );
        canvas.setAttribute( 'height', canvasHeight );

        context.fillStyle = '#888888';
        context.fillRect( 0, 0, canvasWidth, canvasHeight );
    },

    events : {
        'change select[name="chrom1"]' : function( ev ){
            // when chrom1 changes - match chrom2 to it
            this.$( '[name="chrom2"]' ).val( this.$( '[name="chrom1"]' ).val() );
            console.debug( this.$( '[name="chrom2"]' ).val() );
        }
    },

    /** Four square test pattern to check rendering */
    testPattern : function(){
        var config = this.model.toJSON(),
            halfSize = config.window_size / 2;
        this.render([
            {
                // upper left quad
                x1: config.start1,
                y1: config.start2,
                x2: config.start1 + halfSize,
                y2: config.start2 + halfSize,
                value : -8
            },
            {
                // upper right quad
                x1: config.start1 + halfSize,
                y1: config.start2,
                x2: config.start1 + config.window_size,
                y2: config.start2 + halfSize,
                value : -3
            },
            {
                // lower left quad
                x1: config.start1,
                y1: config.start2 + halfSize,
                x2: config.start1 + halfSize,
                y2: config.start2 + config.window_size,
                value : 3
            },
            {
                // upper right quad
                x1: config.start1 + halfSize,
                y1: config.start2 + halfSize,
                x2: config.start1 + config.window_size,
                y2: config.start2 + config.window_size,
                value : 8
            }
        ]);
    },

    toString : function(){ return 'MRHStandaloneVisualization'; },
});
