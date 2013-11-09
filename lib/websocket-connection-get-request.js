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
    };
    
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
        
        console.log( "* SEND: " + segments.join( "/" ) );
        
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

};
