var Async       = require( __dirname + "/async.js" ).Async,
    Thing       = require( __dirname + "/thing.js" ).Thing,
    which       = require( __dirname + "/osutils.js" ).which,
    fs          = require( 'fs' ),
    spawn       = require('child_process').spawn,
    qtfaststart = require( __dirname + '/videotranscoder-qtfaststart.js' ).qtfaststart,
    
    which       = require( __dirname + '/osutils.js' ).which,
    
    paths       = {
        "ffmpeg": false,
        "ffmpeg2theora": false,
        "qtfaststart": false
    },
    
    capabilities = null
    ;


function detectCapabilities() {
    
    var tasker = new Async();
    
    tasker.sync( function( ) {
        ( function( task ) {
            
            which( 'ffmpeg', function( err, binPath ) {
                
                if ( !err )
                    paths.ffmpeg = binPath;
                
                task.on( 'success' );
                
            } );
            
        } )( this );
    } );

    tasker.sync( function( ) {
        ( function( task ) {
            
            if ( paths.ffmpeg )
                task.on( 'success' );
            else {
            
                which( 'ffmpeg.exe', function( err, binPath ) {
                    
                    if ( !err )
                        paths.ffmpeg = binPath;
                    
                    task.on( 'success' );
                    
                } );
            
            }
            
        } )( this );
    } );

    tasker.sync( function( ) {
        ( function( task ) {
            
            which( 'ffmpeg2theora', function( err, binPath ) {
                
                if ( !err )
                    paths.ffmpeg2theora = binPath;
                
                task.on( 'success' );
                
            } );
            
        } )( this );
    } );

    tasker.sync( function( ) {
        ( function( task ) {
            
            if ( paths.ffmpeg2theora )
                task.on( 'success' );
            else {
            
                which( 'ffmpeg2theora.exe', function( err, binPath ) {
                    
                    if ( !err )
                        paths.ffmpeg2theora = binPath;
                    
                    task.on( 'success' );
                    
                } );
            
            }
            
        } )( this );
    } );
    

    tasker.sync( function( ) {
        ( function( task ) {
            
            which( 'qtfaststart', function( err, binPath ) {
                
                if ( !err )
                    paths.qtfaststart = binPath;
                
                task.on( 'success' );
                
            } );
            
        } )( this );
    } );

    tasker.sync( function( ) {
        ( function( task ) {
            
            if ( paths.qtfaststart )
                task.on( 'success' );
            else {
            
                which( 'qtfaststart.exe', function( err, binPath ) {
                    
                    if ( !err )
                        paths.qtfaststart = binPath;
                    
                    task.on( 'success' );
                    
                } );
            
            }
            
        } )( this );
    } );
    
    tasker.sync( function() {
        
        var errors = [];
        
        if ( !paths.ffmpeg )
            errors.push( "ffmpeg not found!" );
        
        if ( !paths.ffmpeg2theora )
            errors.push( "ffmpeg2theora not found!" );
        
        if ( !paths.qtfaststart )
            errors.push( "qtfaststart not found!" );
        
        if ( !errors.length )
            this.on( "success" );
        else
            this.on( "error", errors.join( ", " ) );
        
    } );
    
    tasker.sync( function() {
        ( function( task ) {
        
            require( __dirname + '/ffmpeg-codecs.js' ).ffmpeg_capabilities( paths.ffmpeg, function( err, result ) {
                
                if ( err )
                    task.on( 'error', "Failed to get ffmpeg info: " + err );
                else {
                    
                    capabilities = result;
                    task.on( 'success' );
                }
                
            } );
        
        })( this );
    } );
    
    tasker.run( function() {
        
        console.log( "* video transcoder: ffmpeg = " + paths.ffmpeg + ", ffmpeg2theora = " + paths.ffmpeg2theora + ", qtfaststart = " + paths.qtfaststart );
        console.log( "* video codecs: ", capabilities.getCodecs( 'video' ).join( ", " ) );
        console.log( "* audio codecs: ", capabilities.getCodecs( 'audio' ).join( ", " ) );
        console.log( "* subtitle codecs: ", capabilities.getCodecs( 'audio' ).join( ", " ) );
        
    }, function( reason ) {
        
        console.log( "Failed to start video transcoder service: " + reason );
        
        process.exit( 1 );
        
    } );

}

exports.detect = detectCapabilities;

