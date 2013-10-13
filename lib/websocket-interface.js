var WebSocketServer = require('websocket').server,
    WebSocketClient = require('websocket').client,
    mkdirp = require('mkdirp'),
    fs = require('fs'),
    async = require( __dirname + '/async.js' ).Async,
    Thing = require( __dirname + '/thing.js' ).Thing;

exports.WebsocketInterface = function( controller, httpServer, dataDir ) {
    
    console.log( "Initialize controller websocket interface for /put requests..." );
    
    controller.wsServer = new WebSocketServer( {
        "httpServer": httpServer,
        "autoAcceptConnections": false
    } );
    
    controller.wsServer.on( 'request', function( request ) {
        
        console.log( "Websocket: new request!" );
        
        switch ( true ) {
            
            // PUT FILE
            case request.resourceURL.path == '/put/':
        
                var connection = request.accept( 'file', request.origin );
        
                console.log( "Websocket: connection accepted" );
        
                var error = function ( reason ) {
                    console.log( "Websocket error: ", reason );
                    try {
                        connection.sendUTF( JSON.stringify( {
                            "type": "error",
                            "reason": reason || 'unknown reason'
                        } ) );
                        connection.close();
                    } catch ( e ) {}
                }
        
                var filePacket = true,
            
                    /*
                
                        "name": "/foo/bar.txt",
                        "size": 2332
                    
                     */
            
                    file       = null,
                    wrote      = 0,
                    fd         = null;
        
                var unlink = function() {
                    if ( fd && file ) {
                        console.log( "Unlink: " + file.name + " from " + dataDir );
                        try {
                            fs.closeSync( fd );
                            fs.unlinkSync( dataDir + "/" + file.name );
                        } catch ( e ) {
                            console.log( "WebSocketFS.put: Failed to unlink file: " + dataDir + "/" + file.name + ": " + e );
                        }
                    }
                }
        
                var fopen = function() {
                    var fileParts = file.name.split('/'),
                        segments  = [];
                    
                    for ( var i=0, len = fileParts.length; i<len; i++ ) {
                        
                        if ( !fileParts[i] )
                            continue;
                        
                        if ( fileParts[i] == '..' || fileParts[i] == '.' ||
                             !/^[\w \-\_\[\]\{\}\;\"\'\,\.]+$/.test( fileParts[i] ) // "mc syntax highliter bug fix
                        ) {
                            
                            error("Invalid file name!");
                            return;
                        } else {
                            segments.push( fileParts[i] );
                        }
                    }
                    
                    if ( !segments.length ) {
                        error("Invalid file name!" );
                        return;
                    }
                        
                    var targetDir = segments.slice( 0, segments.length - 1 ).join( '/' ),
                        fileName  = segments[ segments.length - 1 ],
                        realDir   = null;
                    
                    var openFile = function() {
                        
                        fs.stat( realDir + '/' + fileName, function( err, stats ) {
                            
                            if ( !err ) {
                                
                                error( "File allready exists!" );
                                return;
                                
                            } else {
                                
                                fs.open( realDir + "/" + fileName, 'w', function( err, descriptor ) {
                                    
                                    if ( err ) {
                                        error( "Failed to open file for writing: " + realDir + "/" + fileName );
                                    } else {
                                        
                                        fd = descriptor;
                                        
                                        connection.send( JSON.stringify({
                                            "file": file.name,
                                            "opened": true
                                        }));
                                        
                                        // fs.closeSync( fd ); // close file
                                        
                                        filePacket = false;
                                        
                                        console.log( "Created file: " + file.name + " in " + dataDir );
                                    }
                                    
                                } );
                                
                            }
                            
                        } );
                        
                    }
                    
                    // compute destination data dir
                    if ( targetDir ) {
                        mkdirp( dataDir + "/" + targetDir, function( err ) {
                            if ( err ) {
                                error("Failed to create directory: " + targetDir + ": " + err );
                            } else {
                                realDir = dataDir + "/" + targetDir;
                                openFile();
                            }
                        } );
                    } else {
                        realDir = dataDir;
                        openFile();
                    }
                };
                var fwrite = function( data, offset ) {
                    
                    if ( fd ) {
                        fs.write( fd, data, 0, data.length, offset, function(err, written, buffer) {
                            if ( err ) {
                                error("Failed to write in file: " + err );
                                unlink();
                                return;
                            } else {
                                connection.send( JSON.stringify({
                                    "written": written
                                }) );
                            }
                        } );
                    }
                    
                };
                var fclose = function() {
                    
                    if ( fd ) {
                        fs.close( fd, function( err ) {
                            if ( err ) {
                                error( "FS.WebSocket.Put: Error closing file: " + file.name + ": " + err );
                                unlink();
                            } else {
                                connection.send( JSON.stringify({
                                    "success": true
                                }) );
                                
                                console.log( "Closed file: " + file.name + " from " + dataDir );
                            }
                        } );
                    }
                    
                };
                
                connection.on( 'message', function( message ) {
                
                    switch ( message.type ) {
                        
                        case 'utf8':
                            if ( filePacket ) {
                                try {
                                    
                                    file = JSON.parse( message.utf8Data );
                                    
                                    if ( !file.name || !file.size ) {
                                        throw "Invalid packet type!";
                                    }
                                    
                                    // console.log( file );
                                    
                                    fopen();
                                    
                                } catch ( e ) {
                                    error( e + "" );
                                }
                            } else error( "Expected a binary packet!" );
                            break;
                        case 'binary':
                            if ( filePacket )
                                error( "Expected file packet first!" );
                            else {
                                var data = message.binaryData,
                                    len  = data.length,
                                    offset = wrote;
                                
                                wrote += len;
                                
                                if ( wrote > file.size )
                                    error("File overflow (" + wrote + ">" + file.size + ", last len=" + len + ")" );
                                else
                                    fwrite( data, offset );
                                
                                if ( wrote == file.size ) {
                                    
                                    fclose( data );
                                    
                                    connection.send(JSON.stringify({
                                        "ok": true,
                                        "size": wrote
                                    }));
                                    
                                    connection.close();
                                }
                            }
                            break;
                        default:
                            error( "Unexpected packet type!" );
                            break;
                    }
                } );
                
                connection.on( "close", function( reason, description ) {
                    console.log("Websocket: connection closed" );
                } );
                
            break; // END WEBSOCKET PUT
        
        default:
            console.log( "Websocket: invalid websocket path " + request.resourceURL.path );
            request.reject();
            break;

        } // END WEBSOCKET PROTOCOL ROUTING
        
        
    } );
    
    // Puts a file to a node
    controller.putFile = function( targetIpPort, remotePath, localPath, successCallback, errorCallback, progressCallback ) {
        
        var tasks = new async(),
            info = null,
            client = new WebSocketClient(),
            connection = null,
            
            eventer = new Thing(),          // Transfer Eventer
            fd = null,                      // FS file handle
            fptr = 0,                       // FS file handle reading position
            maxChunkSize = 64000,           // Max transfer buffer size
            buffer = new Buffer( maxChunkSize ),
            lastProgress = 0,
            currentProgress = 0; // File read buffer
        
        eventer.blind( function( eventData ) {
            tasks.on( 'error', "Bad eventer event: " + eventData.eventName );
        } );
        
        eventer.currentPhase = 'file-opened';   // Current phase of the eventer process
        eventer.currentTask = null;             // Current running task of the chain
        
        eventer.bind( 'file-opened', function( event ) {
            
            // eventer.frame
            
            // Sample packets
            // { file: '/etc/hosts', opened: true }
            // { type: 'error', reason: 'File allready exists!' }
            
            if ( event.frame.file && event.frame.opened ) {
                
                eventer.currentPhase = 'file-packets';
                
                eventer.currentTask.on( 'success' );
            } else {
                
                eventer.on( 'error', "Error opening file on remote server: " + ( eventer.reason || "unknown reason" ) );
                
            }
            
        } );
        
        eventer.bind( 'file-packets', function( event ) {
            
            if ( event.frame.ok ) {
                
                if ( event.frame.size == info.size ) {
                    
                    eventer.currentTask.on( 'success' );
                    
                } else {
                    
                    eventer.currentTask.on( 'error', "File written on server differs in size than local file size" );
                    
                }
                
                return;
            }
            
            // eventer.frame
            
            // console.log( "File packet acknowledge frame!: ", event.frame );
            
            // eventer.frame = {
            //    "written": integer
            // }
            
            if ( typeof event.frame.written == 'undefined' ) {
                console.log( "Debug: ", event.frame );
                eventer.on( 'error', "Bad frame (missing 'written' property )" );
            }
            
            switch ( event.frame.written ) {
                case -1:
                    // Start frame
                    fptr = 0;
                    break;
                case 0:
                    // Transfer completed
                    
                    return;
                    
                    break;
                default:

                    // console.log( "Progress: " + fptr + "/" + info.size );
                    
                    break;
            }
            
            // Read next chunk if we're not at the end of the file
            
            if ( fptr < info.size - 1 )
            
                fs.read( fd, buffer, 0, maxChunkSize, fptr, function( err, bytesRead, buffer ) {
                    
                    fptr += bytesRead;
                    
                    if ( err ) {
                        
                        eventer.on( 'error', "Error reading from file!" );
                        
                    } else {
                        
                        // Send next package to the server
                        
                        // console.log( "Sending " + bytesRead + " from pos: " + ( fptr - bytesRead ) );
                        
                        connection.sendBytes( bytesRead == maxChunkSize
                            ? buffer
                            : buffer.slice( 0, bytesRead )
                        );

                        currentProgress = ~~( fptr / ( info.size / 100 ) );
                        
                        if ( currentProgress != lastProgress ) {
                            
                            lastProgress = currentProgress;
                            
                            if ( progressCallback ) {
                                progressCallback( currentProgress );
                            }
                            
                        }
                        
                    }
                    
                } );
            
        } );
        
        eventer.bind( 'error', function( error ) {
            tasks.on( 'error', error );
        } );
        
        tasks.sync( function() {
            
            // console.log("Step 1. Testing if file exists");
            
            ( function( task ) {
                
                eventer.currentTask = task;
            
                fs.stat( localPath, function( err, stats ) {
                    if ( err )
                        task.on( 'error', "Failed to stat file: " + err );
                    else {
                        // console.log( "Info stat: ", stats );
                        
                        if ( !stats.isFile() ) {
                            task.on('error', "Path: " + localPath + " is not a file!" );
                        } else {
                            
                            info = {
                                "name": remotePath,
                                "size": stats.size
                            };
                            
                            // console.log( "Packet: ", info );
                            
                            if ( info.error ) {
                                
                                eventer.on( 'error', info.reason || 'Unknown frame error' );
                                
                            } else {
                                
                                // console.log( "Frame: ", info );
                                
                                task.on( 'success' );
                                
                            }
                        }
                        
                        
                    }
                } )
            } )( this );
        } ).sync( function() {
            
            // console.log( "Step 2. Connecting to server and sending first frame!" );
            
            ( function( task ) {
                
                // console.log( "Setting current task to task #2" );
                eventer.currentTask = task;
            
                client = new WebSocketClient( 'ws://' + targetIpPort + '/put/', 'file' );
            
                client.on( 'connectFailed', function( error ) {
                
                    task.on( 'error', "Failed to connect to server: " + ( error || "unknown error" ) );
                
                } );
                
                client.on( 'connect', function( conn ) {
                    
                    connection = conn;
                    
                    // console.log( "Connected..." );
                    
                    connection.sendUTF( JSON.stringify(
                        info
                    ) );
                    
                    connection.on( 'error', function(error) {
                        
                        eventer.on( 'error', "Connection error: " + ( error || 'unknown error' ) );
                        
                    } );
                    
                    connection.on( 'close', function() {
                        
                        // console.log( "Connection closed!" );
                        
                    } );
                    
                    connection.on( 'message', function( event ) {
                        
                        if ( event.type == 'utf8' ) {
                            
                            try {
                                
                                var frame = JSON.parse( event.utf8Data );
                                
                                if ( !( frame instanceof Object ) ) {
                                    
                                    throw "Expected object frame!";
                                    
                                }
                                
                                // console.log( "Frame: ", frame );
                                
                                eventer.on( eventer.currentPhase, {
                                    "frame": frame
                                } );
                                
                                //connection.close();
                                
                            } catch ( ex ) {
                                
                                task.on( 'error', "Message exception: " + ex );
                                
                            }
                            
                        } else {
                            
                            task.on( 'error', "Invalid package type: " + event.type );
                            
                        }
                        
                    } );
                    
                } );
            
                client.connect( 'ws://' + targetIpPort + '/put/', 'file' );
            
            })( this );
            
        } ).sync( function() {
            
            // console.log( "Step 3. Opening file, and sending chunkns data" );
            
            ( function( task ) {
                
                eventer.currentTask = task;
                
                fs.open( localPath, 'r', function( err, fileHandle ) {
                    
                    if ( err ) {
                        task.on( 'error', "Error opening file for reading" );
                    } else {
                        
                        fd = fileHandle;
                        fptr = 0;
                        
                        eventer.on( eventer.currentPhase, {
                            "frame": {
                                "written": -1
                            }
                        } );
                        
                    }
                    
                } );
                
            } )( this );
            
        } );
        
        tasks.run( 
            // Success
            function( ) {
                // console.log( "File uploaded" );
                
                if ( successCallback ) {
                    try {
                        successCallback();
                    } catch (e) {
                        // console.log( "File put success callback error: " + e );
                    }
                }
                
            }, 
            // Error
            function( error ) {
                // console.log( "MainTask: Failed to upload file: " + ( error || "unknown error" ) );
                
                if ( errorCallback ) {
                    
                    try {
                        errorCallback( error || "Unknown error" );
                    } catch (e) {
                        // console.log( "File put error callback error: " + e );
                    }
                    
                }
                
            }, 
            // Complete
            function( complete ) {
                // console.log( "Chain completed!" );
                
                if ( fd ) {
                    // console.log( "Closing local file..." );
                    try {
                        fs.closeSync(fd);
                    } catch (e) {}
                    fd = null;
                }
                
                if ( connection ) {
                    // console.log( "Closing connection..." );
                    try {
                        connection.close();
                    } catch (e) {}
                    connection = null;
                }
                
                if ( buffer ) {
                    buffer = null;
                }
                
                if ( eventer ) {
                    eventer.currentPhase = null;
                    eventer.currentTask = null
                    eventer = null;
                }
            }
        );
    }
}