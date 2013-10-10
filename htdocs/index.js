exports.handle = function( response, request, urlInfo ) {
    response.writeHeader( "Content-Type: text/plain" );
    response.write( "transcoder" );
}

//exports.async = true;