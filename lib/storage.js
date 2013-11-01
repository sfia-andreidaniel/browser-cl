var Thing       = require( __dirname + '/thing.js' ).Thing,
    args        = require( __dirname + '/argv-utils.js' ).customArgs,
    storagePort = require( __dirname + '/argv-utils.js' ).port,
    Remoting    = require( __dirname + '/remoting.js' ).Remoting,
    myPort      = require( __dirname + '/argv-utils.js' ).port,
    ajax        = require( __dirname + '/ajax.js' ).$_JSON_GET;

exports.Storage = function( ) {
    
    var me              = new Thing(),
        remote          = new Remoting( args.api_address || 'localhost:8080' ),
        apiIsOn         = false,
        apiIsRegistered = false,
        wwwPath         = args.www || 'http://localhost/',
        dataDir         = args.data_dir;
    
    me.isA = 'storage';
    
    if ( !dataDir )
        throw "Failed to initialize storage: no data-dir argument passed in the command line!";
    
    console.log( "* Storage.Port = ", storagePort );
    console.log( "* Storage.Www  = ", wwwPath );
    console.log( "* Storage.DataDir = ", args.data_dir );
    
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
        
        me.diskStats( function( success ) {
            
            success.ok = true;
            
            info.response.write( JSON.stringify( success ) );
            
            info.response.end();
            
        }, function( error ) {
            
            info.response.write( JSON.stringify({
                "error": true,
                "reason": "Failed to obtain disk stats: " + ( error || "Unknown error" )
            }) );
            
            info.response.end();
            
        } );
        
    } );
    
    me.bind( 'disk-stats-add', function( info ) {
        
        var size = ~~( info.size || 0 );
        
        me.reserveSpace( size, function() {
            info.response.write( JSON.stringify({
                "ok": true
            }) );
            info.response.end();
        }, function( reason ) {
            info.response.write( JSON.stringify({
                "error": true,
                "reason": reason || "Unknown reason"
            }) );
            info.response.end();
        } );
        
    } );
    
    me.bind( 'broadcast-store', function( info ){
        
        console.log( "Broadcast store event from api, size = " + info.size );
        
        var size = info.size || 0;

        me.diskStats( function( success ) {
            if ( success.free && success.free >= 0 && success.free > info.size ) {
                
                info.response.write( JSON.stringify({
                    
                    "ok": true,
                    "want": true,
                    "free": success.free
                    
                }) );
                
                info.response.end();
                
            } else {
                
                info.response.write( JSON.stringify({
                    "ok": true,
                    "want": false
                }) );
                
                info.response.end();
            }
        }, function( reason ) {
            
            info.response.write( JSON.stringify({
                
                "ok": true,
                "want": false,
                "reason": ( reason || "My disk stats don't work" )
                
            }) );
            
            info.response.end();
            
        } );
    } );
    
    me.bind( 'api-cmd-reserve-storage', function( info ) {
        
        info.size = info.size || 0;
        
        me.reserveSpace( info.size, function() {
            info.response.write( JSON.stringify({
                "ok": true,
            }) );
            info.response.end();
            console.log( "Storage command: reserve storage " + info.size + " bytes: SUCCESS" );
        }, function( reason ) {
            info.response.write( JSON.stringify({
                "ok": false,
                "error": true,
                "reason": reason
            } ) );
            info.response.end();
            console.log( "Storage command: reserve storage " + info.size + " bytes: ERROR: " + reason );
        } );
        
    } );

    me.bind( 'firewall-update', function( info ) {

        ajax( 'http://' + args.api_address + "/firewall/storage/", function( response ) {

            try {

                if ( !response || !response.data || !( response.data instanceof Array ) ) {
                    info.response.write( JSON.stringify( {
                        "error": true,
                        "reason": "Bad firewall data"
                    } ) );

                } else {

                    // Update conf/firewall.worker.js

                    var fs = require( 'fs' );

                    fs.writeFileSync( __dirname + '/../conf/firewall.storage.json', JSON.stringify( response.data ), { 'encoding': 'utf8' } );

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


    return me;
    
}