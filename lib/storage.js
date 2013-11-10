var Thing            = require( __dirname + '/thing.js' ).Thing,
    args             = require( __dirname + '/argv-utils.js' ).customArgs,
    storagePort      = require( __dirname + '/argv-utils.js' ).port,
    Remoting         = require( __dirname + '/remoting.js' ).Remoting,
    myPort           = require( __dirname + '/argv-utils.js' ).port,
    ajax             = require( __dirname + '/ajax.js' ).$_JSON_GET,
    storageInterface = require( __dirname + '/argv-utils.js' ).listen,
    mail             = require( __dirname + '/mail.js' ),
    strtob           = require( __dirname + '/osutils.js' ).strtob,
    btostr           = require( __dirname + '/osutils.js' ).btostr,
    integer          = require( __dirname + '/math.js' ).integer,
    statPath         = require( __dirname + '/osutils.js' ).statPath
;

exports.Storage = function( ) {
    
    var me                         = new Thing(),
        remote                     = new Remoting( args.api_address || 'localhost:8080' ),
        apiIsOn                    = false,
        apiIsRegistered            = false,
        wwwPath                    = args.www || 'http://localhost/',
        dataDir                    = args.data_dir,
        synchronizedAtLeastOneTime = false,
        quotaSizeLimit             = strtob( args.quota_limit || 'missing -quota-limit argument', true ),
        reservedSpace              = quotaSizeLimit,
        freeSpaceWarnLevel         = null,
        freeSpaceWarnLevelParam    = null;
    
    ( function() {
        var matches;
        
        if ( typeof args.free_space_warn_level != 'undefined' ) {
            
            freeSpaceWarnLevel = String( args.free_space_warn_level );
            
            switch ( true ) {
                
                case !!( matches = /([\d]+)\%$/.exec( freeSpaceWarnLevel ) ):
                    freeSpaceWarnLevel = ~~matches[1];
                    freeSpaceWarnLevelParam = 'percentUsed';
                    break;
                
                default:
                    freeSpaceWarnLevel = strtob( freeSpaceWarnLevel );
                    freeSpaceWarnLevelParam = 'bytesFree';
                    break;
            }
            
        }
    })();
    
    me.isA = 'storage';
    
    if ( !dataDir )
        throw "Failed to initialize storage: no data-dir argument passed in the command line!";
    
    console.log( "* Storage.Port                  = ", storagePort );
    console.log( "* Storage.Www                   = ", wwwPath );
    console.log( "* Storage.DataDir               = ", args.data_dir );
    console.log( "* Storage.QuotaSizeLimit        = ", btostr( quotaSizeLimit ) );
    
    if ( freeSpaceWarnLevel ) {
        console.log( "* Storage.FreeSpaceWarningLevel = ",
            ( freeSpaceWarnLevelParam == 'percentUsed' 
                ? freeSpaceWarnLevel + '%'
                : btostr( freeSpaceWarnLevel )
            )
        );
    }
    
    // Event that is called at each 10 seconds, which
    // ensures the communication with the api and data
    // reporting
    me.bind( "loop", function() {
        
        if ( apiIsOn ) {
            
            remote.emmit( 'alive', {
                "port": storagePort
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
    
        remote.emmit( 'storage-subscribe', {
            'port': myPort,
            'www': wwwPath
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
        
        if ( apiIsOn ) {
            synchronizedAtLeastOneTime = true;
            me.on( 'update-quota' );
        }
        
    } );
    
    // The api sends also an alive back to the storage
    me.bind( 'alive', function( info ) {
        //console.log( "Storage: ping from api!" );
        
        info.response.write(JSON.stringify( {
            "ok": true
        } ) );
        
        info.response.end();
    } );
    
    me.interval( 'loop', function() {
        me.on( 'loop' );
    }, 10000 );
    
    me.bind( 'disk-stats', function( info ) {
        
        var out = {
            "quota": quotaSizeLimit,
            "free": ( function() { var s = quotaSizeLimit - reservedSpace; return s < 0 ? 0 : s; } )(),
            "space": reservedSpace,
            "ok": true
        };
        
        info.response.write( JSON.stringify( out ) );
        info.response.end();
        
    } );
    
    me.bind( 'broadcast-store', function( info ) {
        
        console.log( "Broadcast store event from api, size = " + info.size );
        
        var freeSpace = quotaSizeLimit - reservedSpace;
        
        if ( freeSpace > info.size ) {
            
            console.log( "* sending POSITIVE broadcast announce event back to api (api wants " + btostr( info.size ) + ", i have " + btostr( freeSpace ) + ")" );
            
            info.response.write( JSON.stringify({
                
                "ok": true,
                "want": true,
                "free": quotaSizeLimit - reservedSpace
                
            }) );
                
        } else {
            
            console.log( "* sending NEGATIVE broadcast announce event back to api (api wants " + btostr( info.size ) + ", i have " + btostr( freeSpace ) + ")" );
            
            info.response.write( JSON.stringify({
                "ok": true,
                "want": false
            }) );
            
        }

        info.response.end();
    } );
    
    me.bind( 'firewall-update', function( info ) {

        ajax( 'http://' + args.api_address + "/firewall/storage/", function( response ) {

            try {

                if ( !response || !response.data || !( response.data instanceof Array ) ) {
                    info.response.sendError( "Bad firewall data" );
                } else {

                    // Update conf/firewall.worker.js

                    var fs = require( 'fs' );

                    fs.writeFileSync( __dirname + '/../conf/firewall.storage.json', JSON.stringify( response.data ), { 'encoding': 'utf8' } );

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

    var syncFailureIssueSent = false;
    
    me.interval( 'report_sync_failure', function() {

        if ( synchronizedAtLeastOneTime )
            return;
        
        if ( syncFailureIssueSent )
            return;
        
        syncFailureIssueSent = true;

        if ( !mail.cloudWatchers )
            return;

        // If the storage does not synchronize to the api in 20 seconds, we considerr that an
        // issue, and report it ONCE to the cloudadmin person

        mail.textMail( mail.cloudWatchers, "Storage " + storageInterface + ":" + storagePort + " failed to connect to api", [
            "Hi,",
            "",
            "I am cloud storage running on " + storageInterface + ":" + storagePort + ", and I could not ",
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

    }, 20000 );

    /* The storage node is interogating the api every minute about it's quota status.
       It would be easier to compute it locally, but more efficient to take in considerations
       the aspect of predicted additional space that will occur after the transcoding jobs
       are finished. 
     */
     
    var lastReservedSpace = -1;
     
    me.bind( 'update-quota', function() {
        
        if ( apiIsOn ) {
            
            remote.emmit( 'quota-stat', {
                'port': storagePort,
                'ip'  : storageInterface
            }, function( data ) {
                
                try {
                
                    reservedSpace = ( integer( data.data.physical_size || 0 ) + integer( data.data.predicted_additional_space || 0 ) );
                    
                    if ( lastReservedSpace != reservedSpace ) {
                        lastReservedSpace = reservedSpace;
                        console.log( "* setting reserved space to " + btostr( reservedSpace ) + " ( now free space is: " + btostr( quotaSizeLimit - reservedSpace ) + " )" );
                    }
                    
                } catch ( e ) {

                    console.log( '* update-quota response error: ', data, "error=", e + '' );
                    
                    console.log( "Setting reserved space to maxQuotaSize in order to avoid disk space errors." );
                
                    reservedSpace = quotaSizeLimit;
                    
                }
                
            }, function( reason ) {
                
                console.log( 'update-quota error: ', reason );
                
            });
            
        } else console.log( 'update-quota cannot run because the storage is not binded to api' );
        
    } );
    
    var warnFreeSpaceState = false;
    
    me.bind( 'free_space_warn_level', function() {
        
        if ( !mail.cloudWatchers )
            return;
        
        //console.log( "STAT: ", args.data_dir );
        
        statPath( args.data_dir + '', function( err, data ) {
            
            if ( err ) {
                console.log( "Warning: Failed to determine free space for path: " + args.data_dir + ": " + err );
            } else {
                
                var value = integer( data[ freeSpaceWarnLevelParam ] );
                
                if ( freeSpaceWarnLevelParam == 'percentUsed' )
                    value = 100 - value;
                
                var warnState = value <= freeSpaceWarnLevel;

                if ( warnState != warnFreeSpaceState ) {
                    
                    warnFreeSpaceState = warnState;
                    
                    var title,
                        body;
                    
                    if ( warnFreeSpaceState ) {
                        
                        title = "Storage " + storageInterface + ":" + storagePort + " free space crytical";
                        
                        body = [
                            "The free space on the storage node " + storageInterface + ":" + storagePort,
                            "has reached the limit of " +  ( freeSpaceWarnLevelParam == 'percentUsed' ? value + '%' : btostr( value ) ),
                            "",
                            "I will check again to see if the problem is solved, and announce you when",
                            "the situation will change.",
                            "",
                            "PS: This is an automated mail, please do not reply to it",
                            "",
                            "Sincerely, your storage node"
                        ].join("\n");
                        
                    } else {
                        
                        title = "Storage " + storageInterface + ":" + storagePort + " free space went back to normal";
                        
                        body = [
                            "The free space on the storage node " + storageInterface + ":" + storagePort,
                            "went back to normal state. Now we have " +  ( freeSpaceWarnLevelParam == percentUsed ? value + '%' : btostr( value ) ) + " free space.",
                            "",
                            "I will check from 10 to 10 minutes to see if the free space will be crytical again",
                            "and I will announce you by mail if needed.",
                            "",
                            "PS: This is an automated mail, please do not reply to it",
                            "",
                            "Sincerely, your storage node"
                        ].join("\n");
                    }
                    
                    mail.textMail( mail.cloudWatchers, title, body, function( err ) {
                        if ( err )
                            console.log( "WARNING: failed to send free space warning mail: " + err );
                        else
                            console.log( "Notification: Sent free space monitoring mail to cloudWatchers (title=" + title + ")" );
                    } );
                }
            }

        } );
        
    } );

    // At every minute we re-calculate the local quota of
    // our storage node.
    me.interval( 'update_local_quota', function() {
        me.on( 'update-quota' );
    }, 60000 );
    
    // At every 10 minutes we report a warning to the cloud watchers group
    // that the storage node is running out of free space.
    if ( freeSpaceWarnLevel ) {
        
        me.interval( 'report_free_space_warnings', function() {
            me.on( 'free_space_warn_level' );
        }, 600000 );
        
        me.on( 'free_space_warn_level' );
    }

    return me;
    
}