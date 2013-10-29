var Thing = require( __dirname + "/thing.js" ).Thing,
    Async = require( __dirname + "/async.js" ).Async,
    fs    = require( 'fs' ),
    mmm   = require( 'mmmagic' ),
    Magic = mmm.Magic;

function ApiFileController() {
    
    var me = new Thing(),
        
        // conf/file_types.cfg.json decoded
        fileTypes,
        
        // File types that are treated by this api file controller
        handlers = {
            "video": {},
            "audio": {},
            "image": {},
            "other": {}
        },
        
        fileParsers = {
            "VideoParser": require( __dirname + "/../parsers/Video.js" ).parser,
            "ImageParser": require( __dirname + "/../parsers/Image.js" ).parser
        },
        
        tasker = new Async(),
        
        ready = false,
        error = false;
    
    tasker.sync( function() {
        
        ( function( task ) {
        
            /* load ../file_types.cfg.json */
            
            try {
            
                buffer = fs.readFileSync( __dirname + '/../conf/file_types.cfg.json' );
                
                buffer = JSON.parse( buffer + '' );
                
                if ( !( buffer instanceof Object ) ) {
                    
                    throw "decoded json is not an object";
                    
                }
                
                fileTypes = buffer;
                
                task.on( 'success' );
            
            } catch ( error ) {
                
                task.on( 'error', "Failed to load conf/file_types.cfg.json as json (" + error + ")" );
                
            }
        })( this );
        
    } );
    
    tasker.sync( function() {
        
        // Load all tasks that can be used to test a file
        
        ( function( task ) {
            
            fs.readdir( __dirname + '/../tasks/', function( err, files ) {
                
                if ( err ) {
                    
                    task.on( 'error', "Failed to read controller tasks: " + err );
                    
                } else {
                    
                    var matches, func;
                    
                    try {
                    
                        for ( var i=0, len = files.length; i<len; i++ ) {
                            
                            if ( !!( matches = /^(video|audio|image|other)\.([a-zA-Z\d_\-]+)\.js$/.exec( files[i] ) ) ) {
                                
                                console.log( "Loading " + matches[1] + " task: " + matches[2] );
                                
                                try {
                                
                                    handlers[ matches[1] ][ matches[2] ] = func = require( __dirname + '/../tasks/' + files[i] ).task;
                                    
                                    if ( !func ) {
                                        throw "Failed to load task from 'tasks/" + files[i] + "'!";
                                    }
                                
                                } catch ( error ) {
                                    throw error;
                                }
                                
                            }
                            
                        }
                    
                        task.on( 'success' );
                    
                    } catch ( exception ) {
                        
                        task.on( 'error', exception + "" );
                        
                    }
                    
                }
                
            } );
            
        } )( this );
        
    } );
    
    tasker.run(
        function() {
            ready = true;
            console.log( "* ApiFileController READY" );
        },
        
        function( reason ) {
            console.log( "ApiFileController initialization error: " + ( reason || 'unknown reason' ) );
            error = true;
        }
    );
    
    me.handleFile = function( filePath, callback ) {
        
        callback = callback || function( err, result ) {
            if ( err )
                console.log( "Failed to handle file " + filePath + ": " + ( err || "unknown reason" ) );
            else
                console.log( "File " + filePath + " handled successfully: ", result );
        }
        
        var thread = new Async(),
            result = {},
            mimeType;
        
        thread.sync( function() {
            
            if ( fs.existsSync( filePath ) == false )
                this.on( 'error', "File " + filePath + " not found" );
            else
                this.on( 'success' );
            
        } );
        
        thread.sync( function() {
        
            var buffer = new Buffer( 65535 ),
                numRead = 0,
                fd = null,
                mime = new Magic( mmm.MAGIC_MIME_TYPE );
        
            ( function( task ) {
                
                fs.open( filePath, 'r', function( err, fd ) {

                    if ( err ) {
                        task.on( 'error', "Error opening file: " + err );
                        return;
                    }

                    fs.read( fd, buffer, 0, 65535, null, function( err, read, buff ) {

                        if ( err ) {
                            task.on( 'error', "Error reading from file: " + err );
                            return;
                        }

                        numRead = read;

                        buffer = buffer.slice( 0, numRead );

                        fs.closeSync( fd );

                        mime.detect( buffer, function( err, contentType ) {

                            if ( err ) {
                                task.on( 'error', "Failed to detect " + filePath + ": " + err );
                                return;
                            }
                            
                            result.contentType = contentType;
                            
                            task.on( 'success' );

                        } );
                    } );
                } );
            } )( this );
        });
        
        thread.sync( function() {
            
            // in result.contentType we have the mime of the file.
            
            result.fileInfo = null
            
            if ( typeof fileTypes[ result.contentType ] == 'object' ) {
                
                result.fileInfo = fileTypes[ result.contentType ];
                
            }
            
            this.on( 'success' );
            
        } );
        
        thread.sync( function() {
            
            // if result.fileInfo.parser, we use
            // the appropriated parser in order to parse the file
            
            if ( result.fileInfo ) {
                
                if ( result.fileInfo.parser ) {
                    
                    if ( !fileParsers[ result.fileInfo.parser ] ) {
                        
                        this.on( 'error', "Failed to parse file: parser " + result.fileInfo.parser + " is declared, but not loaded" );
                        
                    } else {
                        
                        ( function( task ) {
                            
                            // parse the file using the appropriated parser
                            
                            fileParsers[ result.fileInfo.parser ]( filePath, result.fileInfo, function( err, data ) {
                                
                                if ( err )
                                    task.on( 'error', "Failed to parse file '" + filePath + "': " + ( err || 'unknown error' ) );
                                
                                else {
                                    result.parserInfo = data;
                                    task.on( 'success' );
                                }
                            } );
                            
                        } )( this );
                        
                    }
                    
                } else this.on( 'success' );
                
            } else this.on( 'success' );
            
        } );
        
        thread.sync( function() {
            
            // Depending on fileInfo and parserInfo, we compute all the tasks that we can run
            // in order to store this file
            
            result.jobs = [];
            
            if ( result.fileInfo && result.fileInfo.type && result.parserInfo ) {
                 
                 var root;
                 
                 for ( var k in ( root = handlers[ result.fileInfo.type ] || {} ) ) {
                    
                    if ( 
                        root.propertyIsEnumerable( k ) && root.hasOwnProperty( k ) &&
                        typeof root[ k ] == 'function'
                    ) {
                        
                        try {
                        
                            var converterInfo = root[ k ]( result.fileInfo, result.parserInfo );
                            
                            if ( converterInfo && converterInfo.converter ) {
                                
                                converterInfo.jobType = result.fileInfo.type;
                                
                                result.jobs.push( converterInfo );
                                
                            }
                        
                        } catch ( e ) {
                            
                            console.log( "Converter tester '" + k + "' failed with exception: " + e );
                            
                        }
                        
                    }
                    
                 }
                 
            }
            
            this.on( 'success' );
            
        } );
        
        thread.run(
            function() {
                callback( false, result );
            },
            function( err ) {
                callback( err, false );
            }
        );
        
    }
    
    return me;
}

exports.ApiFileController = ApiFileController;