exports.handle = function( response, request, urlInfo, controller ) {
    
    response.write("this is the worker temp dir. forbidden.");
    response.end();
    
}