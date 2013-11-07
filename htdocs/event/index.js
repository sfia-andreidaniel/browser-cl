var SocketUtils = require( __dirname + '/../../lib/socket-utils.js' );

/* Events are allowed to run only from specific paths */

exports.handle = function( response, request, urlInfo, controller ) {

    var errorSent = false;

    response.sendError = function( reason ) {
        if ( errorSent )
            return;
            
        try {
            response.write( JSON.stringify({
                "error": true,
                "reason": ( reason + "" ) || "unknown reason"
            }) );
            response.end();
        } catch ( e ) {
            console.log( "ERROR sending response back to event: " + e );
        }
        errorSent = true;
    }

    /* Firewall */

    var allowRequest = SocketUtils.firewall4( SocketUtils.getFirewallList( controller.isA ), request.socket.remoteAddress );

    if ( !allowRequest ) {

        console.log( "Firewall (" + controller.isA + "): Request rejected for " + request.socket.remoteAddress + " on resource: '/event/'" );

        response.sendError( 'forbidden' );
        return;

    }

    /* End of firewall */
    
    var eventName = urlInfo.event || null;
    
    if ( !eventName ) {
        
        response.sendError( 'which event?' );
        
        return;
        
    } else {
        
        var data = urlInfo.data || "{}";
        
        try {
            data = JSON.parse( data );
        } catch ( e ) {
            response.sendError( "Unserializeable request data" );
            return;
        }
        
        try {
            data.request = request;
            data.response= response;
            data.eventName = eventName;
            
            controller.on( eventName, data );
        } catch ( e ) {
            response.sendError( e + '' );
        }
    }
    
}

exports.async = true;