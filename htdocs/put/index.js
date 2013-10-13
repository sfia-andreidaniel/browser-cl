var fs = require('fs');

exports.handle = function( response, request, urlInfo, controller ) {
    
    response.write(
        fs.readFileSync( __dirname + "/index.html" )
    );
    
    

}

exports.async = false;