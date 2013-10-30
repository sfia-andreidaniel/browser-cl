var // Websocket server
    WebSocketServer = require('websocket').server,
    
    // Websocket client
    WebSocketClient = require('websocket').client,

    // Create directory recursive functionality
    mkdirp = require('mkdirp'),
    
    // File system functions
    fs = require('fs'),

    // Asynchronous library.
    async = require( __dirname + '/async.js' ).Async,

    // Base class
    Thing = require( __dirname + '/thing.js' ).Thing,

    // Base 64 decoding functionality
    atob = require( 'base64' ).decode,
    
    // Regular expression for a path segment of a file
    fileSegment = /^[\w \-\_\[\]\{\}\;\"\'\,\.]+$/, //" mc bug syntax highlighter

    requestTypes = {
        "clientToApi": require( __dirname + '/websocket-connection-client-to-api.js' ),
        "putRequest" : require( __dirname + '/websocket-connection-put-request.js' ),
        "getRequest" : require( __dirname + '/websocket-connection-get-request.js' )
    };

exports.WebsocketInterface = function( controller, httpServer, dataDir, additionalPaths ) {
    
    console.log( "Initialize controller websocket interface..." );
    
    additionalPaths = additionalPaths || [];
    
    controller.wsServer = new WebSocketServer( {
        "httpServer": httpServer,
        "autoAcceptConnections": false
    } );
    
    controller.wsServer.on( 'request', function( request ) {

        //console.log( "Websocket: new request!" );

        switch ( true ) {

            // CLIENT TO API UPLOAD REQUEST
            case request.resourceURL.path == '/api/' && additionalPaths.indexOf( '/api/' ) >= 0:
                requestTypes.clientToApi.handleRequest( request, controller, httpServer, dataDir, additionalPaths );
                break;

            // PUT FILE REQUEST
            case request.resourceURL.path == '/put/':
                requestTypes.putRequest.handleRequest( request, controller, httpServer, dataDir, additionalPaths );
                break; // END WEBSOCKET PUT

            // GET FILE REQUEST
            case request.resourceURL.path == '/get/':
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
    
    
    // The disk stats are obtained from the files DataDir/.quota, and DataDir/.free
    // The @success should be a function( stats ), where
    //              @stats comes in format: {
    //                   "quota": <int>,
    //                   "free" : <int>,
    //                   "space": <int>
    //              }
    // The @error should be a function ( <string> reason )
    controller.diskStats = function( success, error ) {
        
        var free = null,
            quota = null,
            eventer = new async();
        
        eventer.async( function() {
            
            ( function( task ) {
            
                fs.stat( dataDir + "/.free", function( err, statInfo ) {
                    
                    if ( !err && statInfo.isFile() ) {
                        
                        fs.readFile( dataDir + "/.free", { "encoding": "utf8" }, function( err, data ) {
                            
                            if ( err ) {
                                free = null;
                            } else {
                                free = ~~data;
                            }
                            
                            task.on( 'success' );
                            
                        } );
                        
                    } else {
                        
                        free = null;
                        
                        task.on( 'success' );
                    }
                
                } );
            
            })( this );
            
        } );

        eventer.async( function() {
            
            ( function( task ) {
            
                fs.stat( dataDir + "/.quota", function( err, statInfo ) {
                    
                    if ( !err && statInfo.isFile() ) {
                        
                        fs.readFile( dataDir + "/.quota", { "encoding": "utf8" }, function( err, data ) {
                            
                            if ( err ) {
                                qouta = null;
                            } else {
                                quota = ~~data;
                            }
                            
                            task.on( 'success' );
                            
                        } );
                        
                    } else {
                        
                        free = null;
                        
                        task.on( 'success' );
                    }
                
                } );
            
            })( this );
            
        } );
        
        eventer.run(
            function( ) {
                var out;
                
                if ( quota === null ) {
                    // The node has no quota defined
                    out = {
                        "quota": -1,
                        "free": ( free === null ) ? -1 : free,
                        "space": -1
                    };
                } else {
                    
                    out = {
                        "quota": quota,
                        "free": ( free === null ) ? -1 : free,
                        "space": ( free === -1 ) ? -1 : quota - free
                    }
                }
                
                if ( success )
                    success( out );
            },
            function( reason ) {
                
                if ( error )
                    error( reason );
                
            }
        );
    }
    
    // Reserves a space on disk of <int>space bytes.
    // Works only if .free file is located in the datadir directory
    
    controller.reserveSpace = function( space, success, error ) {
        var eventer = new async();
            space = ~~space;
         
         eventer.async( function() {
            ( function( task ) {
                
                fs.stat( dataDir + '/.free', function( err, statInfo ) {
                    
                    if ( !err && statInfo.isFile() ) {
                        
                        try {
                            var actualFree = ~~fs.readFileSync( dataDir + "/.free", { "encoding": "utf8" } );
                            
                            actualFree -= space;
                            
                            fs.writeFileSync( dataDir + "/.free", actualFree + "", {
                                "encoding": "utf8"
                            } );
                            
                            task.on( 'success' );
                            
                        } catch ( e ) {
                            task.on( "error", "Error updating .free file!" );
                        }
                        
                    } else {
                        task.on( 'error', "No .free file found in data dir" );
                    }
                    
                } );
                
            } )( this );
         } ).run( function() {
            if ( success )
                success();
         }, function( reason ) {
            if ( error )
                error( reason || "Unknown error" );
         } );
    }
    
}