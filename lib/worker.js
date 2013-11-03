require( __dirname + '/videotranscoder.js' ).detect();

var Thing           = require( __dirname + '/thing.js' ).Thing,
    args            = require( __dirname + '/argv-utils.js' ).customArgs,
    workerPort      = require( __dirname + '/argv-utils.js' ).port,
    Remoting        = require( __dirname + '/remoting.js' ).Remoting,
    myPort          = require( __dirname + '/argv-utils.js' ).port,
    Executor        = require( __dirname + '/task-executor.js').Executor,
    ajax            = require( __dirname + '/ajax.js' ).$_JSON_GET,
    mail            = require( __dirname + '/mail.js' ),
    workerInterface = require( __dirname + '/argv-utils.js').listen;

args.api_address = args.api_address || 'localhost:8080';

exports.Worker = function( ) {
    
    var me              = new Thing(),
        remote          = new Remoting( args.api_address ),
        apiIsOn         = false,
        apiIsRegistered = false,
        dataDir         = args.data_dir || null,
        
        executor        = new Executor( args.api_address, me, dataDir ),
        synchronizedAtLeastOneTime = false;
    
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
        
        if ( apiIsOn )
            synchronizedAtLeastOneTime = true;
        
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
    
    me.bind( 'firewall-update', function( info ) {

        ajax( 'http://' + args.api_address + "/firewall/worker/", function( response ) {

            try {

                if ( !response || !response.data || !( response.data instanceof Array ) ) {
                    info.response.write( JSON.stringify( {
                        "error": true,
                        "reason": "Bad firewall data"
                    } ) );

                } else {

                    // Update conf/firewall.worker.js

                    var fs = require( 'fs' );

                    fs.writeFileSync( __dirname + '/../conf/firewall.worker.json', JSON.stringify( response.data ), { 'encoding': 'utf8' } );

                    // Flush firewall

                    require( __dirname + '/socket-utils.js' ).reloadFirewall();

                    info.response.write( JSON.stringify( {
                        "ok": true
                    } ) );

                    console.log( "* firewall reloaded" );

                }

            } catch ( error ) {
                info.response.write( JSON.stringify( {
                    "error": true,
                    "reason": error + ""
                } ) );
            }

            info.response.end();

        } );

    } );
    
    setTimeout( function() {

        if ( synchronizedAtLeastOneTime )
            return;

        if ( !mail.cloudWatchers )
            return;

        // If the worker does not synchronize to the api in 20 seconds, we considerr that an
        // issue, and report it ONCE to the cloudadmin person

        mail.textMail( mail.cloudWatchers, "Worker " + workerInterface + ":" + workerPort + " failed to connect to api", [
            "Hi,",
            "",
            "I am cloud worker running on " + workerInterface + ":" + workerPort + ", and I could not ",
            "connect to the api server " + args.api_address + " within 20 seconds from my startup.",
            "",
            "Please check my connection problems",
            "",
            "Event timestamp: " + ( new Date() ),
            "",
            "Thank you,",
            "",
            "PS: This mail is sent from an automated process, please do not reply to it"
        ].join( "\n" ), function( err ) {
            if ( err )
                console.log( "* WARNING: failed to send connection problem mail to cloud watchers group: " + err );
            else
                console.log( "* Notification: Failed to connect to api within 20 seconds. An email was sent to the cloud watchers group" );
        } );

    }, 20000 ).unref();
    
    return me;
    
}