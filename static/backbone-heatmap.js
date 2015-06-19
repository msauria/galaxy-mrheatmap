/** Observable for source of data (which dataset to pull data from) */
var MRHSource = Backbone.Model.extend({

    /** @type {Array} what attributes of the overall config does this model control */
    jsonableAttributes : [
        'dataset_id'
    ],

    /** Override to jsonify only desired attributes (jsonableAttributes) */
    toJSON : function(){
        var json = Backbone.Model.prototype.toJSON.call( this );
        return _.pick( json, this.jsonableAttributes );
    }
});

/** Observable for what data to pull (settings sent to server-side provider) */
var MRHProvider = Backbone.Model.extend({

    /** @type {Array} what attributes of the overall config does this model control */
    jsonableAttributes : [
        'start1', 'start2', 'window_size', 'min_resolution', 'max_resolution', 'expected_min', 'expected_max'
    ],

    /** Override to jsonify only desired attributes (jsonableAttributes) */
    toJSON : function(){
        var json = Backbone.Model.prototype.toJSON.call( this );
        return _.pick( json, this.jsonableAttributes );
    }
});

/** Model composed of both a data source and dataprovider settings */
var MRHDataConfig = Backbone.Model.extend({

    /** @type {Array} what attributes of the overall config does this model control */
    jsonableAttributes : [
        // in this case DataConfig has no attrs of it's own and uses the sub-models
    ],

    /** Set up source and provider */
    initialize : function( attributes, options ){
        this.setSource( attributes.source );
        this.setProvider( attributes.provider );
    },

    /** Set source to either model or json and remove from model attributes */
    setSource : function( source ){
        this.source = source instanceof Backbone.Model? source : new MRHSource( source || {} );
        this.unset( 'source', { silent: true });
        this.source.on( 'change', function(){ console.debug( 'MRHData.source.change:', arguments ); } );
        return this.source;
    },

    /** Set provider to either model or json and remove from model attributes */
    setProvider : function( provider ){
        this.provider = provider instanceof Backbone.Model? provider : new MRHProvider( provider || {} );
        this.unset( 'provider', { silent: true });
        this.provider.on( 'change', function(){ console.debug( 'MRHData.provider.change:', arguments ); } );
        return this.provider;
    },

    /** Override to defer to sub-models if possible */
    get : function( name ){
        var got = Backbone.Model.prototype.get.call( this, name );
        if( got !== undefined ){
            return got;
        }
        got = this.source.get( name );
        if( got !== undefined ){
            return got;
        }
        got = this.provider.get( name );
        if( got !== undefined ){
            return got;
        }
    },
    // TODO: has, set

    /** Build json from sub-models and overwrite with local attributes */
    toJSON : function(){
        var sourceJSON = this.source.toJSON(),
            providerJSON = this.provider.toJSON(),
            json = Backbone.Model.prototype.toJSON.call( this );
        json = _.pick( json, this.jsonableAttributes );
        return _.extend( {}, sourceJSON, providerJSON, json );
    },

    /** Get data from the server using the source and provider settings */
    fetch : function(){
        var visualization = this,
            root = ( window.Galaxy? Galaxy.options.root : '/' ),
            url = root + 'api/datasets/' + this.get( 'dataset_id' ),
            params = { data_type : 'raw_data', provider : 'json' },
            xhr = jQuery.ajax( url, { data : _.extend( params, this.toJSON() ) });
        return xhr
            .done( function( response ){
                visualization.trigger( 'data', this, response.data );
            })
            .fail( function(){
                visualization.trigger( 'error', arguments );
            });
    }
});

/** Settings used for rendering: colors, sizes (non-data) */
var MRHRenderConfig = Backbone.Model.extend({

    // instead of jsonableAttributes use (keys of) defaults
    defaults : {
        canvasWidth : 320,
        canvasHeight: 320,
        minColor    : '002288',
        maxColor    : 'ffffff'
    },

    /** Override to jsonify only desired attributes (keys of defaults) */
    toJSON : function(){
        var json = Backbone.Model.prototype.toJSON.call( this );
        return _.pick( json, _.keys( this.defaults ) );
    }
});

