var path  = ( process.env.PATH || '' ).split( /[\:\\]/ ),
    bins  = {}, // A little caching for the binary files
    fs    = require('fs'),
    async = require( __dirname + '/async.js' ).Async,
    spawn = require( 'child_process' ).spawn,
    units = {
        "kb": 1000,
        "k" : 1024,
        "mb": 1000000,
        "m" : 1048576,
        "gb": 1000000000,
        "g" : 1073741824,
        "tb": 1000000000000,
        "t" : 1099511627776,
        "pb": 1000000000000000,
        "p" : 1125899906842624
    };


/* @param str: a string representing a size
 */
var strtob = function( str, exception ) {

    var matches = /^([\d\.]+)([\s]+)?(kb|k|mb|m|gb|g|tb|t|pb|p)$/.exec( ( ( str + '' ) || '' ).toLowerCase() );
    
    exception = exception || false;
    
    return matches
        ? ( ~~matches[1] ) * units[ matches[3] ]
        : ( exception ? ( function() { throw "Invalid capacity representation: " + str; } )() : 0 );
};

var which = function( binName, callback ) {
        
    if ( bins[ binName ] ) {
        callback( false, bins[binName] );
        return;
    }
    
    var numPaths = path.length,
        pathIndex= 0;
    
    var next = function() {
    
        if ( pathIndex >= numPaths ) {
            callback( "Binary " + binName + " was not found", null );
        } else {
            
            ( function( ind ) {
            
                fs.stat( path[ ind ] + '/' + binName, function( err, statinfo ) {
                    
                    if ( err ) {
                        next();
                    } else {
                        
                        if ( statinfo.isFile() ) {
                            try {
                                
                                var fullPath = fs.realpathSync( path[ ind ] + '/' + binName );
                                
                                bins[ binName ] = fullPath;
                                
                                callback( null, fullPath );
                                
                            } catch ( e ) {
                                next();
                            }
                            
                        } else {
                            next();
                        }
                    }
                } );
            
            } )( pathIndex );
            
            pathIndex++;
        }
    }
    
    next();
};

/* @param folder = nullable string
       if folder === null, process.cwd will be used.
   @param callback = function( err, data )

*/

var statPath = function( folder, callback ) {
    
    folder = folder || process.cwd();
    
    var tasker = new async(),
        df     = null,
        result = null;
    
    tasker.sync( function() {
        
        if ( process.platform != 'linux' )
            this.on( 'error', 'sorry, this function is working only for linux' );
        else
            this.on( 'success' );
        
    } );
    
    tasker.sync( function() {
        
        ( function( task ) {
            
            which( 'df', function( err, bin ) {
                
                if ( err )
                    task.on( 'error', "command 'df' was not found: " + err );
                else {
                    df = bin;
                    task.on( 'success' );
                }
                
            } );
            
        } )( this );
        
    } );
    
    tasker.sync( function() {
        
        ( function( task ) {
            
            fs.exists( folder, function( exists ) {
                
                if ( exists ) {
                    
                    folder = fs.realpath( folder, function( err, resolvedPath ) {
                        
                        if ( err )
                            task.on( 'error', 'failed to find the real path of the folder: ' + err );
                        else {

                            result = {
                                'path': resolvedPath
                            };
                            
                            task.on( 'success' );
                        }
                        
                    } );
                    
                } else
                    task.on( 'error', 'path ' + folder + ' does not exists' );
                
            } );
            
        } )( this );
        
    } );
    
    tasker.sync( function() {
        
        ( function( task ) {
            
            try {
            
                var proc = spawn( df, [ '-h' ] ),
                    stdout = '';
                
                // result.df = df;
                
                proc.stdout.on( 'data', function( data ) {
                    stdout += ( data + '' );
                } );
                
                proc.on( 'close', function() {
                
                    var lines = stdout.split( "\n" ).slice( 1 );
                    
                    for ( var i=0, len = lines.length; i<len; i++ ) {
                        lines[i] = lines[i].split( /[\s]+/ );
                        if ( lines[i].length == 6 ) {
                            lines[i] = {
                                'dev': lines[i][0],
                                'size': lines[i][1],
                                'used': lines[i][2],
                                'free': lines[i][3],
                                'percentUsed': ~~(lines[i][4].replace(/\%$/,'')),
                                'mount': lines[i][5]
                            }
                        } else lines[i] = {
                            'error': true,
                            'mount': ''
                        };
                    }
                    
                    lines.sort( function( a, b ) {
                        return b.mount.length - a.mount.length;
                    } );
                    
                    // console.log( lines );
                    
                    for ( var i=0, len = lines.length; i<len; i++ ) {
                        
                        if ( !lines[i].error && result.path.substr( 0, lines[i].mount.length ) == lines[i].mount ) {
                            
                            result.parentDevice = lines[i].dev;
                            result.capacity = lines[i].size;
                            result.used = lines[i].used;
                            result.free = lines[i].free;
                            result.percentUsed = lines[i].percentUsed;
                            result.mountPoint = lines[i].mount;
                            
                            task.on( 'success' );
                            return;
                        }
                        
                    }
                    
                    task.on( 'error', "Failed to determine a mount entry for the path: " + folder );
                    
                } );
            
            } catch ( err ) {
                task.on( 'error', "Error (spawning df -h?): " + err );
            }
            
        } )( this );
        
    } );
    
    tasker.sync( function(){
        
        ( function( task ) {
            
            try {
                result.bytesCapacity = strtob( result.capacity, true );
                result.bytesUsed = strtob( result.used, true );
                result.bytesFree = strtob( result.free, true );
            } catch ( err ) {
                task.on( 'error', "Failed to convert df output to numbers: " + err );
                return;
            }
            
            task.on( 'success' );
            
        } )( this );
        
    } );
    
    tasker.run( function() {
        
        callback( false, result );
        
    }, function( reason ) {
        
        callback( reason, null );
        
    } );
    
}

// which ffmpeg?
exports.which    = module.which;

// statpath /path/to/my/folder
exports.statPath = statPath;

// strtobytes ( strtob( '32m' ) = ? )
exports.strtob   = strtob;

/*
    statPath( '/dev/shm', function( err, data ) {

    if ( err )
        console.log( "Error: " + err );
    else
        console.log( JSON.stringify( data ) );

} );
*/