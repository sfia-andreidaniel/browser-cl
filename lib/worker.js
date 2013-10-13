var Thing       = require( __dirname + '/thing.js' ).Thing,
    args        = require( __dirname + '/argv-utils.js' ).customArgs,
    workerPort  = require( __dirname + '/argv-utils.js' ).port,
    Remoting    = require( __dirname + '/remoting.js' ).Remoting,
    myPort      = require( __dirname + '/argv-utils.js' ).port;

console.log( args );

exports.Worker = function( ) {
    
    var me              = new Thing(),
        remote          = new Remoting( args.api_address || 'localhost:8080' ),
        apiIsOn         = false,
        apiIsRegistered = false;
    
    console.log( "Worker: Port = ", workerPort );
    
    // Event that is called at each 10 seconds, which
    // ensures the communication with the api and data
    // reporting
    me.bind( "loop", function() {
        
        if ( apiIsOn ) {
            
            remote.emmit( 'alive', {
                "port": workerPort
            }, function(){
                me.on( 'api-state', {
                    "state": true
                });
            }, function() {
                me.on( 'api-state', {
                    "state": false
                } );
            } );
            
        } else {

            me.on( 'subscribe' );

        }
    
    } );
    
    // Event that sends a subscription message to the
    // api
    me.bind( 'subscribe', function() {
    
        //console.log( "Worker: Subscribing to api as a worker..." );
    
        remote.emmit( 'worker-subscribe', {
            'port': myPort
        }, function( success ) {
            me.on( 'api-state', { 
                "state": true 
            } );
        }, function( error ) {
            me.on( 'api-state', { 
                "state": false 
            } );
        } );
    
    } );
    
    // Event that is triggered each time the state of the api registration state
    // changes. Called by event "subscribe"
    me.bind( 'api-state', function( data ) {
        
        if ( data.state == apiIsOn )
            return;

        data = data || {};
        data.state = data.state || false;
        
        console.log( "Worker: apiIsOn = " + data.state );

        apiIsOn = data.state;
    } );
    
    // The api sends also an alive back to the worker
    me.bind( 'alive', function( info ) {
        //console.log( "Worker: ping from api!" );
        
        info.response.write(JSON.stringify( {
            "ok": true
        } ) );
        
        info.response.end();
    } );
    
    me.interval( 'loop', function() {
        me.on( 'loop' );
    }, 10000 );
    
    /*
    me.bind( 'upload', function( info ) {
        
        me.putFile( args.api_address, '/bigFile', '/srv/www/websites/transcoder/big.mp4', function() {
            
            
            console.log("FILE UPLOADED SUCCESSFULLY!");
            
            info.response.write( "Success" );
            info.response.end();
            
        }, function(err) {
            info.response.write( "Error" );
            info.response.end();
            
            console.log("FILE COULD NOT BE UPLOADED: " + ( err || "unknown error" ) );
        }, function( progress ) {
            console.log( progress + "%" );
        } );

    } );
    */
    
    return me;
    
}