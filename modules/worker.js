exports.upgradeWebServer = true;

var Worker = require( __dirname + '/../lib/worker.js' ).Worker,
    controller = new Worker();

exports.controller = controller;