/* Transcoding cloud api interface */

var apiWorker = require( __dirname + '/api-worker.js' ).ApiWorker,
    apiStorage= require( __dirname + '/api-storage.js' ).ApiStorage,
    defaultWorkerPort = 9000,
    defaultStoragePort= 10000,
    defaultWWWPath = 'http://localhost/';

exports.Api = function() {
    
    var thing = require( __dirname + '/thing.js' ).Thing,
        me = new thing(),
        workers  = [], //Transcoder workers
        storages = [];
    
    me.blind( function( info ) {
        
        console.log( "me.blind!" );
        
        info.response.write( JSON.stringify({
            "error": true,
            "reason": "Unbinded event " + info.eventName
        }) );
        
        info.response.end();
        
    } );
    
    me.bind( 'alive', function( info ) {
        
        // alive event from the worker or from the storage
        
        var ip = info.request.socket._peername.address,
            worker   = null,
            storage  = null;
        
        for ( var i=0, len=workers.length; i<len; i++ ) {
            if ( workers[i].ip == ip
                 && workers[i].port == ( info.port || defaultWorkerPort )
            ) {
                
                workers[i].on('ping');
                worker = true;
                break;
            }
        }
        
        if ( !worker ) {
            
            for ( var i=0, len=storages.length; i<len; i++ ) {
                if ( storages[i].ip == ip
                     && storages[i].port == ( info.port || defaultStoragePort )
                ) {
                    storages[i].on( 'ping' );
                    storage = true;
                    break;
                }
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
        
            // console.log( "WorkerPORT: " + workerInfo.port );
        
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
            
            //console.log( "* Worker " + worker.ip + ":" + worker.port + " registered" );
            
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
    
    me.bind( 'storage-subscribe', function( storageInfo ) {
        
        /* StorageInfo should be an object in the format:
           {
                "request": NODE_HTTP_REQUEST,
                "response": NODE_HTTP_RESPONSE,
                "eventName": "<string>"
                "...": "...", # other request data passed through &data = ...
                "...": "..."  # other request data passed through &data = ...
           }
         */
        
        try {
        
            // console.log( "StoragePORT: " + storageInfo.port );
        
            var storageIP = storageInfo.request.socket._peername.address,
                www       = storageInfo.www || defaultWWWPath;
            
            // TODO: Check if the storage IP is allowed to register
            
            var storage = null;
            
            for ( var i=0, len = storages.length; i<len; i++ ) {
                
                if ( storages[i].ip == storageIP 
                     && storages[i].port == ( storageInfo.port || defaultStoragePort ) 
                ) {
                    storage = storages[i];
                    break;
                }
            }
            
            if ( !storage ) {
                storages.push( storage = new apiStorage( storageIP, storageInfo.port || defaultStoragePort , www, me ) );
            }
            
            // console.log( "* Storage " + storage.ip + ":" + storage.port + " registered" );
            
            storageInfo.response.write( JSON.stringify({
                "ok": true,
                "ip": storage.ip,
                "port": storage.port
            }) );
            
        } catch ( e ) {
            
            storageInfo.response.write( JSON.stringify({
                "error": true,
                "reason": e + ""
            }) );
            
        }
        
        storageInfo.response.end();
        
    } );
    
    me.bind( 'worker-death', function( worker ) {
        
        for ( var i=0, len = workers.length; i<len; i++ ) {
            if ( workers[i] == worker ) {
                console.log( "* Worker " + worker.ip + ":" + worker.port + " died!" );
                workers.splice( i, 1 );
            }
        }
        
    } );

    me.bind( 'storage-death', function( storage ) {
        
        for ( var i=0, len = storages.length; i<len; i++ ) {
            if ( storages[i] == storage ) {
                console.log( "* Storage " + storage.ip + ":" + storage.port + " died!" );
                storages.splice( i, 1 );
            }
        }
        
    } );
    
    me.bind( 'loop', function() {
        
        for ( var i=0, len=workers.length; i<len; i++ ) {
            
            workers[i].on( 'ping-worker', {
                "api": true
            });
            
        }
        
        for ( var i=0, len=storages.length; i<len; i++ ) {
            
            storages[i].on( 'ping-storage', {
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