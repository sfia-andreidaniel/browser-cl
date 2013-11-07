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
    fileSegment = /^[\w \-\_\[\]\{\}\;\"\'\,\.]+$/ //" mc bug syntax highlighter
    
    ;

exports.handleRequest = function( request, controller, httpServer, dataDir, additionalPaths ) {
    
    var connection = request.accept( 'file', request.origin );
    // console.log( "Websocket.PUT: connection accepted" );

    var error = function ( reason ) {
        console.log( "PUT error: ", reason );
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
                console.log( "PUT: Failed to unlink file: " + dataDir + "/" + file.name + ": " + e );
            }
        }
    };
    
    var fopen = function() {
        var fileParts = file.name.split('/'),
            segments  = [];
        
        for ( var i=0, len = fileParts.length; i<len; i++ ) {
            
            if ( !fileParts[i] )
                continue;
            
            if ( fileParts[i] == '..' || fileParts[i] == '.' ||
                 !fileSegment.test( fileParts[i] )
            ) {
                
                error("PUT: Invalid file name!");
                return;
            } else {
                segments.push( fileParts[i] );
            }
        }
        
        if ( !segments.length ) {
            error("PUT: Invalid file name!" );
            return;
        }
        
        var targetDir = segments.slice( 0, segments.length - 1 ).join( '/' ),
            fileName  = segments[ segments.length - 1 ],
            realDir   = null;
        
        var openFile = function() {
            
            fs.stat( realDir + '/' + fileName, function( err, stats ) {
                
                if ( !err ) {
                    
                    error( "PUT: File allready exists!" );
                    return;
                    
                } else {
                    
                    fs.open( realDir + "/" + fileName, 'w', function( err, descriptor ) {
                        
                        if ( err ) {
                            error( "PUT: Failed to open file for writing: " + realDir + "/" + fileName );
                        } else {
                            
                            fd = descriptor;
                            
                            connection.send( JSON.stringify({
                                "file": file.name,
                                "opened": true
                            }));
                            
                            // fs.closeSync( fd ); // close file
                            
                            filePacket = false;
                            
                            console.log( "* PUT: Created file: " + file.name + " in " + dataDir );
                        }
                        
                    } );
                
                }
            
            } );
            
        };
        
        // compute destination data dir
        if ( targetDir ) {
            mkdirp( dataDir + "/" + targetDir, function( err ) {
                if ( err ) {
                    error("PUT: Failed to create directory: " + targetDir + ": " + err );
                } else {
                    realDir = dataDir + "/" + targetDir;
                    openFile();
                }
            } );
        } else {
            realDir = dataDir;
            openFile();
        }
    }; // end of fopen();
    
    var fwrite = function( data, offset ) {
        
        if ( fd ) {
            fs.write( fd, data, 0, data.length, offset, function(err, written, buffer) {
                if ( err ) {
                    error("PUT: Failed to write in file: " + err );
                    unlink();
                    return;
                } else {
                    connection.send( JSON.stringify({
                        "written": written
                    }) );
                }
            } );
        }
        
    }; // end of fwrite();
    var fclose = function() {
        
        if ( fd ) {
            fs.close( fd, function( err ) {
                if ( err ) {
                    error( "PUT: Error closing file: " + file.name + ": " + err );
                    unlink();
                } else {
                    connection.send( JSON.stringify({
                        "success": true
                    }) );
                    
                    //console.log( "WebSocket.PUT: Closed file: " + file.name + " from " + dataDir );
                }
            } );
        }
        
    }; // end of fclose()
            
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
                } else error( "PUT: Expected a binary packet from client!" );
                break;
            case 'binary':
                if ( filePacket )
                    error( "PUT: Expected file packet first from client!" );
                else {
                    var data = message.binaryData,
                        len  = data.length,
                        offset = wrote;
                    
                    wrote += len;
                    
                    if ( wrote > file.size )
                        error("PUT: File overflow (" + wrote + ">" + file.size + ", last len=" + len + ")" );
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
                error( "PUT: Unexpected packet type!" );
                break;
        }
    } );
    
    connection.on( "close", function( reason, description ) {
        //console.log("WebSocket.PUT:  connection closed" );
    } );
};
