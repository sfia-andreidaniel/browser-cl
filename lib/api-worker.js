var Thing = require( __dirname + "/thing.js" ).Thing,
    Remoting = require( __dirname + '/remoting.js' ).Remoting;

exports.ApiWorker = function( workerIP, workerPort, api ) {
    
    var me = new Thing();
    
    var ip = workerIP;
    var port = workerPort;

    Object.defineProperty( me, "ip", {
        "get": function() {
            return ip;
        },
        "set": function() {
            throw "The IP property of a ApiWorker is read-only!";
        }
    } );

    Object.defineProperty( me, "port", {
        "get": function() {
            return port;
        },
        "set": function() {
            throw "The PORT property of a ApiWorker is read-only!";
        }
    } );

    me.api = api;
    me.remoting = new Remoting( me.ip + ':' + me.port );
    
    me.bind( 'ping-worker', function() {
        
        // console.log( "Pinging worker " + me.ip + ":" + me.port );
        
        me.remoting.emmit( 'alive', { 
            "alive": true,
            "for": "worker"
        }, function( success ) {
            // console.log( "pinged worker " + me.ip + ":" + me.port );
        }, function( error ) {
            // console.log( "failed to ping worker " + me.ip + ":" + me.port + ": " + ( error || 'unknown error' ) );
            me.api.on( 'worker-death', me );
        } );
        
    } );
    
    me.bind( 'ping', function() {
        //console.log( "ping from worker " + me.ip + ":" + me.port );
    } );
    
    me.blind( function() {
        console.log( "Worker bind event!" );
    } );

    me.reloadFirewall = function( callback ) {

        me.remoting.emmit( 'firewall-update', {
            "from": "api"
        }, function( ) {

            callback( false );

        }, function( reason ) {

            callback( reason + '' );

        } );

    };
    
    console.log("* Worker " + me.ip + ":" + me.port + " registered");
    
    return me;
}