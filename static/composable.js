
// ----------------------------------------------------------------------------
/** Observable for source of data (which dataset to pull data from) */
var ComposableModel = Backbone.Model.extend({

    composedOf : {
        // property -> model class
    },

    initialize : function( attributes, options ){
        // console.debug( this + '.initialize', attributes, options );
        this._compose( attributes );
    },

    _compose : function( attributes ){
        var composable = this;
        // TODO: allow functions (overriding this section on a class-by-class basis)
        _.each( composable.composedOf, function( class_, key ){
            // console.debug( class_, key );
            var attribute = attributes[ key ],
                submodel = attribute instanceof Backbone.Model? attribute : new class_( attribute || {} );
            submodel.parent = composable;
            composable._attributeToProperty( key, submodel );
            composable.listenTo( submodel, {
                'change' : function(){
                    // console.debug( 'chang' );
                    // console.debug( composable );
                    // console.debug( submodel );
                    console.debug( arguments );
                }
            }, composable );
        });
    },

    _attributeToProperty : function( name, value ){
        // remove from model attributes and place as direct property
        var property = value || this.get( name );
        this.unset( name, { silent: true });
        this[ name ] = property;
        return this[ name ];
    },

    submodels : function(){
        var composable = this,
            submodels = {};
        _.each( _.keys( this.composedOf ), function( key ){
            submodels[ key ] = composable[ key ];
        });
        return submodels;
    },

    /** Build json from sub-models and overwrite with local attributes */
    toJSON : function(){
        var composable = this,
            json = {};
        Object.keys( composable.composedOf ).forEach( function( key ){
            var submodel = composable[ key ];
            _.extend( json, submodel.toJSON() );
        });
        // finally the local model attributes (which may override the submodel attributes)
        var localAttributes = Backbone.Model.prototype.toJSON.call( this );
        _.extend( json, _.pick( localAttributes, _.keys( this.defaults ) ) );
        return json;
    },

    has : function( name ){
        if( Backbone.Model.prototype.has.call( this, name ) ){ return true; }
        var submodelKeys = Object.keys( this.composedOf );
        for( var i=0; i<submodelKeys.length; i++ ){
            var submodel = this[( submodelKeys[ i ] )];
            if( submodel && submodel.has( name ) ){ return true; }
        }
        return false;
    },

    get : function( name ){
        var got = Backbone.Model.prototype.get.call( this, name );
        if( got !== undefined ){
            return got;
        }
        var submodelKeys = Object.keys( this.composedOf );
        for( var i=0; i<submodelKeys.length; i++ ){
            var submodel = this[( submodelKeys[ i ] )];
            if( submodel ){
                got = submodel.get( name );
                if( got !== undefined ){
                    return got;
                }
            }
        }
        return undefined;
    },

    set : function( name, val, options ){
        // TODO: someway to constrain these to bounds (max/min) - can't use parse
        // console.debug( this + '(composable).set:', name, val, options );
        options = options || {};

        if( options.local ){
            return Backbone.Model.prototype.set.call( this, name, val, options );
        }

        var composable = this,
            submodelKeys = Object.keys( composable.composedOf );
        if( typeof name === 'string' ){
            for( var i=0; i<submodelKeys.length; i++ ){
                var submodel = composable[( submodelKeys[ i ] )];
                if( submodel && submodel.has( name ) ){
                    return submodel.set( name, val, options );
                }
            }
            return Backbone.Model.prototype.set.call( composable, name, val, options );
        }

        var setObject = name;
        _.each( composable.submodels(), function( submodel, submodelKey ){
            // console.debug( '\tchecking:', submodelKey, submodel );
            var submodelAttrKeys = _.filter( _.keys( setObject ), function( attrKey ){
                var isLocallySet = composable.attributes.hasOwnProperty( attrKey );
                // console.debug( '\t\t', attrKey, !isLocallySet, !!submodel, submodel && submodel.has( attrKey ) );
                return ( !isLocallySet && submodel && submodel.has( attrKey ) );
            });
            // console.debug( '\tfound in submodel:', submodelKey, submodelAttrKeys, _.pick( setObject, submodelAttrKeys ) );
            // console.debug( '\t', _.omit( setObject, submodelAttrKeys ) );
            if( submodel ){
                var submodelAttributes = _.pick( setObject, submodelAttrKeys );
                submodel.set( submodelAttributes, options );
            }
            setObject = _.omit( setObject, submodelAttrKeys );
            // console.debug( '\tsetObject:', setObject );
        });
        // console.debug( 'setObject:', setObject );
        return Backbone.Model.prototype.set.call( composable, setObject, val, options );
    },
});