// TODO: boilerplate between Config and DataConfig (composed model)
/** MRH configuration model composed of data (source and provider settings) and render (how to render the data) */
var MRHConfig = Backbone.Model.extend({

    /** @type {Array} what attributes of the overall config does this model control */
    jsonableAttributes : [
        // in this case DataConfig has no attrs of it's own and uses the sub-models
    ],

    /** Set up data and render config sub-models */
    initialize : function( attributes, options ){
        this.setDataConfig( attributes.dataConfig );
        this.setRenderConfig( attributes.renderConfig );
        console.debug( 'MRHConfig:', this.toJSON() );
    },

    /** Set data config to either model or json and remove from model attributes */
    setDataConfig : function( dataConfig ){
        this.dataConfig = dataConfig instanceof Backbone.Model? dataConfig
            : new MRHDataConfig( dataConfig || {} );
        this.unset( 'dataConfig', { silent: true });
        this.dataConfig.on( 'change', function(){ console.debug( 'MRHData.dataConfig.change:', arguments ); } );
        return this.dataConfig;
    },

    /** Set render config to either model or json and remove from model attributes */
    setRenderConfig : function( renderConfig ){
        this.renderConfig = renderConfig instanceof Backbone.Model? renderConfig
            : new MRHRenderConfig( renderConfig || {} );
        this.unset( 'renderConfig', { silent: true });
        this.renderConfig.on( 'change', function(){ console.debug( 'MRHData.renderConfig.change:', arguments ); } );
        return this.renderConfig;
    },

    /** Override to defer to sub-models if possible */
    get : function( name ){
        var got = Backbone.Model.prototype.get.call( this, name );
        if( got !== undefined ){
            return got;
        }
        got = this.dataConfig.get( name );
        if( got !== undefined ){
            return got;
        }
        got = this.renderConfig.get( name );
        if( got !== undefined ){
            return got;
        }
    },

    /** Build json from sub-models and overwrite with local attributes */
    toJSON : function(){
        var dataJSON = this.dataConfig.toJSON(),
            renderJSON = this.renderConfig.toJSON(),
            json = Backbone.Model.prototype.toJSON.call( this );
        json = _.pick( json, this.jsonableAttributes );
        return _.extend( {}, dataJSON, renderJSON, json );
    },

    /** fetch data by deferring to data config */
    fetch : function(){
        return this.dataConfig.fetch();
    }
    // TODO: save as Visualization

});

