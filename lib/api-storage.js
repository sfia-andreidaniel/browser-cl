var Thing = require( __dirname + "/thing.js" ).Thing,
    Remoting = require( __dirname + '/remoting.js' ).Remoting;

exports.ApiStorage = function( storageIP, storagePort, storageWWW, api ) {
    
    var me = new Thing();
    
    var ip = storageIP + "",
        port = storagePort + "",
        www  = storageWWW;
    
    
    Object.defineProperty( me, "ip", {
        "get": function() {
            return ip;
        },
        "set": function() {
            throw "The IP property of a ApiStorage is read-only!";
        }
    } );

    Object.defineProperty( me, "port", {
        "get": function() {
            return port;
        },
        "set": function() {
            throw "The PORT property of a ApiStorage is read-only!";
        }
    } );
    
    Object.defineProperty( me, "www", {
        "get": function() {
            return www;
        },
        "set": function() {
            throw "The WWW property of a ApiStorage is read-only!";
        }
    } );
    
    me.api = api;
    
    me.remoting = new Remoting( ip + ':' + port );
    
    me.bind( 'ping-storage', function() {
        
        //console.log( "Pinging storage " + me.ip + ":" + me.port );
        
        me.remoting.emmit( 'alive', { 
            "alive": true,
            "for": "storage"
        }, function( success ) {
            // console.log( "pinged storage " + me.ip + ":" + me.port );
        }, function( error ) {
            // console.log( "failed to ping storage " + me.ip + ":" + me.port + ": " + ( error || 'unknown error' ) );
            me.api.on( 'storage-death', me );
        } );
        
    } );
    
    me.bind( 'ping', function() {
        //console.log( "ping from storage " + me.ip + ":" + me.port );
    } );
    
    me.blind( function() {
        console.log( "Storage bind event!" );
    } );
    
    me.sendBroadcastStoreFileAnnounce = function( data, callback ) {
        
        me.remoting.emmit( 'broadcast-store', data,
            function( success ) {
                callback( false, success );
            },
            function( error ) {
                
                callback( ( error || "Unknown error" ), false );
                
            }
        );
        
    };
    
    me.reserveStorage = function( howMuchStorage, callback ) {
        
        me.remoting.emmit( 'api-cmd-reserve-storage', {
            "size": howMuchStorage
        }, function( data ) {
            callback( false, data || true );
        }, function( reason ) {
            callback( reason || "Unknown reason", false );
        } )
        
    }
    
    console.log("* Storage " + me.ip + ":" + me.port + " registered, serving on " + me.www );
    
    return me;
}