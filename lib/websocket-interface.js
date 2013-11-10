var // Websocket server
    WebSocketServer = require('websocket').server,
    
    // Websocket client
    WebSocketClient = require('websocket').client,

    // Create directory recursive functionality
    mkdirp          = require('mkdirp'),
    
    // File system functions
    fs              = require('fs'),

    // Asynchronous library.
    async           = require( __dirname + '/async.js' ).Async,

    // Base class
    Thing           = require( __dirname + '/thing.js' ).Thing,

    // Base 64 decoding functionality
    atob            = require( 'base64' ).decode,
    
    // Regular expression for a path segment of a file
    fileSegment     = /^[\w \-\_\[\]\{\}\;\"\'\,\.]+$/, //" mc bug syntax highlighter

    requestTypes    = {
        "clientToApi": require( __dirname + '/websocket-connection-client-to-api.js' ),
        "putRequest" : require( __dirname + '/websocket-connection-put-request.js' ),
        "getRequest" : require( __dirname + '/websocket-connection-get-request.js' )
    },
    
    SocketUtils     = require( __dirname + '/socket-utils.js' );

exports.WebsocketInterface = function( controller, httpServer, dataDir, additionalPaths ) {
    
    console.log( "* WebSocket-Interface: Initialize controller websocket interface..." );
    
    additionalPaths = additionalPaths || [];
    
    controller.wsServer = new WebSocketServer( {
        "httpServer": httpServer,
        "autoAcceptConnections": false
    } );
    
    controller.wsServer.on( 'request', function( request ) {

        //console.log( "Websocket: new request!" );
        
        var allowRequest = false;

        switch ( true ) {

            // CLIENT TO API UPLOAD REQUEST
            case request.resourceURL.path == '/api/' && additionalPaths.indexOf( '/api/' ) >= 0:
            
                allowRequest = SocketUtils.firewall4( SocketUtils.getFirewallList( 'client' ), request.socket.remoteAddress );

                if ( !allowRequest ) {
                    console.log( "Firewall ( client ): Request rejected for " + request.socket.remoteAddress + " on 'ws://api/'" );
                    request.reject();
                    return;
                }
            
                requestTypes.clientToApi.handleRequest( request, controller, httpServer, dataDir, additionalPaths );
                break;

            // PUT FILE REQUEST
            case request.resourceURL.path == '/put/':

                allowRequest = SocketUtils.firewall4( SocketUtils.getFirewallList( controller.isA ), request.socket.remoteAddress );

                if ( !allowRequest ) {
                    console.log( "Firewall ( " + controller.isA + " ): Request rejected for " + request.socket.remoteAddress + " on 'ws://put/'" );
                    request.reject();
                    return;
                }

                requestTypes.putRequest.handleRequest( request, controller, httpServer, dataDir, additionalPaths );
                break; // END WEBSOCKET PUT

            // GET FILE REQUEST
            case request.resourceURL.path == '/get/':

                allowRequest = SocketUtils.firewall4( SocketUtils.getFirewallList( controller.isA ), request.socket.remoteAddress );

                if ( !allowRequest ) {
                    console.log( "Firewall ( " + controller.isA + " ): Request rejected for " + request.socket.remoteAddress + " on 'ws://get/'" );
                    request.reject();
                    return;
                }

                requestTypes.getRequest.handleRequest( request, controller, httpServer, dataDir, additionalPaths );
                break;

            default:
                console.log( "Websocket: invalid websocket path " + request.resourceURL.path );
                request.reject();
                break;

        } // END WEBSOCKET PROTOCOL ROUTING


    } );
    
    // controller.putFile( targetIpPort, remotePath, localPath, successCallback, errorCallback, progressCallback )
    
    require( __dirname + '/websocket-file-put.js' ).initialize( controller, httpServer, dataDir, additionalPaths );
    
    // controller.getFile( targetIpPort, remotePath, localPath, successCallback, errorCallback, progressCallback )
    require( __dirname + '/websocket-file-get.js' ).initialize( controller, httpServer, dataDir, additionalPaths );
    
}