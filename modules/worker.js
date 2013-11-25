var cluster     = require('cluster'),
    args        = require( __dirname + '/../lib/argv-utils.js' ).customArgs,
    dataDir     = null;

if ( !cluster.isMaster ) {
    if ( !args.data_dir ) {
        console.log( "Warning: Using default api data-dir: " + ( dataDir = __dirname + "/htdocs/.worker" ) );
    } else {
        dataDir = args.data_dir;
        // console.log( "* Worker.dataDir: " + ( dataDir = args.data_dir ) );
    }

    exports.upgradeWebserver = true;

    var Worker = require( __dirname + '/../lib/worker.js' ).Worker,
        controller = new Worker(),
        wsInterface = require( __dirname + '/../lib/websocket-interface.js' ).WebsocketInterface;;

    exports.upgrade = function( httpserver ) {
        new wsInterface( controller, httpserver, dataDir );
    }

    // Tells the server that we're upgrading it, but that we
    // want also to serve http requests in it's native way
    exports.symbiosis = true;

    exports.controller = controller;
}