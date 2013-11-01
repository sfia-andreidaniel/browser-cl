var fs = require('fs'),
    SocketUtils = require( __dirname + '/../../lib/socket-utils.js' );

exports.handle = function( response, request, urlInfo, controller ) {

    var allowRequest = SocketUtils.firewall4( SocketUtils.getFirewallList( controller.isA ), request.socket.remoteAddress );

    if ( !allowRequest ) {

        console.log( "Firewall (" + controller.isA + "): Request rejected for " + request.socket.remoteAddress + " on resource: '/api/'" );

        response.write( 'forbidden' );
        response.end();
        return;

    }

    response.write(
        fs.readFileSync( __dirname + '/index.html', { "encoding": "utf8" } )
    );
    
    response.end();
    

}

exports.async = false;