var path = ( process.env.PATH || '' ).split( /[\:\\]/ ),
    bins = {}, // A little caching for the binary files
    fs   = require('fs'),
    
module = {
    
    "which": function( binName, callback ) {
        
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
    }
    
};

exports.which = module.which;