function Transcoder() {
    
    var me   = new Thing,
        args = [],
        tasker = new Async(),
        
        binaryName = 'ffmpeg',
        moveAtom = false,
        
        abortReason = false;
    
    me.addArgs = function() {
        for ( var i=0, len = arguments.length; i<len; i++ )
            args.push( arguments[i] );
        
        //console.log( args );
        
        return me;
    }
    
    Object.defineProperty( me, "capabilities", {
        "get": function( ) {
            return capabilities;
        }
    } );
    
    me.abortTask = function( reason ) {
        abortReason = reason || "The video transcoder preset aborted the job because of an unknown reason (missing ffmpeg capabilities?)";
    };
    
    me.addPreset = function( presetName, callback ) {
        
        me.on( 'status', " executing preset: " + presetName );
        
        var fullPresetPath;
        
        args     = [];
        moveAtom = false;
        abortReason = false;
        
        callback = callback || function( err, ok ) {
            if ( err )
                me.on( 'error', err );
        }
        
        fs.stat( fullPresetPath = __dirname + '/../presets/preset.' + presetName + ".js", function( err, stat ) {
            
            if ( err )
                callback( "Failed to stat preset file: " + err, false );
            else
                if ( stat.isFile() ) {
                    
                    try {
                        require( fullPresetPath ).preset( me );
                        
                        callback( false, true );
                        
                    } catch( err ) {
                        
                        callback( "Failed to run preset: " + err, false );
                        
                    }
                    
                } else
                    callback( fullPresetPath + " is not a file!", false );
        } );
        
        return me;
    }
    
    me.setBinaryName = function( binName ) {
        
        me.on( 'status', " seting binary transcoder name to " + binName );
        
        if ( [ 'ffmpeg', 'ffmpeg2theora' ].indexOf( binName ) == -1 )
            throw "Invalid binary name. Allowed only: ffmpeg and ffmpeg2theora";
        
        binaryName = binName;
    }
    
    me.enableQtFastStart = function() {
        moveAtom = true;
    };
    
    me.bind( 'stderr', function( buffer ) {
        
        var matches;
        
        if ( 'ffmpeg' == binaryName ) {
        
            if ( !!( matches = /(^|[\s]+)frame\=[\s]+([\d]+) /.exec( buffer ) ) )
                me.on( 'frame', ~~matches[2] );
            
            if ( !!( matches = /(^|[\s]+)time\=([\d]{2})\:([\d]{2})\:([\d]{2})\.([\d]{2}) /.exec( buffer ) ) ) {
                me.on( 'second', parseFloat( ( ( ~~(matches[2]) * 3600 ) + ( ~~( matches[3] ) * 60 ) + ~~matches[4] ) + '.' + matches[5] ) );
            }
        
        } else {
            
            // ffmpeg2theora output parser
            
            if ( !!( matches = /([\s]+)([\d]{1,2})\:([\d]{2})\:([\d]{2})\.([\d]{2}) audio\:/.exec( buffer ) ) ) {
                me.on( 'second', parseFloat( ( ( ~~(matches[2]) * 3600 ) + ( ~~( matches[3] ) * 60 ) + ~~matches[4] ) + '.' + matches[5] ) );
            }
            
        }
        
    } );
    
    /*
    me.bind( "stdout", function( buffer ) {
        
    } );
    */
    
    /* Callback is a function ( error, success )
     */
    
    me.run = function( inputFile, outputFile, presetName, callback ) {
        
        
        callback = callback || function( err, success ) {
            
            if ( err ) {
                console.log( "Error: " + err );
            } else {
                console.log( "Ok: " + success );
            }
            
        }
        
        if ( /\.ogv$/i.test( outputFile ) )
            me.setBinaryName( 'ffmpeg2theora' );
        else
            me.setBinaryName( 'ffmpeg' );
        
        me.addPreset( presetName );
        
        // obtain the full path to the binary
        
        var t = new Async(),
            processPath,
            procArgs = [],
            proc = null;
        
        t.sync( function() {
            if ( abortReason ) {
                this.on( "error", abortReason );
                abortReason = false;
                return;
            }
            
            this.on( 'success' );
        } );
        
        t.sync( function() {
            
            ( function( task ) {
                
                me.on( 'status', "1. Setting " + binaryName + " path to " + paths[binaryName] );

                processPath = paths[ binaryName ];
                
                task.on( 'success' );
                
            } )( this );
            
        } );
        
        t.sync( function() {
            
            me.on( "status", "2. Preparing command line" );
            
            // build command line
            
            switch (true) {
            
                case binaryName == 'ffmpeg':
                    
                    me.on( "status", "2.1 - using ffmpeg backend" );
                    
                    procArgs.push( '-y' );
                    procArgs.push( '-i' );
                    procArgs.push( inputFile );
                    
                    procArgs.push( '-threads' );
                    procArgs.push( 'auto' );
                    
                    for ( var i=0, len = args.length; i<len; i++ ) 
                        procArgs.push( args[i] );
                    
                    procArgs.push( outputFile );
                    
                    // console.log( "Transcoder: saving to: " + outputFile );
                    
                    this.on( 'success' );
                    
                    break;
                
                case binaryName == 'ffmpeg2theora':
                    
                    me.on( "status", "2.1 - using ffmpeg2theora backend" );
                    
                    procArgs.push( inputFile );
                    
                    for ( var i=0, len=args.length; i<len; i++ )
                        procArgs.push( args[i] );
                    
                    procArgs.push( outputFile );
                    
                    // console.log( "Transcoder: saving to: " + outputFile );
                    
                    this.on( 'success' );
                    
                    break;
                
                default:
                    this.on( 'error', "Unknown transcoder binary!" );
                    break;
            }
            
        } );
        
        t.sync( function() {
            
            // show command line
            
            me.on( 'status', "3. Executing: " + processPath + " '" + procArgs.join(' ') );

            ( function( task ) {

                proc = spawn( processPath, procArgs );
                
                proc.stdout.on( 'data', function( data ) {
                    me.on( 'stdout', data + '' );
                    // console.log( "\nstdout:\n " + data + "" );
                } );
                
                proc.stderr.on( 'data', function( data ) {
                    me.on( 'stderr', data + '' );
                    //console.log( "\nstderr:\n " + data + "" );
                } );
                
                proc.on( 'close', function( code ) {
                    
                    if ( code > 0 ) {
                        task.on( "error", "Process terminated with non-zero exit code: " + code );
                    } else {
                        task.on( 'success' );
                    }
                } );
                
            } )( this );
            
        } );
        
        // Test if output file exists
        t.sync( function() {
            
            try {

                if ( fs.existsSync( outputFile ) )
                    this.on( 'success' );
                else
                    this.on( 'error', "transcoded file not found after process completed" );
            
            } catch ( error ) {
                
                this.on( 'error', "Failed to check file exists: " + error );
                
            }
            
        } );
        
        // optional step: if qtfaststart is enabled, qtfaststart file...
        t.sync( function() {
            
            (function( task ) {
            
                if ( !moveAtom ) {
                    
                    task.on( 'success' );
                    return;
                    
                }
                
                me.on( 'status', '4. Moving atom at beginning of file (qtfaststart).' );
                
                qtfaststart( outputFile, function( err ) {
                    
                    if ( err )
                        task.on( "error", "qt-faststart failed: " + err );
                    else
                        task.on( "success" );
                    
                } );
            
            })( this );
            
        } );
        
        t.run(
            function() {
            
                callback( false, true );
            
            },
            function( error ) {
            
                if ( fs.existsSync( outputFile ) ) {
                    try {
                        fs.unlinkSync( outputFile );
                    } catch ( e ) {
                        
                    }
                }
                
                // error
                callback( "Error: " + ( error || 'unknown error' ) );
            },
            function() {
                // complete
                console.log( "Transcoding process completed!" );
            }
        );
    }
    
    /*
    me.onFrame = function( cb ) {
        if ( cb ) {
            me.bind( 'frame', cb );
        }
        
        return me;
    }
    */
    
    me.onStatus = function( cb ) {
        if ( cb ) {
            me.bind( 'status', cb );
        }
        
        return me;
    }
    
    me.onSecond = function( cb ) {
        if ( cb ) {
            me.bind( 'second', cb );
        }
        
        return me;
    }
    
    return me;
}

exports.transcoder = Transcoder;

/*

( new Transcoder() ).onStatus( function( status ) {
    
    console.log( "> " + status );
    
} ).onSecond( function( second ) {
    
    console.log( "t: ", second );
    
} ).run( '../file.mp4', '../file.360p.mp4', '360p_169', function( error, success ) {

    if ( error )
        console.log( "transcode error: " + error );
    else
        console.log( "transcode success: " + success );

} );

*/