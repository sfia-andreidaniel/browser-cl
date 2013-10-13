var fs = require('fs');

exports.handle = function( response, request, urlInfo, controller ) {
    
    response.write(
        fs.readFileSync( __dirname + '/index.html', { "encoding": "utf8" } )
    );
    
    response.end();
    

}

exports.async = false;