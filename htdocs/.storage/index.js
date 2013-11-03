exports.handle = function( response, request, urlInfo, controller ) {
    
    response.write("this is the storage data dir / www dir. forbidden.");
    response.end();
    
};