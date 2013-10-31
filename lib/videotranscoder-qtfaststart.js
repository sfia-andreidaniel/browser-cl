var which = require( __dirname + '/osutils.js' ).which,
    Async = require( __dirname + '/async.js' ).Async,
    fs    = require( 'fs' ),
    spawn = require( 'child_process' ).spawn;


function qtfaststart( file, callback ) {
    
    var tasker = new Async(),
        binpath= null;
    
    tasker.sync( function() {
        
        ( function( task ) {
            
            fs.exists( file, function( exists ) {
                
                if ( exists ) {

                    which( "qtfaststart", function( err, path ) {
        
                        if ( err )
                            task.on( 'error', "failed to locate qtfaststart. please read 'tools/install-qtfaststart.txt' file for info on how to install it!" );
                        
                        else {
                            binpath = path;
                            task.on( 'success' );
                        }
                    } );
                    
                } else
                    task.on( "error", "input file " + file + " does not exists!" );
                
            } );
            
        })( this );
        
    } );
    
    tasker.sync( function() {
        
        ( function( task ) {
            
            
            var proc = spawn( binpath, [ file ] );
            
            var pipes = {
                "out": "",
                "err": ""
            };
            
            proc.stdout.on( 'data', function( data ) {
                
                pipes.out += ( data + '' );
                
                //console.log( "out: " + data );
            } );
            proc.stderr.on( 'data', function( data ) {
                //console.log( "err: " + data );
                
                pipes.err += ( data + '' );
            } );
            
            proc.on( 'close', function( code ) {
                // console.log( "CODE: " + code );
                
                // console.log( pipes );
                
                switch ( true ) {
                    
                    case !!/moov atom not found/.test( pipes.out ):
                        task.on( 'error', "not a valid mp4 file!" );
                        break;
                    
                    case pipes.err != '':
                        task.on( 'error', pipes.err );
                        break;
                    
                    case !!/file appears to already be setup/.test( pipes.out ):
                        task.on( 'success' );
                        break;
                    
                    default:
                        task.on( 'success' );
                        break;
                    
                }
                
                
            } );
            
        } )( this );
        
    } );
    
    tasker.run( function() {
        
        callback( false );
        
    }, function( err ) {
        
        callback( err );
        
    } );
    
}

exports.qtfaststart = qtfaststart;

/*
qtfaststart( "../samplefiles/file.mp4", function( err ) {
    
    if ( err )
        console.log("failed: " + err );
    else
        console.log("success");
    
} );
*/