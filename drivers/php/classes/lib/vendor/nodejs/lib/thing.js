/* Transcoder api machine library */

exports.Thing = function() {
    
    var events      = {},
        intervals   = {},
        me          = this;
    
    /* Event listeners interface */
    
    me.bind = function (eventName, handlerFunction ) {
        events[ eventName ] = events[ eventName ] || [];
        events[ eventName ].push( handlerFunction );
    }
    
    me.blind = function( handlerFunction ) {
        events[ '*' ] = events[ '*' ] || [];
        events[ '*' ].push( handlerFunction );
    }
    
    me.on = function( eventName, eventData ) {
        if (events[ eventName ] instanceof Array ) {
            for ( var i=0, len = events[eventName].length; i<len; i++ ) {
                if ( events[ eventName ][i]( eventData ) === false ) {
                    return false;
                    break;
                }
            }
        }
        
        else
        
        if ( events[ '*' ] instanceof Array ) {
            for ( var i=0, len = events['*'].length; i<len; i++ ) {
                if ( events[ '*' ][i]( eventData ) === false ) {
                    return false;
                    break;
                }
            }
        }
        
        return true;
    }
    
    me.remove = function( eventName, handlerFunction ) {
        handlerFunction = handlerFunction || null;
        if ( events[ eventName ] instanceof Array ) {
            if ( !handlerFunction ) {
                delete events[ eventName ];
            } else {
                for ( var i=0, len=events[ eventName ].length; i<len; i++ ) {
                    if ( events[ eventName ][i] == handlerFunction ) {
                        events[eventName].splice( i, 1 );
                        return true;
                    }
                }
            }
        }
        return true;
    }
    
    me.interval = function( intervalName, intervalFunction, durationMs ) {
        
        if ( typeof intervals[ intervalName ] != 'undefined' )
            throw "Failed to register interval!";
        
        intervals[ intervalName ] = setInterval( intervalFunction, durationMs ).unref();
    }
    
    return me;
}
