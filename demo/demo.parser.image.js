var parser = require( __dirname + '/parsers/Image.js' ).parser;

parser( "file.jpg.bin", {
    "type": "image",
    "extension": "jpg",
    "mime": "image/png"
}, function( err, data ) {
    
    if ( err ) {
        console.log( "Error parsing: " + err );
    } else
        console.log( "Parse result: ", data );
    
} );