var gm = require( 'gm' );

exports.parser = function( file, detect, callback ) {
    
    detect = detect || {};
    
    if ( detect.type != 'image' || [ 'jpg', 'gif', 'png' ].indexOf( detect.extension ) == -1 ) {
        callback( "Bad file type or extension", {} );
        return;
    }
    
    var cb = function( err, image ) {
        if ( err || !image ) {
            callback( "Error parsing image: " + ( !image ? "General failure" : err ), {} );
        } else {
            callback( false, {
                "width": image.width || -1,
                "height": image.height || -1
            } );
        }
    }
    
    gm( file ).size( function( err, size ) {
        
        if ( err )
            cb( err, null );
        else
            cb( false, {
                "width": size.width,
                "height": size.height
            } );
        
    } );
}