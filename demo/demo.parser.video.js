var parser = require( __dirname + '/parsers/Video.js' ).parser;

parser( "file.avi", {
    "type": "video",
    "extension": "mp4",
    "mime": "video/mp4"
}, function( err, data ) {
    
    if ( err ) {
        console.log( "Error parsing: " + err );
    } else
        console.log( "Parse result: ", data );
    
} );