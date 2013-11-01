var SocketUtils = require( __dirname + '/../../lib/socket-utils.js' );

/* Events are allowed to run only from specific paths */

exports.handle = function( response, request, urlInfo, controller ) {
    /* Firewall */

    var allowRequest = SocketUtils.firewall4( SocketUtils.getFirewallList( controller.isA ), request.socket.remoteAddress );

    if ( !allowRequest ) {

        console.log( "Firewall (" + controller.isA + "): Request rejected for " + request.socket.remoteAddress + " on resource: '/event/'" );

        response.write( 'forbidden' );
        response.end();
        return;

    }

    /* End of firewall */
    
    var eventName = urlInfo.event || null;
    
    if ( !eventName ) {
        
        response.write( JSON.stringify({
            "error": true,
            "reason": "Which event?"
        }) );
        
        return;
        
    } else {
        
        var data = urlInfo.data || "{}";
        
        try {
            data = JSON.parse( data );
        } catch ( e ) {
            response.write( JSON.stringify({
                "error": true,
                "reason": "Unserializeable request data"
            }));
            
            return;
        }
        
        try {
            data.request = request;
            data.response= response;
            data.eventName = eventName;
            
            controller.on( eventName, data );
        } catch ( e ) {
            response.write( JSON.stringify({
                "error": true,
                "reason": e + ""
            }) );
            response.end();
        }
    }
    
}

exports.async = true;