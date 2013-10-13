/* Transcoding cloud api interface */

var apiWorker = require( __dirname + '/api-worker.js' ).ApiWorker,
    defaultWorkerPort = 9000;

exports.Api = function() {
    
    var thing = require( __dirname + '/thing.js' ).Thing,
        me = new thing(),
        workers  = [], //Transcoder workers
        storages = [];
    
    me.blind( function( workerInfo ) {
        
        console.log( "me.blind!" );
        
        workerInfo.response.write( JSON.stringify({
            "error": true,
            "reason": "Unbinded event " + workerInfo.eventName
        }) );
        
        workerInfo.response.end();
        
    } );
    
    me.bind( 'alive', function( info ) {
        
        // alive event from the worker
        
        var workerIP = info.request.socket._peername.address,
            worker   = null;
        
        for ( var i=0, len=workers.length; i<len; i++ ) {
            if ( workers[i].ip == workerIP
                 && workers[i].port == ( info.port || defaultWorkerPort )
            ) {
                
                workers[i].on('ping');
                break;
            }
        }
        
        info.response.write(JSON.stringify( {
            "ok": true
        } ));
        
        info.response.end();
        
    } );
    
    me.bind( 'worker-subscribe', function( workerInfo ) {
        
        /* WorkerInfo should be an object in the format:
           {
                "request": NODE_HTTP_REQUEST,
                "response": NODE_HTTP_RESPONSE,
                "eventName": "<string>"
                "...": "...", # other request data passed through &data = ...
                "...": "..."  # other request data passed through &data = ...
           }
         */
        
        try {
        
            var workerIP = workerInfo.request.socket._peername.address;
            
            // TODO: Check if the worker IP is allowed to register
            
            var worker = null;
            
            for ( var i=0, len = workers.length; i<len; i++ ) {
                
                if ( workers[i].ip == workerIP 
                     && workers[i].port == ( workerInfo.port || defaultWorkerPort ) 
                ) {
                    worker = workers[i];
                    break;
                }
            }
            
            if ( !worker ) {
                workers.push( worker = new apiWorker( workerIP, workerInfo.port || defaultWorkerPort , me ) );
            }
            
            console.log( "* Worker " + worker.ip + ":" + worker.port + " registered" );
            
            workerInfo.response.write( JSON.stringify({
                "ok": true,
                "ip": worker.ip,
                "port": worker.port
            }) );
            
        } catch ( e ) {
            
            workerInfo.response.write( JSON.stringify({
                "error": true,
                "reason": e + ""
            }) );
            
        }
        
        workerInfo.response.end();
        
    } );
    
    me.bind( 'worker-death', function( worker ) {
        
        for ( var i=0, len = workers.length; i<len; i++ ) {
            if ( workers[i] == worker ) {
                console.log( "Transcoder worker " + worker.ip + ":" + worker.port + " died!" );
                workers.splice( i, 1 );
            }
        }
        
    } );
    
    me.bind( 'loop', function() {
        
        for ( var i=0, len=workers.length; i<len; i++ ) {
            
            workers[i].on( 'ping-worker', {
                "api": true
            });
            
        }
        
    } );
    
    me.interval( 'loop', function() {
        //console.log( 'loop' );
        me.on( 'loop' );
    }, 10000 );
    
    return me;
}