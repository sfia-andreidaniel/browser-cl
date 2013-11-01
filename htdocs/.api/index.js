exports.handle = function( response, request, urlInfo, controller ) {
    
    response.write("this is the api temp dir. forbidden");
    response.end();
    
}