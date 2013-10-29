var VideoParser = require( __dirname + '/../lib/videoparser.js' ).VideoParser;

exports.parser = function( file, detect, callback ) {
    
    detect = detect || {};
    
    if ( detect.type != 'video' ) {
        callback( "This parser works only for video files!", {} );
        return;
    }
    
    VideoParser( file, function( error, info ) {
        
        if ( error )
            callback( error, null );
        else
            callback( null, info );
        
    } );
    
}