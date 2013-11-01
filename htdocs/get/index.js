var SocketUtils = require( __dirname + '/../../lib/socket-utils.js' ),
    fs = require('fs');

exports.handle = function( response, request, urlInfo, controller ) {
    
    /* Firewall */

    var allowRequest = SocketUtils.firewall4( SocketUtils.getFirewallList( controller.isA ), request.socket.remoteAddress );

    if ( !allowRequest ) {

        console.log( "Firewall (" + controller.isA + "): Request rejected for " + request.socket.remoteAddress + " on resource: '/get/'" );

        response.write( 'forbidden' );
        response.end();
        return;

    }

    
    response.write(
        fs.readFileSync( __dirname + "/index.html" )
    );
    
    

}

exports.async = false;