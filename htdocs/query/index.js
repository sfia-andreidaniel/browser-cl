var fs          = require('fs'),
    Async       = require( __dirname + "/../../lib/async.js" ).Async,
    Query       = require( __dirname + "/../../lib/registry.js").JobsCollection,
    SocketUtils = require( __dirname + '/../../lib/socket-utils.js' ),
    integer     = require( __dirname + '/../../lib/math.js' ).integer;


exports.handle = function( response, request, urlInfo, controller ) {
    
    /* Firewall */
    var allowRequest = SocketUtils.firewall4( SocketUtils.getFirewallList( controller.isA ), request.socket.remoteAddress );

    if ( !allowRequest ) {

        console.log( "Firewall (" + controller.isA + "): Request rejected for " + request.socket.remoteAddress + " on resource: '/query/'" );

        response.write( 'forbidden' );
        response.end();
        return;

    }

    
    
    if ( !controller || controller.isA != 'api' ) {
        
        response.write( "Forbidden ( permission allowed only on api node controller )." );
        response.end();
        
        return;
    }
    
    if ( !urlInfo.q ) {
    
        response.write(
            fs.readFileSync( __dirname + '/index.html', { "encoding": "utf8" } )
        );
    
        response.end();
    
    } else {
        
        var q      = urlInfo.q + "",
            skip   = integer( urlInfo.skip ),
            limit  = integer( urlInfo.limit ),
            tasker = new Async(),
            out    = [];
        
        if ( skip < 0 )
            skip = 0;
        
        if ( limit < 0 )
            limit = 0;
        
        if ( limit > 1000 )
            limit = 1000;
        
        tasker.sync( function() {
            
            try {
                q = JSON.parse( q );
                
                if ( typeof q != 'object' )
                    throw "Decoded json data is not an object!";
                
                this.on( 'success' );
                
            } catch ( error ) {
                this.on( 'error', "Failed to deserialize query as JSON" );
            }
            
        } );
        
        tasker.sync( function() {
            
            try {
            
                ( function( task ) {
            
                    var query = new Query();
                    
                    query.find( q, function( error ) {
                        
                        if ( error ) {
                        
                            task.on( 'error', "Failed to execute search: " + error );
                        
                        } else {
                            
                            //console.log( "Skip: ", skip + ", limit: ", limit );
                            
                            query.skip( skip ).limit( limit ).each( function() {
                                
                                out.push( this.clone() );
                                
                            } );
                            
                            task.on( 'success' );
                        }
                        
                    } );
                })( this );
            
            } catch ( error ) {
                
                this.on( 'error', "Failed to initialize query: " + error );
                
            }
            
        } );
        
        tasker.run( function() {
            
            response.write( JSON.stringify( { "ok": true, "data": out } ) );
            
            response.end();
            
        }, function( reason ) {
            
            console.log( "Search: Error: " + reason );
            
            response.write( JSON.stringify( { "ok": false, "error": true, "reason": reason, "data": null } ) );
            
            response.end();
            
        } );
        
        // response.write( JSON.stringify( q ) );
        
        // response.end();
        
    }
    

}

exports.async = true;