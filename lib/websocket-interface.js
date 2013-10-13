var WebSocketServer = require('websocket').server,
    WebSocketClient = require('websocket').client,
    mkdirp = require('mkdirp'),
    fs = require('fs');

exports.WebsocketInterface = function( controller, httpServer, dataDir ) {
    
    console.log( "Initialize controller websocket interface for /put requests..." );
    
    controller.wsServer = new WebSocketServer( {
        "httpServer": httpServer,
        "autoAcceptConnections": false
    } );
    
    controller.wsServer.on( 'request', function( request ) {
        
        console.log( "Websocket: new request!" );
        
        if ( request.resourceURL.path != '/put/' ) {
            console.log( "Websocket: invalid websocket path " + request.resourceURL.path );
            request.reject();
            return;
        }
        
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
                            
                            console.log( file );
                            
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
                            error("File overflow!");
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
        
    } );
    
    // Puts a file to a node
    controller.putFile = function( targetIpPort, remotePath, localPath, success, error ) {
        
        
        
    }
}