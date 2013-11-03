exports.handle = function( response, request, urlInfo ) {
    // response.writeHeader( "Content-Type: text/plain" );
    response.write( "null: " + JSON.stringify( urlInfo ) );
}

//exports.async = true;