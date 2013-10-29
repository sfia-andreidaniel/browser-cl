var Async = require( __dirname + "/async.js" ).Async,
    Thing = require( __dirname + "/thing.js" ).Thing,
    which = require( __dirname + "/osutils.js" ).which,
    fs    = require( 'fs' ),
    spawn = require('child_process').spawn;

function Transcoder() {
    
    var me   = new Thing,
        args = [],
        tasker = new Async(),
        
        binaryName = 'ffmpeg';
    
    me.addArgs = function() {
        for ( var i=0, len = arguments.length; i<len; i++ )
            args.push( arguments[i] );
        
        //console.log( args );
        
        return me;
    }
    
    me.addPreset = function( presetName, callback ) {
        
        var fullPresetPath;
        
        args = [];
        
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
        
        me.on( 'status', "Set binary name: " + binName );
        
        if ( [ 'ffmpeg', 'ffmpeg2theora', 'ffmpeg.exe', 'ffmpeg2theora.exe' ].indexOf( binName ) == -1 )
            throw "Invalid binary name. Allowed only: ffmpeg(.exe) and ffmpeg2theora(.exe)";
        
        binaryName = binName;
    }
    
    me.bind( 'stderr', function( buffer ) {
        
        var matches;
        
        if ( [ 'ffmpeg', 'ffmpeg.exe' ].indexOf( binaryName ) >= 0 ) {
        
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
            
            me.on( 'status', "step 1. Detecting " + binaryName + " path" );

            ( function( task ) {
                
                which( binaryName, function( err, path ){
                    if ( err ) {
                        task.on( 'error', binaryName + " not found( " + err + ")" );
                    } else {
                        processPath = path;
                        task.on( 'success' );
                    }
                });
                
            } )( this );
        } );
        
        t.sync( function() {
            
            me.on( "status", "step 2. Preparing command line" );
            
            // build command line
            
            switch (true) {
            
                case [ 'ffmpeg', 'ffmpeg.exe' ].indexOf( binaryName ) >= 0:
                    
                    me.on( "status", "step 2.1 - using ffmpeg backend" );
                    
                    procArgs.push( '-y' );
                    procArgs.push( '-i' );
                    procArgs.push( inputFile );
                    
                    procArgs.push( '-threads' );
                    procArgs.push( 'auto' );
                    
                    for ( var i=0, len = args.length; i<len; i++ ) 
                        procArgs.push( args[i] );
                    
                    procArgs.push( outputFile );
                    
                    this.on( 'success' );
                    
                    break;
                
                case [ 'ffmpeg2theora', 'ffmpeg2theora.exe' ].indexOf( binaryName ) >= 0:
                    
                    me.on( "status", "step 2.1 - using ffmpeg2theora backend" );
                    
                    procArgs.push( inputFile );
                    
                    for ( var i=0, len=args.length; i<len; i++ )
                        procArgs.push( args[i] );
                    
                    procArgs.push( outputFile );
                    
                    this.on( 'success' );
                    
                    break;
                
                default:
                    this.on( 'error', "Unknown transcoder binary!" );
                    break;
            }
            
        } );
        
        t.sync( function() {
            
            // show command line
            
            me.on( 'status', "step 3. Executing: " + processPath + " '" + procArgs.join(' ') );

            ( function( task ) {

                proc = spawn( processPath, procArgs );
                
                proc.stdout.on( 'data', function( data ) {
                    me.on( 'stdout', data + '' );
                    // console.log( "\nstderr:\n " + data + "" );
                } );
                
                proc.stderr.on( 'data', function( data ) {
                    me.on( 'stderr', data + '' );
                    // console.log( "\nstderr:\n " + data + "" );
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
        
        
        t.run(
            function() {
            
                if ( fs.existsSync( outputFile ) ) {
                    // success
                    callback( false, true );
                } else {
                    
                    callback( "Transcoded file not found after process completed", false );
                    
                }
            
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