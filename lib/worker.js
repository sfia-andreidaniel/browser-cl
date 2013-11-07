require( __dirname + '/videotranscoder.js' ).detect();

var Thing           = require( __dirname + '/thing.js' ).Thing,
    args            = require( __dirname + '/argv-utils.js' ).customArgs,
    workerPort      = require( __dirname + '/argv-utils.js' ).port,
    Remoting        = require( __dirname + '/remoting.js' ).Remoting,
    myPort          = require( __dirname + '/argv-utils.js' ).port,
    Executor        = require( __dirname + '/task-executor.js').Executor,
    ajax            = require( __dirname + '/ajax.js' ).$_JSON_GET,
    mail            = require( __dirname + '/mail.js' ),
    workerInterface = require( __dirname + '/argv-utils.js').listen,
    Dirty           = require( __dirname + '/dirty.js' ),
    JobsQuery       = require( __dirname + '/registry.js' ).JobsCollection,
    Async           = require( __dirname + '/async.js' ).Async

;

args.api_address = args.api_address || 'localhost:8080';

exports.Worker = function( ) {
    
    var me              = new Thing(),
        remote          = new Remoting( args.api_address ),
        apiIsOn         = false,
        apiIsRegistered = false,
        dataDir         = args.data_dir || null,
        
        executor        = new Executor( args.api_address, workerInterface + ':' + workerPort, me, dataDir ),
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
    
    me.bind( 'clean-dirty', function( data ) {
        // We want on first synchronization with the server
        // to clean the dirty jobs, and set their status to "error"
        
        Dirty.get_dirty( function( err, files ) {
            
            if ( err ) {
                process.stderr.write( [
                    "The worker failed to get it's dirty jobs list",
                    "This migth be possibly caused by not enough permissions to read folder",
                    "var/dirty/.",
                    "",
                    "Error was: " + err,
                    "",
                    "In order to avoid errors, the worker will exit now!"
                ].join( "\n" ) );
                
                process.exit( 1 );
            }
            
            if ( !files.length )
                return;
            
            // Search the tasks on the api, and for each task set
            // it's status to error.
            
            var apiQuery = new JobsQuery();
            
            apiQuery.remoteFind( args.api_address, 0, 1000, {
                    "taskId": {
                        "$in": files
                    }
                }, function( err ) {
                    
                    if ( err ) {
                        
                        console.log( "Failed to interogate the api for the dirty jobs: " + files.join( ", " ) );
                        console.log( "Error was: " + err );
                        console.log( "The jobs will remain in their dirty state untill next worker restart" );
                    
                    }
                    
                    var tasker = new Async();
                    
                    apiQuery.each( function( job ) {
                        
                        tasker.sync( function() {
                            
                            ( function( task ) {
                                console.log( "* marking the job #" + job.taskId + " as error on server" );
                                
                                if ( job.taskStatus == 'error' ) {
                                    task.on( 'success' );
                                } else {
                                    
                                    job.setStatus( 'error', function( err ) {
                                        if ( !err )
                                            task.on( 'success' );
                                        else
                                            task.on( 'error', "* failed to mark the job #" + job.taskId + " as error on server: " + err );
                                    } );
                                    
                                }
                                
                            })( this );
                            
                        } );
                        
                    });
                    
                    tasker.run( function() {
                        // When all the jobs are successfully reported to server as errors,
                        // we make them clean on the worker.
                        
                        for ( var i=0, len = files.length; i<len; i++ ) {
                        
                            ( function( jobId ) {
                        
                                Dirty.set_clean( jobId, function( err ) {
                                    
                                    if ( err )
                                        console.log( "* failed to set as clean the status of the dirty job #" + jobId + ": " + err );
                                    else
                                        console.log( "* the dirty job #" + jobId + " has been successfully reported to the api" );
                                    
                                } );
                            
                            })( files[i] );
                        }
                        
                    }, function( err ) {
                        
                        console.log( [
                            "An error was encountered in the dirty cleanup worker process.",
                            "The dirty jobs will be reported again on next worker restart",
                            "",
                            "The error was: " + err,
                            ""
                        ].join( "\n" ) );
                        
                    } );
                    
                });
            
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
        
        if ( apiIsOn ) {
            synchronizedAtLeastOneTime = true;
            me.on( 'clean-dirty' );
        }
        
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
                    info.response.sendError( "Bad firewall data" );
                } else {

                    // Update conf/firewall.worker.js

                    var fs = require( 'fs' );

                    fs.writeFileSync( __dirname + '/../conf/firewall.worker.json', JSON.stringify( response.data ), { 'encoding': 'utf8' } );

                    // Flush firewall

                    require( __dirname + '/socket-utils.js' ).reloadFirewall();

                    info.response.write( JSON.stringify( {
                        "ok": true
                    } ) );
                    info.response.end();

                    console.log( "* firewall reloaded" );

                }

            } catch ( error ) {
                info.response.sendError( error + "" );
            }

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