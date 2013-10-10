exports.upgradeWebServer = true;

var Api = require( __dirname + '/../lib/api.js').Api,
    controller = new Api();

exports.upgrade = function( httpserver ) {
    console.log( "Upgrading web server!" );
}

exports.controller = controller;