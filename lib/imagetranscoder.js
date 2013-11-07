var Async = require( __dirname + "/async.js" ).Async,
    Thing = require( __dirname + "/thing.js" ).Thing,
    fs    = require( 'fs' ),
    gm    = require( 'gm' );

function Transcoder() {
    
    var me   = new Thing,
        args = [],
        tasker = new Async();
    
    me.addParams = function( ) {
        
        for ( var i=0, len = arguments.length; i<len; i++ ) {
            args.push( arguments[i] );
        }
        
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
        
        
        // obtain the full path to the binary
        
        var t = new Async();
        
        t.sync( function() {
            
            ( function( task ){
                me.addPreset( presetName, function( err ) {
                    if ( err )
                        task.on( 'error' );
                    else
                        task.on( 'success' );
                } );
            })( this );
            
        } );
        
        t.sync( function() {
            
            var img = gm( inputFile );
            
            // depending on the params object, we do
            // the image resizing logic in this task
            
            console.log( args );
            
            try {
                
                for ( var i=0, len = args.length; i<len; i++ ) {
                    ( function( arg ) {
                        
                        if ( arg && arg.method && arg.args ) {
                            
                            me.on( 'status', "doing: " + arg.method + "(" + arg.args.join( ', ' ) + ")" );
                            
                            img = img[ arg.method ].apply( img, arg.args );
                            
                        }
                        
                    } )( args[i] );
                }
            
                ( function( task ) {
            
                    img.write( outputFile, function( err ) {
                        
                        if ( err )
                            task.on( 'error', "Failed to save image: " + err );
                        else
                            task.on( 'success' );
                        
                    } );
                
                } )( this );
            
            } catch ( e ) {
                
                this.on( 'error', "Failed to transcode image: " + e );
                
            }
            
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
    
} ).run( '../file.jpg', '../file.32.png', 'thumb_32', function( error, success ) {

    if ( error )
        console.log( "transcode error: " + error );
    else
        console.log( "transcode success: " + success );

} );

*/