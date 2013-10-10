/* Transcoding cloud api interface */

var apiWorker = require( __dirname + '/api-worker.js' ).ApiWorker;

exports.Api = function() {
    
    var thing = require( __dirname + '/thing.js' ).Thing,
        me = new thing(),
        workers  = [], //Transcoder workers
        storages = [];
    
    me.blind( function( workerInfo ) {
        
        workerInfo.response.write( JSON.stringify({
            "error": true,
            "reason": "Unbinded event " + workerInfo.eventName
        }) );
        
        workerInfo.response.end();
        
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
                     && workers[i].port == ( workerInfo.port || 9000 ) 
                ) {
                    worker = workers[i];
                    break;
                }
            }
            
            if ( !worker ) {
                workers.push( worker = new apiWorker( workerIP, workerInfo.port || 9000 ), me );
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
    
    
    return me;
}