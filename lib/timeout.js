var thing   = require( __dirname + '/thing.js' ).Thing,
    integer = require( __dirname + '/math.js' ).integer;

function Timeout( milliseconds, timeoutCallback ) {
    
    timeoutCallback = timeoutCallback || function() {
        throw "The timeout has been reached!";
    };
    
    milliseconds = integer( milliseconds );

    if ( milliseconds <= 0 )
        throw "Invalid timeout milliseconds value (need to be > 0)";
    
    var me       = new thing,
        now      = ( new Date() ).getTime(),
        interval = null,
        stopped  = false;
    
    me.noop = function() {
        now = ( new Date() ).getTime();
    };
    
    me.cancel = function() {
        if ( !stopped ) {
            stopped = true;
            clearInterval( interval );
            interval = null;
        }
    };
    
    interval = setInterval( function() {
        
        if ( stopped )
            return;
        
        var t = ( new Date() ).getTime();
        
        if ( ( t - now ) > milliseconds ) {
            
            timeoutCallback();
            me.cancel();
            
        }
        
    }, milliseconds + 10 );
    
    interval.unref();
    
    return me;
}

/* 
var t = new Timeout( 100, function() {
    console.log( "The timeout has ben hit!" );
} );

setInterval( function() {
    t.noop();
}, 130 );
*/

exports.Timeout = Timeout;