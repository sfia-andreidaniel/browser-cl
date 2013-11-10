var cluster     = require( 'cluster' ),
    args        = require( __dirname + '/../lib/argv-utils.js' ).customArgs,
    dataDir     = null;

if ( !cluster.isMaster ) {
    
    if ( !args.data_dir ) {
        console.log( "Warning: Using default api data-dir: " + ( dataDir = __dirname + "/htdocs/.api" ) );
    } else {
        // console.log( "* Api.dataDir: " + ( dataDir = args.data_dir ) );
    }

    exports.upgradeWebserver = true;

    var Api = require( __dirname + '/../lib/api.js').Api,
        controller = new Api(),
        wsInterface = require( __dirname + '/../lib/websocket-interface.js' ).WebsocketInterface;

    exports.upgrade = function( httpserver ) {
        new wsInterface( controller, httpserver, dataDir, [ '/api/' ] );
    }

    // Tells the server that we're upgrading it, but that we
    // want also to serve http requests in it's native way
    exports.symbiosis = true;

    exports.controller = controller;
}