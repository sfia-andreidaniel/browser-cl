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
    fileSegment     = /^[\w \-\_\[\]\{\}\;\"\'\,\.]+$/ //" mc bug syntax highlighter,

    integer         = require( __dirname + "/math.js" ).integer;

exports.initialize = function( controller, httpServer, dataDir, additionalPaths ) {
    
    controller.getFile = function( targetIpPort, remotePath, localPath, successCallback, errorCallback, progressCallback ) {

        var tasker = new async(),
            eventer= new Thing(),
            info   = null,
            client = new WebSocketClient(),
            connection = null,
            fd     = null,
            
            realPath = null,
            
            numRead = 0,
            
            lastProgress = 0,
            currentProgress = 0;
        
        eventer.currentPhase = 'fetch-info';
        eventer.currentTask  = null;
        
        eventer.bind( 'error', function( reason ) {
            
            tasker.on( 'error', reason );
            
        } );
        
        eventer.blind( function() {
            
            tasker.on( 'error', "Tried to call an unbinded event in the eventer!" );
            
        } );
        
        eventer.bind( 'fetch-info', function( frame ) {
            
            if ( frame.ok && frame.size ) {
                
                info = {
                    "size": frame.size
                };
                
                // Create open local file for writing purposes
                
                fs.stat( localPath, function( err, stats ) {
                    
                    if ( !err ) {
                        eventer.on( 'error', "File allready exists on local filesystem" );
                    } else {
                        
                        fs.open( localPath, 'w', function( err, fileDescriptor ) {
                            
                            if ( err ) {
                                
                                eventer.on( 'error', "Failed to open local file " + localPath + " for writing" );
                                
                            } else {
                                
                                fd = fileDescriptor;
                                
                                connection.sendUTF( '{"ack": true}' );
                                
                                eventer.currentPhase = 'fetch-data';
                                
                                eventer.currentTask.on( 'success' );
                                
                                realPath = localPath;
                                
                            }
                            
                        } );
                        
                    }
                    
                } );
                
            } else {
                
                eventer.on( 'error', "Bad handshake frame!" );
                
            }
            
        } );
        
        eventer.bind( 'fetch-data', function( binData ) {
            
            if ( !binData || binData.error ) {
                
                eventer.on( 'error', "Bad data frame: " + ( binData.reason || "Unknown reason" ) );
                
            } else {
                
                numRead += binData.length;
                
                // console.log( "Got: " + binData.length + ", total = " + numRead + " / " + info.size );
                
                // Write ...
                if ( fd ) {
                
                    fs.write( fd, binData, 0, binData.length, null, function( err, written, callback ) {
                        
                        if ( err ) {
                            eventer.on( "error", "Failed to write " + binData.length + " bytes to local file!" );
                        } else {
                            // Send ack frame
                            connection.sendUTF( '{"ack": true}' );
                            currentProgress = integer( numRead / ( info.size / 100 ) );
                            if ( currentProgress != lastProgress ) {
                                lastProgress = currentProgress;
                                if ( progressCallback ) {
                                    try {
                                        progressCallback( currentProgress );
                                    } catch ( e ) {
                                        eventer.on( 'error', "Progress callback error: " + e );
                                    }
                                }
                            }
                        }
                        
                    } );
                
                } else {
                    eventer.on( "error", "Failed to write in local file, file is not opened!" );
                }
                
            }
            
        } );
        
        tasker.sync( function() {
            
            eventer.currentTask = this;
            
            ( function( task ) {
                
                client.on( 'connectFailed', function( error ) {
                    
                    task.on( 'error', error || "Unknown error" );
                    
                } );
                
                client.on( 'connect', function( conn ) {
                    
                    connection = conn;
                    
                    connection.on( 'error', function( ) {
                        eventer.on( 'error', "Connection error" );
                    } );
                    
                    connection.on( 'close', function() {
                        // console.log( "Connection closed!" );
                        
                        if ( info && ( typeof info.size != 'undefined' ) && info.size == numRead ) {
                            
                            eventer.currentTask.on( 'success' );
                            
                        } else {
                            
                            eventer.currentTask.on( 'error', "Failed to fetch file!" );
                            
                        }
                        
                    } );
                    
                    // Send first frame
                    connection.sendUTF( JSON.stringify({
                        "name": remotePath
                    }) );
                    
                    connection.on( 'message', function( event ) {
                        
                        switch ( event.type ) {
                            
                            case 'utf8':
                            
                                try {
                                    
                                    var frame = JSON.parse( event.utf8Data );
                                    
                                    frame = frame || {};
                                    
                                    if ( frame.error ) {
                                        throw frame.reason || "Unknown frame error";
                                    }
                                    
                                    eventer.on( eventer.currentPhase, frame );
                                    
                                } catch ( error ) {
                                    
                                    eventer.on( 'error', error + "" );
                                    
                                }
                            
                                break;
                            
                            case 'binary':
                                
                                try {
                                
                                    eventer.on( eventer.currentPhase, event.binaryData );
                                
                                } catch ( error ) {
                                    
                                    eventer.on( 'error', error + "" );
                                    
                                }
                            
                                break;
                            
                            default:
                                eventer.on( 'error', 'Unexpected event data type' );
                                break;
                        }
                        
                    } );
                    
                } );
                
                client.connect( 'ws://' + targetIpPort + '/get/', 'file' );
                
            } )( this );
            
        } );
        
        tasker.sync( function() {
            
            eventer.currentTask = this;
            
            ( function( task ) {
                
                
                
            } )( this );
            
        } );
        
        tasker.run(
            
            //success
            function( ) {
                
                // console.log( "File transferred successfully" );
                
                if ( successCallback ) {
                    
                    try {
                        successCallback();
                    } catch ( error ) {
                        
                        console.log( "Websocket.GET.WARNING: Error in the success callback: " + error );
                        
                    }
                    
                }
                
            },
            
            // error
            function( error ) {
            
                console.log( "Error transferring file: " + ( error || 'unknown error' ) );
            
                if ( realPath ) {
                    
                    console.log( "Unlinking local file..." );
                    
                    try {
                        fs.unlinkSync( realPath );
                    } catch ( error ) {
                        console.log( "Failed to unlink local file: " + ( error || 'unknown error' ) );
                    }
                    
                }
            
                if ( errorCallback ) {
                    
                    try {
                        errorCallback( error );
                    } catch ( error ) {
                        
                        console.log( "Websocket.GET.WARNING: Error in the error callback: " + error );
                        
                    }
                    
                }
                
            },
            
            // complete
            
            function( ) {
                
                // console.log( "Doing cleanup..." );
                
                if ( fd ) {
                    
                    //console.log( "Closing local file..." );
                    
                    try {
                        
                        fs.closeSync( fd );
                        
                        fd = null;
                    
                    } catch ( e ) {
                        
                        console.log( "Websocket.GET: Failed to close local file!: " + ( e || 'unknown error' ) );
                        
                    }
                    
                }
                
                if ( connection ) {
                    
                    //console.log( "Closing websocket connection..." );
                    
                    try {
                    
                        connection.close();
                        connection = null;
                    
                    } catch ( e ) {
                        
                        console.log( "Websocket.GET: Failed to close remote connection!: " + ( e || 'unknown error' ) );
                        
                    }
                    
                }
                
            }
        );
        
    }
}