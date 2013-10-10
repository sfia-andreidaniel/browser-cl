var Thing = require( __dirname + '/thing.js' ).Thing,
    args  = require( __dirname + '/argv-utils.js' ).customArgs,
    Remoting = require( __dirname + '/remoting.js' ).Remoting,
    myPort = require( __dirname + '/argv-utils.js' ).port;

console.log( args );

exports.Worker = function( ) {
    
    var me = new Thing(),
        remote = new Remoting( args.api_address || '127.0.0.1:8081' );
    
    remote.emmit( 'worker-subscribe', {
        'port': myPort
    }, function( success ) {
        console.log("Worker: Registered to api!");
    }, function( error ) {
        console.log("Worker: Failed to register to api. Error: " + error );
    } );
    
    return me;
    
}