/** Non-trackster visualization of MRH data */
var MRHStandaloneVisualization = Backbone.View.extend({

    model : MRHConfig,

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
            percX = x / modelJSON.canvasWidth,
            percY = y / modelJSON.canvasHeight,
            sequenceX = percX * modelJSON.window_size,
            sequenceY = percY * modelJSON.window_size;
        return {
            x : modelJSON.start1 + sequenceX,
            y : modelJSON.start2 + sequenceY,
        };
    },

    /** Calculate new position and zoom level for dataConfig.provider viewport */
    _calcNewViewport : function( delta, newSize ){
        var modelJSON = this.model.toJSON(),
            halfSize = newSize / 2,
            sequenceMouseCoords = this._mouseToSequenceCoords( delta.x, delta.y );
        return {
            start1 : Math.floor( sequenceMouseCoords.x - halfSize ),
            start2 : Math.floor( sequenceMouseCoords.y - halfSize ),
            window_size : newSize
        };
    },

    /** Add event listeners to the canvas for:
     *      panning: via mouse drag
     *      zooming: via mouse wheel or dblclick (alt+dblclick to zoom out)
     */
    setUp : function(){
        var visualization = this,
            config = this.model.toJSON(),
            canvas = this.$( 'canvas' );

        var wheelZoomAccumulator = 0,
            debouncedLoad = _.debounce( function( delta ){
                console.debug( delta );
                var config = visualization.model.toJSON(),
                    newSize = config.window_size - wheelZoomAccumulator * 1000,
                    newProviderViewport = visualization._calcNewViewport( delta, newSize );
                visualization.model.dataConfig.provider.set( newProviderViewport );

                wheelZoomAccumulator = 0;
                console.debug( 'window:size:', newSize );

                visualization._updateControls();
                visualization.model.fetch()
                    .done( function( resp ){
                        visualization.render( resp.data );
                    });
            }, 300 );

        panAndZoom( canvas, {
            onpan   : _.debounce( function( delta, ev ){
                console.debug( 'onpan', delta );
                var config = visualization.model.toJSON(),
                    percDelta = {
                        x: delta.x / config.canvasWidth,
                        y: delta.y / config.canvasHeight
                    };
                console.debug( percDelta );
                var sequenceDelta = {
                    x: percDelta.x * config.window_size,
                    y: percDelta.y * config.window_size
                };
                console.debug( sequenceDelta );
                visualization.model.dataConfig.provider.set( 'start1', config.start1 - sequenceDelta.x );
                visualization.model.dataConfig.provider.set( 'start2', config.start2 - sequenceDelta.y );

                visualization._updateControls();
                visualization.model.fetch()
                    .done( function( resp ){
                        visualization.render( resp.data );
                    });
            }, 300 ),

            onzoom  : function( delta, ev ){
                // console.debug( 'onzoom', delta );
                wheelZoomAccumulator += delta.zoomY;
                // console.debug( 'wheelZoomAccumulator:', wheelZoomAccumulator );
                debouncedLoad( delta, ev );
            }
        });
        return config;
    },

    /** Update controls, the visualization itself, and the url */
    render : function( data ){
        this._renderControls();
        this._render( data );

        // update url for copying if this is in its own top-level window
        if( window.parent === window && !this.embedded ){
            var params = jQuery.param( this.model.dataConfig.toJSON() ),
                newUrl = window.location.href.replace( /\?.*/, '?' + params );
            console.debug( newUrl );
            window.history.pushState( null, null, newUrl );
        }
    },

    /** @type {Array} Objects describing the inputs that can be used to control the visualization */
    _controls : [
        // TODO: probably don't belong here
        { key: 'dataset_id', type : 'hidden' },

        { key: 'start1', label : 'Coordinate 1', type : 'number', min : 0 },
        { key: 'start2', label : 'Coordinate 2', type : 'number', min : 0 },
        { key: 'window_size', label : 'Window size', type : 'number', min : 0 },
        { key: 'min_resolution', label : 'Minimum resolution', type : 'number', min : 0 },
        { key: 'max_resolution', label : 'Maximum resolution', type : 'number', min : 0 },

        { key: 'expected_min', label : 'Expected minimum', type : 'number', min : -20, max : 20 },
        { key: 'expected_max', label : 'Expected maximum', type : 'number', min : -20, max : 20 },
    ],

    /** Render/update the form with controls */
    _renderControls : function(){
        var $form = this.$( '.info form' );
        if( !$form.size() ){
            this.$( '.info' ).append( this._templateControls() );
        }
        this._updateControls();
    },

    /** Build the control form dom */
    _templateControls : function(){
        var visualization = this,
            $form = $( '<form/>' ),
            $table = $( '<table/>' ).appendTo( $form );
        this._controls.forEach( function( control ){
            if( control.type === 'hidden' ){
                $form.append( $( '<input/>' ).attr({ type : 'hidden', name : control.key }) );
            } else {
                var $tr = $( '<tr/>' ).appendTo( $table ),
                    $label = $( '<label/>' ).text( control.label ).attr( 'for', control.key ),
                    $input = $( '<input/>' ).attr({ id : control.key, name: control.key });
                _.each( _.omit( control, 'key', 'label' ), function( val, key ){
                    $input.attr( key, val );
                });
                $tr.append([ $( '<td/>' ).append( $label ), $( '<td/>' ).append( $input ) ]);
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
                'dataset_id', 'start1', 'start2', 'window_size',
                'min_resolution', 'max_resolution', 'expected_min', 'expected_max' ];
        fields.forEach( function( name ){
            var $field = $form.find( 'input[name=' + name + ']' ),
                value = visualization.model.get( name );
            // console.debug( name, value );
            $field.val( value );
        });
    },

    /** render the visualization */
    _render : function( data ){
        // TODO: needs refinement once the format is solid
        console.debug( '_render:', data );
        data = data || [];
        var canvas = this.$( 'canvas' ).get( 0 ),
            config = this.model.toJSON(),
            context = canvas.getContext( '2d' ),
            gradient = new LinearRamp(
                config.minColor, config.maxColor,
                config.expected_min, config.expected_max
            ),
            canvasWidth = config.canvasWidth,
            canvasHeight = config.canvasHeight,
            offset = { x : 0, y : 0 },
            min = null,
            max = null;

        console.debug(
            config.minColor, config.maxColor,
            config.expected_min, config.expected_max
        );

        canvas.setAttribute( 'width', canvasWidth );
        canvas.setAttribute( 'height', canvasHeight );

        // these + offset can help UX/feedback on pan or zoom until the ajax returns
        if( this.zoom ){
            canvasWidth *= this.zoom;
            canvasHeight *= this.zoom;
            console.debug( 'setting via zoom' );
        }

        context.fillStyle = '888888';
        context.fillRect( 0, 0, config.canvasWidth, config.canvasHeight );
        var viewportToCanvasRatioX = config.canvasWidth / config.window_size,
            viewportToCanvasRatioY = config.canvasHeight / config.window_size;
        console.debug( viewportToCanvasRatioX, viewportToCanvasRatioY );

        data.forEach( function( d, i ){
            var x1 = Math.floor( ( d.x1 - config.start1 ) / viewportToCanvasRatioX ),
                y1 = Math.floor( ( d.y1 - config.start2 ) / viewportToCanvasRatioY ),
                x2 = Math.floor( ( d.x2 - config.start1 ) / viewportToCanvasRatioX ),
                y2 = Math.floor( ( d.y2 - config.start2 ) / viewportToCanvasRatioY ),
                width = x2 - x1,
                height = y2 - y1,
                color = gradient.map_value( d.value );

            if( i < 10 ){
                console.debug( '#' + i, d.x1, d.y1, d.x2, d.y2, d.x2 - d.x1, d.y2 - d.y1, d.value );
                console.debug( '#' + i, x1, y1, x2, y2, width, height, color );
            }

            context.fillStyle = color;
            context.fillRect( x1, y1, width, height );

            if( min === null || d.value < min ){ min = d.value; }
            if( max === null || d.value > max ){ max = d.value; }
        });
        console.debug( min, max );
    },

    events : {

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

});
