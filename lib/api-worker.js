var Thing = require( __dirname + "/thing.js" ).Thing,
    Remoting = require( __dirname + '/remoting.js' ).Remoting;

exports.ApiWorker = function( workerIP, workerPort, api ) {
    
    var me = new Thing();
    
    me.ip = workerIP;
    me.port = workerPort;
    me.api = api;
    me.remoting = new Remoting( me.ip + ':' + me.port );
    
    me.bind( 'ping-worker', function() {
        
        // console.log( "Pinging worker " + me.ip + ":" + me.port );
        
        me.remoting.emmit( 'alive', { 
            "alive": true 
        }, function( success ) {
            //console.log( "pinged worker " + me.ip + ":" + me.port );
        }, function( error ) {
            console.log( "failed to ping worked " + me.ip + ":" + me.port + ": " + ( error || 'unknown error' ) );
            me.api.on( 'worker-death', me );
        } );
        
    } );
    
    me.bind( 'ping', function() {
        //console.log( "ping from worker " + me.ip + ":" + me.port );
    } );
    
    me.blind( function() {
        console.log( "Worker bind event!" );
    } );
    
    console.log("Created new ApiWorker( ip=" + workerIP + ", port=" + workerPort +")" );
    
    return me;
}