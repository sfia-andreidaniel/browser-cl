/* This script is used by the transcoder, in order to:

   - mark a job as "dirty" when starts it
   - mark a job as "clean" when it completes it (either with error or success)
   
   - at bootup, all dirty jobs are marked as clean and also reported to api as
     errors
   
   This mechanism is to ensure that the transcoder doesn't remain
   hanged at a point, and the jobs remain in an unconsistent state.
   
   
*/

var fs      = require( 'fs' ),
    integer = require( __dirname + '/math.js' ).integer;

// @param: jobId: <int>
// @param: callback: function( err )

function set_dirty( jobId, callback ) {
    
    fs.writeFile( __dirname + "/../var/dirty/" + jobId + ".dirty", ( new Date() ).toString(), function( err ) {
        if ( err )
            callback( "Failed to mark job #" + jobId + " as dirty: " + err );
        else
            callback( false );
    } );

}

// @param: jobId: <int>
// @param: callback: function( err )

function set_clean( jobId, callback ) {
    
    fs.exists( __dirname + "/../var/dirty/" + jobId + ".dirty", function( exists ) {
        
        if ( !exists )
            callback( false );
        else
            
            fs.unlink( __dirname + "/../var/dirty/" + jobId + ".dirty", function( err ) {
                if ( err )
                    callback( "Failed to mark job #" + jobId + " as clean: " + err );
                else
                    callback( false );
            });
        
    } );
    
}

// @param: callback: function( err, jobsIDList[] )

function get_dirty( callback ) {
    
    fs.readdir( __dirname + "/../var/dirty/", function( err, files ) {
        
        if ( err ) {
            callback( "Failed to get dirty jobs list: " + err );
        } else {
            
            var out = [],
                matches;
            
            for ( var i=0, len = files.length; i<len; i++ ) {
                
                if ( !!( matches = /^([\d]+)\.dirty$/.exec( files[i] ) ) )
                    out.push( integer( matches[1] ) );
                
            }
            
            callback( false, out );
            
        }
        
    } );
    
}

exports.set_dirty = set_dirty;
exports.set_clean = set_clean;
exports.get_dirty = get_dirty;
