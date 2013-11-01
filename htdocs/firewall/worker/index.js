var fs = require( 'fs' );

exports.handle = function( response, request, urlInfo, controller ) {
    
    console.log( "* worker firewall update request from " + request.socket.remoteAddress );
    
    try {

        if ( !controller || controller.isA != 'api' )
            throw "operation permitted only on api controller";

        response.write( JSON.stringify( {
            "ok": true,
            "data": JSON.parse( fs.readFileSync( __dirname + "/../../../conf/firewall.worker.json" ) + '' )
        } ) );
    
    } catch ( error ) {
        response.write( JSON.stringify( {
            
            "error": true,
            "reason": error + ""
            
        } ) );
    }
    
    response.end();
    
};

exports.async = false;