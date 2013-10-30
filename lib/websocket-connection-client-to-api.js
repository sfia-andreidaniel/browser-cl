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
    
    FileController = new ( require( __dirname + "/filecontroller.js" ).ApiFileController )()
    
    ;


exports.handleRequest = function( request, controller, httpServer, dataDir, additionalPaths ) {

    // console.log( "Api request!" );
    
    try {
    
        var connection = request.accept( 'api', request.origin );
    
    } catch ( error ) {

        console.log( "WebSocket.API: connection error: " + error );
        request.reject();
    
        return;
    }
        
    // console.log( "Websocket.API: connection accepted" );
    
    var tasker        = new async(),
        filePacket    = null,
        eventPhase    = 0,
        transferred   = 0,
    
        fd            = null, // file handle
        localFilePath = null, // local file real path on disk after upload completes
        
        responseBack  = {},
        
        remoteIp = request.socket._peername.address;
                
    var error = function( reason ) {
        
        try {
            tasker.on( 'error', reason || "Unknown reason" );
        } catch( e ) {
            console.log( "Tasker error: " + e );
        }
        
        // console.log("Websocket.API.error: ", reason );
    
        try {
            connection.sendUTF( JSON.stringify( {
                "ok": false,
                "error": true,
                "reason": reason || "unknown reason"
            } ) );
        } catch ( e ) {
            // Nothing
        }
        
        try {
            connection.close();
        } catch ( e ) {
            // Nothing
        }
    
    }
    
    tasker.sync( function() {
        
        // console.log( "Waiting for file packet...");
            
        ( function( task ) {
            
            tasker.currentTaskPhase = 'file-packet';
            tasker.currentTask = task;
            
        } )( this );
        
    });
    
    tasker.sync( function() {
        
        if ( controller.storagesCount == 0 )
            this.on( 'error', "No storages registered to api" );
        else
            this.on( 'success' );
        
    } );
    
    tasker.sync( function() {
        
        // console.log( "Transferring file..." );
        
        ( function (task) {
        
            tasker.currentTaskPhase = 'transfer-packet';
            tasker.currentTask = task;
            connection.sendUTF('{"ack":1, "phase": "transfer"}');
        
        } )( this );
    
    } );
    
    tasker.sync( function() {
        
        // console.log( "Sending response packet..." );
        
        ( function( task ) {
            
            tasker.currentTaskPhase = 'final-packet';
            tasker.currentTask = task;
            
            tasker.on( 'final-packet', true );
            
        } )( this );
        
    }, function() {
        
        // console.log( "Sent final packet!" );
        
    } );
    
    tasker.bind( 'reject-further-packets', function( data ) {
        console.log( "Warning: Unexpected packet from client-side" );
    } );
    
    tasker.sync( function() {
        
        ( function( task ) {
        
            tasker.currentTaskPhase = 'reject-further-packets';
            tasker.currentTask = task;
        
            console.log( "Detecting uploaded file..." );
            
            FileController.handleFile( localFilePath, function( err, result ) {
                
                // console.log( "File has been handled by the FileController" );
                
                if ( err ) {
                    task.on( 'error', "Failed to do post-upload file handle: " + ( err || 'unknown error' ) );
                } else {
                    
                    // console.log( "Storing file to cloud (passing request to master controller)" );
                    
                    controller.handleUpload({
                        "localFile": localFilePath,
                        "jobInfo": result,
                        "fileSize": filePacket.size,
                        "remoteIp": remoteIp
                    }, function( err, response ) {
                        
                        if ( err )
                            task.on( 'error', "Failed to store file to cloud: " + ( err || 'unknown error' ) );
                        else {
                            
                            responseBack = response;
                            task.on( 'success' );
                            
                        }
                        
                    });
                }
                
            } );
        
        } )( this );
        
    }, function() {
        console.log( "File detection completed successfully!" );
    } );
        
    tasker.bind( 'file-packet', function( data ) {
        
        if ( !(data instanceof Object) || !data.name || !data.size || data.size <= 0 ) {
            tasker.currentTask.on( 'error', "Bad file packet!");
        } else {
            
            filePacket = data;
            
            
            // Store file on api data-dir
            
            localFilePath = 
                dataDir + '/' + ( ( ( new Date() ).getTime() + '-' + ~~( Math.random() * 10000 ) + '-' + filePacket.name )
                .replace( /[^a-z0-9\.\-]+/gi, '-' ).replace( /\-\./g, '.' ).replace( /[\.]+/g, '.' ) );
            
            fs.open( localFilePath, 'w', function( err, handle ) {
                
                if ( err ) {
                    console.log( "Failed to create local file: " + localFilePath );
                    tasker.currentTask.on( 'error', 'Failed to create local file on disk!' );
                } else {
                    fd = handle;
                    console.log( "Receiving remote file: " + filePacket.name + " (" + filePacket.size + " bytes) in: " + localFilePath );
                    tasker.currentTask.on( 'success' );
                }
                
            } );
            
            
        }
        
    } );
    
    tasker.bind( 'transfer-packet', function( data ) {
        
        // console.log( "DTYPE: " + ( typeof data ) );
        
        // The data comes base64 encoded
        
        if ( ! ( typeof data == 'string' ) ) {
            // tasker.currentTask.on( 'error', "Expected a string packet!" );
            
            if ( Buffer.isBuffer( data ) ) {
            
                var fileData = data;
            
            } else {
                
                tasker.currentTask.on( 'error', "Expected either a string, either a binary packet" );
                return;
            }
            
        } else {
            // console.log( "DECODE: " + typeof data );
            try {
                var fileData = new Buffer( atob( data + "" ), 'binary' );
            } catch (err ) {
                tasker.currentTask.on( "error", "Failed to decode base64 frame: " + err );
            }
        }
        
        // console.log( fileData + "" );
        
        // console.log( "Data: " + fileData.length + ", type: " + ( typeof fileData ) );
        
        if ( fd ) {
            
            // console.log( "FS.write: " + fs );
            
            fs.write( fd, fileData, 0, fileData.length, null, function( err, written, buff ) {
            
                if ( !err ) {
            
                    transferred += fileData.length;
                    
                    switch ( true ) {
                        case transferred > filePacket.size:
                            tasker.currentTask.on( 'error', "File transfer error!" );
                            break;
                        case transferred == filePacket.size:
                            connection.sendUTF( '{"ack": 1, "phase": "transfer", "got": ' + fileData.length + "}" );
                            tasker.currentTask.on( 'success' );
                            break;
                        default:
                            connection.sendUTF( '{"ack": 1, "phase": "transfer", "got": ' + fileData.length + "}" );
                            break;
                    }
                    
                } else {
                    
                    tasker.currentTask.on( 'error', "Disk write error: " + err );
                    
                }
            
            } );
        
        } else tasker.currentTask.on( 'error', "Attempted to write on a non-opened-file" );
        
    } );
    
    tasker.bind( 'final-packet', function() {
        console.log( "File " + filePacket.name + " transferred!" );
        
        try {
            fs.closeSync( fd );
            fd = null;
            // console.log("INFO: Local file closed...");
        } catch ( err ) {
            tasker.currentTask.on( 'error', "Failed to close local file!" );
            return;
        }
        
        tasker.currentTask.on( 'success' );
        
    } );
    
    connection.on( 'message', function( event ) {
        switch ( event.type ) {
            case 'utf8':
                //console.log( "Utf8-Data: ", event.utf8Data, "\n" );
                try {
                    tasker.on( tasker.currentTaskPhase, JSON.parse( event.utf8Data ) );
                } catch ( err ) {
                    console.log( "UTF8 Frame error: " + err + ", data=" + event.utf8Data.substr( 0, 10 ) + "\"..." + ", phase=" + tasker.currentTaskPhase );
                    error( err + "" );
                }
                break;
            case 'binary':
                
                try {
                    tasker.on( tasker.currentTaskPhase, event.binaryData );
                } catch ( err ) {
                    console.log( "BINARY Frame error: " + err );
                    error( err + "" );
                }
                
                break;
            default:
                error("Unknown message type: " + event.type );
                break;
        }
    } );
    
    connection.on( 'close', function() {
        // console.log( "Connection closed" );
    } );
    
    connection.on( 'error', function( reason ) {
        try {
            error( "Connection error: " + ( reason || 'unknown' ) );
        } catch ( err ) {}
    } );
    
    var cleanup = function() {
        // Complete process, delete the file from the local api dir
        
        if ( fd ) {
            console.log( "Closing local file handle" );
            try {
                fs.closeSync(fd);
                fd = null;
            } catch ( e ) {
                console.log( "Failed to close local file handle: " + e );
            }
        }
        
        if ( localFilePath ) {
            console.log( "Removing local uploaded file: " + localFilePath );
            try {
                fs.unlinkSync( localFilePath );
                localFilePath = null;
            } catch( e ) {
                console.log( "Failed to remove local file: " + e );
            }
        }
        
    };
    
    tasker.run( function() {

        cleanup();

        console.log( "File transfer completed!" );
        
        connection.sendUTF( JSON.stringify({
            "name"  : filePacket.name,
            "size"  : filePacket.size,
            "files" : responseBack.files || {},
            "uploadId": responseBack.uploadId || -1
        }) );
        
        connection.close();
    
    }, function(err) {
        
        cleanup();
        
        console.log( "File transfer error: " + ( err || "Unknown error" ) );
        
        try {
            
            error( err );
            
        } catch( e ) {}
        
    }, function() {
        
        cleanup();
        
    } );

};
