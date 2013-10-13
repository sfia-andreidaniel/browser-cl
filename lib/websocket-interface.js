var WebSocketServer = require('websocket').server,
    WebSocketClient = require('websocket').client,
    mkdirp = require('mkdirp'),
    fs = require('fs'),
    async = require( __dirname + '/async.js' ).Async,
    Thing = require( __dirname + '/thing.js' ).Thing,
    fileSegment = /^[\w \-\_\[\]\{\}\;\"\'\,\.]+$/; //" mc bug syntax highlighter

exports.WebsocketInterface = function( controller, httpServer, dataDir, additionalPaths ) {
    
    console.log( "Initialize controller websocket interface..." );
    
    additionalPaths = additionalPaths || [];
    
    controller.wsServer = new WebSocketServer( {
        "httpServer": httpServer,
        "autoAcceptConnections": false
    } );
    
    controller.wsServer.on( 'request', function( request ) {
        
        console.log( "Websocket: new request!" );
        
        switch ( true ) {
            
            case request.resourceURL.path == '/api/' && additionalPaths.indexOf( '/api/' ) >= 0:
                
                console.log( "Api request!" );
                
                var connection = request.accept( 'api', request.origin );
                
                console.log( "Websocket.API: connection accepted" );
                
                var error = function( reason ) {
                    
                    connection.sendUTF( reason );
                    
                    connection.close();
                }
                
                connection.on( 'message', function( event ) {
                    
                    switch ( event.type ) {
                        
                        case 'utf8':
                        
                            console.log( "Utf8-Data: " + event.utf8Data );
                        
                            connection.sendUTF( event.utf8Data );
                        
                            break;
                        
                        case 'binary':
                        
                            console.log( "Binary-Data: " + event.binaryData.toString() );
                        
                            break;
                        
                        default:
                            error("Unknown message type: " + event.type );
                            break;
                    }
                    
                } );
                
                connection.on( 'close', function() {
                    
                    console.log( "Connection closed" );
                    
                } );
                
                connection.on( 'error', function( reason ) {
                    
                    console.log( "Connection error: " + ( reason || 'unknown' ) );
                    
                } );
                
                break;
            
            // PUT FILE
            case request.resourceURL.path == '/put/':
        
                var connection = request.accept( 'file', request.origin );
        
                console.log( "Websocket.PUT: connection accepted" );
        
                var error = function ( reason ) {
                    console.log( "Websocket.PUT error: ", reason );
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
                            console.log( "WebSocket.PUT: Failed to unlink file: " + dataDir + "/" + file.name + ": " + e );
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
                             !fileSegment.test( fileParts[i] )
                        ) {
                            
                            error("WebSocket.PUT: Invalid file name!");
                            return;
                        } else {
                            segments.push( fileParts[i] );
                        }
                    }
                    
                    if ( !segments.length ) {
                        error("WebSocket.PUT: Invalid file name!" );
                        return;
                    }
                        
                    var targetDir = segments.slice( 0, segments.length - 1 ).join( '/' ),
                        fileName  = segments[ segments.length - 1 ],
                        realDir   = null;
                    
                    var openFile = function() {
                        
                        fs.stat( realDir + '/' + fileName, function( err, stats ) {
                            
                            if ( !err ) {
                                
                                error( "WebSocket.PUT: File allready exists!" );
                                return;
                                
                            } else {
                                
                                fs.open( realDir + "/" + fileName, 'w', function( err, descriptor ) {
                                    
                                    if ( err ) {
                                        error( "WebSocket.PUT: Failed to open file for writing: " + realDir + "/" + fileName );
                                    } else {
                                        
                                        fd = descriptor;
                                        
                                        connection.send( JSON.stringify({
                                            "file": file.name,
                                            "opened": true
                                        }));
                                        
                                        // fs.closeSync( fd ); // close file
                                        
                                        filePacket = false;
                                        
                                        console.log( "WebSocket.PUT: Created file: " + file.name + " in " + dataDir );
                                    }
                                    
                                } );
                                
                            }
                            
                        } );
                        
                    }
                    
                    // compute destination data dir
                    if ( targetDir ) {
                        mkdirp( dataDir + "/" + targetDir, function( err ) {
                            if ( err ) {
                                error("WebSocket.PUT: Failed to create directory: " + targetDir + ": " + err );
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
                                error("WebSocket.PUT: Failed to write in file: " + err );
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
                                error( "WebSocket.PUT: Error closing file: " + file.name + ": " + err );
                                unlink();
                            } else {
                                connection.send( JSON.stringify({
                                    "success": true
                                }) );
                                
                                console.log( "WebSocket.PUT: Closed file: " + file.name + " from " + dataDir );
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
                            } else error( "WebSocket.PUT: Expected a binary packet!" );
                            break;
                        case 'binary':
                            if ( filePacket )
                                error( "WebSocket.PUT: Expected file packet first!" );
                            else {
                                var data = message.binaryData,
                                    len  = data.length,
                                    offset = wrote;
                                
                                wrote += len;
                                
                                if ( wrote > file.size )
                                    error("WebSocket.PUT: File overflow (" + wrote + ">" + file.size + ", last len=" + len + ")" );
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
                            error( "WebSocket.PUT: Unexpected packet type!" );
                            break;
                    }
                } );
                
                connection.on( "close", function( reason, description ) {
                    console.log("WebSocket.PUT:  connection closed" );
                } );
                
            break; // END WEBSOCKET PUT

            // GET FILE
            case request.resourceURL.path == '/get/':
        
                var connection = request.accept( 'file', request.origin );
        
                console.log( "Websocket.GET: connection accepted" );
        
                var error = function ( reason ) {
                    console.log( "Websocket.GET error: ", reason );
                    try {
                        connection.sendUTF( JSON.stringify( {
                            "type": "error",
                            "reason": reason || 'unknown reason'
                        } ) );
                        connection.close();
                    } catch ( e ) {}
                }
                
                // Waiting for get file packet
                var filePacket = true,
                    file       = null,
                    fd         = null,
                    frame      = null,
                    maxPacketSize = 64000,
                    buffer     = new Buffer( maxPacketSize ),
                    readBytes  = 0,
                    nextChunk  = 0;
                
                var fopen = function() {
                    
                    var fileParts = file.name.split( '/' ),
                        segments  = [];
                    
                    for ( var i=0, len=fileParts.length; i<len; i++ ) {
                        
                        if ( fileParts[i] == '' )
                            continue;
                        
                        // console.log( "Part: ", fileParts[i], fileSegment );
                        
                        if ( fileParts[i] == '..' || fileParts[i] == '.' || !fileSegment.test( fileParts[i] ) ) {
                            
                            error( "Invalid file name!" );
                            return;
                        }
                        
                        segments.push( fileParts[i] );
                        
                    }
                    
                    if ( !segments.length ) {
                        
                        error( "Invalid file name (no name)" );
                        return;
                        
                    }
                    
                    var realPath = dataDir + "/" + segments.join( "/" );
                    
                    // Stat file
                    
                    fs.stat( realPath, function( err, fileStat ) {
                        
                        if ( err ) {
                            
                            error("File not found!");
                            return;
                            
                        } else {
                            
                            if ( !fileStat.isFile() ) {
                                
                                error( file.name + " is not a file!" );
                                
                            } else {
                                
                                // Good, it's a file. Open it
                                
                                fs.open( realPath, 'r', function( err, fileDescriptor ) {
                                    
                                    if ( err ) {
                                        
                                        error( file.name + " could not be opened for reading!" );
                                        
                                    } else {
                                        
                                        fd = fileDescriptor;
                                        
                                        connection.send( JSON.stringify({
                                            "ok": true,
                                            "size": fileStat.size
                                        }) );
                                        
                                        file.size = fileStat.size;
                                        
                                        filePacket = false;
                                    }
                                    
                                } );
                                
                            }
                            
                        }
                        
                    } );
                    
                };
                
                var fread = function() {
                    
                    if ( fd && file.size > readBytes ) {
                        
                        nextChunk = file.size - readBytes;
                        
                        if ( nextChunk > maxPacketSize )
                            nextChunk = maxPacketSize;
                        
                        fs.read( fd, buffer, 0, nextChunk, null, function( err, bytesRead, buffer ) {
                            
                            // Send data to client
                            
                            if ( err ) {
                                
                                error( "Error reading from file!" );
                                
                            } else {
                                
                                connection.sendBytes(
                                    bytesRead == maxPacketSize
                                    ? buffer
                                    : buffer.slice( 0, bytesRead )
                                );
                                
                                readBytes += bytesRead;
                            }
                            
                        } );
                        
                    } else {
                        
                        if ( fd && file.size <= readBytes ) {
                            fclose();
                        }
                        
                    }
                    
                };
                
                var fclose = function() {
                    
                    if ( fd ) {
                        try {
                            fs.closeSync( fd );
                            fd = null;
                        } catch ( e ) {
                            console.log( "WebSocket.GET: Failed to close file!" );
                        }
                    }
                    
                    try {
                        connection.close();
                    } catch ( e ) {
                        console.log( "Websocket.GET: Failed to close websocket connection!" );
                    }
                }
                
                connection.on( 'close', function( ) {
                    
                    console.log( "Websocket.GET: connection closed!" );
                    
                    try {
                        fclose();
                    } catch ( e ) {}
                    
                } );
                
                connection.on( 'message', function( message ) {
                
                    switch ( message.type ) {
                        
                        case 'utf8':
                            if ( filePacket ) {
                                
                                // File get request packet
                                
                                try {
                                    
                                    file = JSON.parse( message.utf8Data );
                                    
                                    if ( !file.name ) {
                                        throw "Invalid packet type!";
                                    }
                                    
                                    // console.log( file );
                                    
                                    fopen();
                                    
                                } catch ( e ) {
                                    error( e + "" );
                                }
                            
                            } else {
                                
                                // Acknowledge packet
                                
                                try {
                                    frame = JSON.parse( message.utf8Data );
                                    if ( !frame.ack ) {
                                        throw "Invalid packet type!";
                                    }
                                    fread();
                                
                                } catch ( e ) {
                                    error( e + "" );
                                }
                                
                            }
                            break;
                        default:
                            error( "WebSocket.GET: NON-UTF8 packets are forbidden on this websocket webservice!" );
                            break;
                    }
                } );
                
                break;
        
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
                
                console.log( "Got: " + binData.length + ", total = " + numRead + " / " + info.size );
                
                // Write ...
                if ( fd ) {
                
                    fs.write( fd, binData, 0, binData.length, null, function( err, written, callback ) {
                        
                        if ( err ) {
                            eventer.on( "error", "Failed to write " + binData.length + " bytes to local file!" );
                        } else {
                            // Send ack frame
                            connection.sendUTF( '{"ack": true}' );
                            currentProgress = ~~( numRead / ( info.size / 100 ) );
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
                
                console.log( "File transferred successfully" );
                
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
                
                console.log( "Doing cleanup..." );
                
                if ( fd ) {
                    
                    console.log( "Closing local file..." );
                    
                    try {
                        
                        fs.closeSync( fd );
                        
                        fd = null;
                    
                    } catch ( e ) {
                        
                        console.log( "Websocket.GET: Failed to close local file!: " + ( e || 'unknown error' ) );
                        
                    }
                    
                }
                
                if ( connection ) {
                    
                    console.log( "Closing websocket connection..." );
                    
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