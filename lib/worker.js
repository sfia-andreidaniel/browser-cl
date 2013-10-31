var Thing       = require( __dirname + '/thing.js' ).Thing,
    args        = require( __dirname + '/argv-utils.js' ).customArgs,
    workerPort  = require( __dirname + '/argv-utils.js' ).port,
    Remoting    = require( __dirname + '/remoting.js' ).Remoting,
    myPort      = require( __dirname + '/argv-utils.js' ).port,
    Executor    = require( __dirname + '/task-executor.js').Executor;

args.api_address = args.api_address || 'localhost:8080';

exports.Worker = function( ) {
    
    var me              = new Thing(),
        remote          = new Remoting( args.api_address ),
        apiIsOn         = false,
        apiIsRegistered = false,
        dataDir         = args.data_dir || null,
        
        executor        = new Executor( args.api_address, me, dataDir );
    
    me.isA = 'worker';
    
    if ( !dataDir )
        throw "Failed to initialize worker: no -data-dir argument specified!";
    
    console.log( "* Worker.Port = ", workerPort );
    console.log( "* Worker.DataDir = ", dataDir );
    
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
        
        console.log( "* Api " + args.api_address + " is " + ( data.state ? "up" : "down" ) );
        
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
    
    // put the executor process to work
    me.interval( 'next-rask', function() {
        
        if ( apiIsOn && executor.state == 'idle' )
            executor.next();
        
    }, 5000 );
    
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
    
    me.bind( 'download', function( info ) {
        
        me.getFile( args.api_address, '/etc/hosts', '/srv/www/websites/transcoder/htdocs/.worker/etc_hosts', function() {
            info.response.write( "Success" );
            info.response.end();
        }, function( err ) {
            info.response.write( "Error: " + ( err || 'unknown' ) );
            info.response.end();
        }, function( progress ) {
            console.log( progress + "%" );
        } );
        
    } );
    
    return me;
    
}