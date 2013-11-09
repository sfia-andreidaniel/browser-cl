var fs = require( 'fs' );

exports.handle = function( response, request ) {
    
    response.write( ( fs.readFileSync( __dirname + '/index.html' ) + '' )
        .replace( /\%api\.js\%/, fs.readFileSync( __dirname + '/../../drivers/javascript/api.js' ) + '' ) );
    
}

exports.async = false;