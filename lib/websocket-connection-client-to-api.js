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
    
    FileController  = new ( require( __dirname + "/filecontroller.js" ).ApiFileController )()
    
    auth            = require( __dirname + '/registry.js' ).auth,
    
    integer         = require( __dirname + "/math.js" ).integer,
    
    Timeout         = require( __dirname + "/timeout.js" ).Timeout;


exports.handleRequest = function( request, controller, httpServer, dataDir, additionalPaths ) {

    // console.log( "Api request!" );
    
    try {
    
        var connection = request.accept( 'api', request.origin );
    
    } catch ( error ) {

        console.log( "WebSocket.API: connection error: " + error );
        request.reject();
    
        return;
    }
    
    controller.on( "connection-start" );
    
    // console.log( "Websocket.API: connection accepted" );
    
    var tasker         = new async(),
        filePacket     = null,
        eventPhase     = 0,
        transferred    = 0,
    
        fd             = null, // file handle
        localFilePath  = null, // local file real path on disk after upload completes
        
        responseBack   = {},
        
        remoteIp       = request.socket.remoteAddress,
        
        accountId      = 0,
        
        onlyFormats    = null,
        withoutFormats = null,
        
        // flag indicating weather we've announced the controller that the connection is terminated
        // to ensure that the max-connections from the command line is working
        sentCloseMessage = false;
        
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
    
    };
    
    var timeout = new Timeout( 1000, function() {
        
        error( "API Connection timeout" );
        
    } );
    
    tasker.sync( function() {
        
        timeout.noop();
        
        // console.log( "Waiting for file packet...");
            
        ( function( task ) {
            
            tasker.currentTaskPhase = 'file-packet';
            tasker.currentTask = task;
            
        } )( this );
        
    });
    
    tasker.sync( function() {
        
        timeout.noop();
        
        if ( controller.storagesCount == 0 )
            this.on( 'error', "No storages registered to api" );
        else
            this.on( 'success' );
        
    } );
    
    tasker.sync( function() {
        
        timeout.noop();
        
        // console.log( "Transferring file..." );
        
        ( function (task) {
        
            tasker.currentTaskPhase = 'transfer-packet';
            tasker.currentTask = task;


            if ( !controller.canHandleNewConnection() )
                task.on( "error", "api connection limit reached. please try again later!" );
            
            connection.sendUTF('{"ack":1, "phase": "transfer"}');
        
        } )( this );
    
    } );
    
    tasker.sync( function() {
        
        timeout.noop();
        
        // console.log( "Sending response packet..." );
        
        ( function( task ) {
            
            tasker.currentTaskPhase = 'final-packet';
            tasker.currentTask = task;
            
            tasker.on( 'final-packet', true );
            
        } )( this );
        
    });
    
    tasker.bind( 'reject-further-packets', function( data ) {
        console.log( "Warning: Unexpected packet from client-side" );
    } );
    
    tasker.sync( function() {
        
        timeout.noop();
        
        ( function( task ) {
        
            tasker.currentTaskPhase = 'reject-further-packets';
            tasker.currentTask = task;
        
            // console.log( "Detecting uploaded file..." );
            
            // From this point, we're not interested if the timeout
            // reaches.
            
            timeout.cancel();
            
            FileController.handleFile( localFilePath, function( err, result ) {
                
                // console.log( "File has been handled by the FileController" );
                
                if ( err ) {
                    task.on( 'error', "Failed to do post-upload file handle: " + ( err || 'unknown error' ) );
                } else {
                    
                    // if we have a job extension filter setting ( onlyFormats or withoutFormats ) we're doing filtering...
                    if ( result.jobs && result.jobs.length && ( !!onlyFormats || !!withoutFormats ) ) {
                        
                        var fjobs = []; // filter jobs array
                        
                        for ( var i=0, len = result.jobs.length; i<len; i++ ) {
                            if ( onlyFormats ) {
                                
                                if ( onlyFormats.indexOf( result.jobs[i].extension.toLowerCase() ) >= 0 )
                                    fjobs.push( result.jobs[i] );
                                
                            } else
                            if ( withoutFormats ) {
                                
                                if ( withoutFormats.indexOf( result.jobs[i].extension.toLowerCase() ) == -1 )
                                    fjobs.push( result.jobs[i] );
                                
                            }
                        }
                        
                        //override the jobs ...
                        result.jobs = fjobs;
                    }
                    
                    // save the jobInfo data, as we're going to send it to the client
                    
                    controller.handleUpload({
                        "localFile": localFilePath,
                        "jobInfo": result,
                        "fileSize": filePacket.size,
                        "remoteIp": remoteIp,
                        "accountId": accountId
                    }, function( err, response ) {
                        
                        if ( err )
                            task.on( 'error', "Failed to store file to cloud: " + ( err || 'unknown error' ) );
                        else {
                            
                            responseBack = response;
                            
                            responseBack.fileInfo = result.fileInfo;
                            responseBack.parsedFileInfo = result.parserInfo || {};
                            
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
        
        timeout.noop();
        
        if ( !(data instanceof Object) || !data.name || !data.size || data.size <= 0 ) {
            tasker.currentTask.on( 'error', "Bad file packet!");
        } else {
            
            filePacket = data;
            
            /* Test if the file packet has the key "formats", and the key
               "formats" is an object and contains EITHER an "only",
               either an "without" array with formats.
             */
            
            if ( data.options && data.options.formats ) {
                
                if ( !( data.options.formats instanceof Object ) ) {
                    tasker.currentTask.on( 'error', "options.formats was expected to be an object if mentioned!" );
                    return;
                }
                
                if ( !data.options.formats.only && !data.options.formats.without ) {
                    tasker.currentTask.on( 'error', "options.formats should contain either an 'only', either a 'without' field of type array" );
                    return;
                } else
                if ( data.options.formats.only && data.options.formats.without ) {
                    tasker.currentTask.on( 'error', "You can specify either an 'only', either an 'without' formats list, but not both!" );
                    return;
                }
                
                if ( data.options.formats.only ) {
                    
                    if ( !( data.options.formats.only instanceof Array ) ) {
                        task.currentTask.on( 'error', 'options.formats.only field should be an array of strings!' );
                        return;
                    } else onlyFormats = data.options.formats.only;
                    
                    if ( onlyFormats.length == 0 ) {
                        task.currentTask.on( 'error', 'options.formats.only contains no items!' );
                        return;
                    } else {
                        for ( var i=0, len = onlyFormats.length; i<len; i++ ){
                            
                            if ( typeof onlyFormats[i] != 'string' || onlyFormats[i] == '' ) {
                                task.currentTask.on( 'error', "Error encountered while validating options.formats.only[" + i + "]" );
                                return;
                            } else onlyFormats[i] = onlyFormats[i].toLowerCase();
                            
                        }
                    }
                    
                } else
                if ( data.options.formats.without ) {
                    
                    if ( !( data.options.formats.without instanceof Array ) ) {
                        task.currentTask.on( 'error', 'options.formats.without field should be an array of strings!' );
                        return;
                    } else withoutFormats = data.options.formats.without;
                    
                    if ( withoutFormats.length == 0 ) {
                        task.currentTask.on( 'error', 'options.formats.without contains no items!' );
                        return;
                    } else {
                        for ( var i=0, len = withoutFormats.length; i<len; i++ ){
                            
                            if ( typeof withoutFormats[i] != 'string' || withoutFormats[i] == '' ) {
                                task.currentTask.on( 'error', "Error encountered while validating options.formats.without[" + i + "]" );
                                return;
                            } else withoutFormats[i] = withoutFormats[i].toLowerCase();
                            
                        }
                    }
                }
                
            }
            
            /* Test to see if the file packet contains
               an api key.
             */
            
            auth( filePacket.options && filePacket.options.apiKey
                ? filePacket.options.apiKey
                : "",
                
                function( err, acctId ) {
                    
                    timeout.noop();
                    
                    if ( !err ) {
                    
                        // console.log( "API: ACCOUNT ID: ", acctId );
                        accountId = acctId;
                    
                        // Store file on api data-dir
                
                        localFilePath = 
                            dataDir + '/' + ( ( ( new Date() ).getTime() + '-' + integer( Math.random() * 10000 ) + '-' + filePacket.name )
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
                    
                    } else {
                        
                        tasker.currentTask.on( "error", "Please provide an api key in your options" );
                        
                    }
                    
                });
            
            
        }
        
    } );
    
    tasker.bind( 'transfer-packet', function( data ) {
        
        timeout.noop();
        
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
    
        timeout.noop();
    
        console.log( "API: received file " + filePacket.name );
        
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
        timeout.noop();
    
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
        if ( !sentCloseMessage ) {
            controller.on( 'connection-end' );
            sentCloseMessage = true;
        }
        
    } );
    
    connection.on( 'error', function( reason ) {
        try {
            error( "Connection error: " + ( reason || 'unknown' ) );
        } catch ( err ) {}
    } );
    
    var cleanup = function() {
        timeout.cancel();
        
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
            "uploadId": responseBack.uploadId || -1,
            "fileInfo": responseBack.fileInfo || {},
            "parserFileInfo": responseBack.parsedFileInfo || {}
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
