/* Transcoding cloud api interface */

var apiWorker           = require( __dirname + '/api-worker.js' ).ApiWorker,
    apiStorage          = require( __dirname + '/api-storage.js' ).ApiStorage,
    defaultWorkerPort   = 9000,
    defaultStoragePort  = 10000,
    defaultWWWPath      = 'http://localhost/',
    Async               = require( __dirname + '/async.js' ).Async,
    registry            = require( __dirname + '/registry.js' ),
    taskPriority        = require( __dirname + '/tasks-priorities.js' ).getTaskPriority,
    registry            = require( __dirname + '/registry.js' ),
    mail                = require( __dirname + '/mail.js' ),

    apiPort             = require( __dirname + '/argv-utils.js' ).port,
    apiInterface        = require( __dirname + '/argv-utils.js' ).listen;

exports.Api = function() {
    
    var thing = require( __dirname + '/thing.js' ).Thing,
        me = new thing(),
        workers  = [], //Transcoder workers
        storages = [],
        
        NotificationSender = new registry.ApiNotifications();
    
    me.isA = 'api';
    
    /* Test to see if an ip is found in the registered workers or
       registered storages */
    
    me.isPeerAMemberOfCloud = function( peerIp ) {
        for ( var i=0, len=workers.length; i<len; i++ )
            if ( workers[i].ip == peerIp )
                return true;
        for ( var i=0, len=storages.length; i<len; i++ )
            if ( storages[i].ip == peerIp )
                return true;
        return false;
    }
    
    /* Number of registered storages */
    Object.defineProperty( me, "storagesCount", {
        "get": function() {
            return storages.length;
        }
    } );
    
    /* Number of registered workers */
    Object.defineProperty( me, "workersCount", {
        "get": function() {
            return workers.length;
        }
    } );
    
    
    me.blind( function( info ) {
        
        console.log( "me.blind!" );
        
        try {
        
            info.response.write( JSON.stringify({
                "error": true,
                "reason": "Unbinded event " + info.eventName
            }) );
            
            info.response.end();

        } catch ( error ){
            
        }
        
    } );
    

    me.bind( 'alive', function( info ) {
        
        // alive event from the worker or from the storage
        
        var ip = info.request.socket.remoteAddress,
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
        
            var workerIP = workerInfo.request.socket.remoteAddress;
        
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
        
            var storageIP = storageInfo.request.socket.remoteAddress,
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
    
    me.bind( 'reload-firewall', function( info ) {
        
        require( __dirname + '/socket-utils.js' ).reloadFirewall();
        info.response.write(JSON.stringify({"ok": true}));
        info.response.end();
        
        var tasker = new Async();
        
        for ( var i=0, len = storages.length; i<len; i++ ) {
            
            ( function( storage ) {
                
                tasker.async( function() {
                
                    ( function( task ) {
                
                        storage.reloadFirewall( function( err ) {
                            
                            if ( err )
                                console.log( "* failed to reload firewall on storage " + storage.ip + ":" + storage.port + ": " + err );
                            else
                                console.log( "* firewall successfully reloaded on storage node " + storage.ip + ":" + storage.port );
                            
                            task.on( 'success' );
                        } );
                        
                    })( this );
                });
                
            } )( storages[i] );
        }
        
        for ( var i=0, len = workers.length; i<len; i++ ) {
            
            ( function( worker ) {
                
                tasker.async( function() {
                
                    ( function( task ) {
                
                        worker.reloadFirewall( function( err ) {
                            
                            if ( err )
                                console.log( "* failed to reload firewall on worker " + worker.ip + ":" + worker.port + ": " + err );
                            else
                                console.log( "* firewall successfully reloaded on worker node " + worker.ip + ":" + worker.port );
                            
                            task.on( 'success' );
                        } );
                        
                    })( this );
                });
                
            } )( workers[i] );
        }
        
        tasker.run( function() {
            console.log( "* firewall reloaded and successfully propagated to all cloud active nodes" );
        }, function( err ) {
            console.log( "* firewall reeloaded, but failed to propagate on cloud nodes" );
        } );
        
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
    
    me.bind( 'set-task-status', function( info ) {
        
        var taskId = info.taskId || null;
        var status = info.status || null;
        var optionalTaskSize = info.optionalTaskSize || 0;
        var optionalTaskStartedBy = info.optionalTaskStartedBy || '';
        
        if ( !taskId || taskId < 0 || !status ) {
            
            info.response.write( JSON.stringify( {
                "ok": false,
                "error": true,
                "reason": "Either taskId either status contains illegal values: taskId=" + taskId + ", status=" + status
            } ) );
            info.response.end();
            
            return;
            
        }
        
        var query = new registry.JobsCollection();
        
        query.find( { "taskId": taskId }, function( err ) {
            
            if ( err ) {
                
                info.response.write( JSON.stringify( {
                    "ok": false,
                    "error": true,
                    "reason": "Query error: " + err
                } ) );
                info.response.end();

            } else {
                
                if ( query.length == 1 ) {
                
                    query.each( function() {
                        
                        this.setStatus( status, function( err ) {
                            
                            if ( err ) {
                                info.response.write( JSON.stringify( {"ok": false, "error": true, "reason": err } ) );
                                info.response.end();
                            } else {
                                
                                info.response.write( JSON.stringify( {"ok": true, "data": true } ) );
                                info.response.end();
                        
                                console.log( "* Task #" + taskId + " changed it's status to " + status, { "taskSize": optionalTaskSize, "originator": optionalTaskStartedBy } );

                            }
                            
                        }, optionalTaskSize, optionalTaskStartedBy );
                        
                    } );
                
                } else {
                    
                    info.response.write( JSON.stringify( { "ok": false, "error": true, "reason": "Query result length is not 1!" } ) );
                    info.response.end();
                    
                }
                
            }
            
        } )
        
    } );
    
    me.handleUpload = function( filePacket, callback ) {
        
        var tasker = new Async,
            nodes  = [],
            destinationNode = null,
            fileVersions = {},
            storageReserved = 0,
            remoteFilePath = null,
            uploadJob = null,
            pathSegment = null,
            uploadId = null,
            fileName = null;
        
        // console.log( filePacket );
        
        // console.log( "Sending broadcast-store event to all storage nodes, for size: ", filePacket.fileSize, " x 4 = ", filePacket.size, " bytes" );
        
        for ( var i=0, len = storages.length; i<len; i++ ) {
            
            ( function( storage ) {
                
                tasker.async( function( ) {
                    
                    ( function( task ) {
                    
                        storage.sendBroadcastStoreFileAnnounce( {
                            "size": filePacket.fileSize * 4
                        }, function( err, response ) {
                            
                            // console.log( "Broadcast-store response from: " + storage.ip + ":" + storage.port + ":", response );
                            
                            if ( !err && response.want ) {
                            
                                // console.log( "Elected node: " + storage.ip + ":" + storage.port );
                            
                                nodes.push( {
                                    "node": storage,
                                    "free": response.free
                                } );
                            
                            }
                            
                            task.on( 'success' );
                            
                        } );
                    } )( this );
                    
                });
                
            } )( storages[i] );
        }
        
        tasker.sync( function() {
            
            // console.log( "SYNC PHASE!" );
            
            ( function( task ) {
                    
                if ( nodes.length == 0 ) {
                    task.on( 'error', "No storage nodes ( out of " + storages.length + " ) were capable to store your file!" );
                    return;
                }
                
                nodes.sort( function( a, b ) {
                    
                    return a.free - b.free;
                    
                } );
                
                destinationNode = nodes[0].node;
                
                console.log( "Storing file on storage node: " + destinationNode.ip + ":" + destinationNode.port + ", which has a free space of " + nodes[0].free );
                
                task.on( 'success' );
                
            } )( this );
            
        } );
        
        tasker.sync( function() {
            
            var 
                pathParts    = filePacket.localFile.split( '/' );
            
            fileName     = pathParts[ pathParts.length - 1 ];
            
            // compute the destination file on storage node
            
            (function( task ) {
            
                
                pathSegment = ( new Date() ).getFullYear() + '/' + ( ( new Date() ).getMonth() + 1 ) + '/' + ( new Date() ).getDate();
                var wwwPrefix   = ( destinationNode.www + '/' ).replace( /[\/]+$/g, '/' ) + pathSegment + '/';
            
                // console.log( "Storing as: " + wwwPrefix );
                
                // compute final file versions
                
                fileVersions[ "original" ] = wwwPrefix + fileName;
                
                remoteFilePath = ( pathSegment + '/' ).replace( /[\/]+$/g, '/' ) + fileName;
            
                if ( filePacket.jobInfo && filePacket.jobInfo.jobs ) {
                    
                    for ( var i=0, jobs = filePacket.jobInfo.jobs, len = jobs.length; i<len; i++ ) {
                        fileVersions[ jobs[i].extension ] = wwwPrefix + fileName + "." + jobs[i].extension;
                    }
                    
                }
                
                task.on( 'success' );
            
            })( this );
        } );
        
        tasker.sync( function() {
            ( function( task ) {
                // reserve file on storage ( 4x times more than original file size )
                
                storageReserved = filePacket.fileSize * 4;
                
                console.log( "Reserving " + storageReserved + " bytes on storage node..." );
                
                destinationNode.reserveStorage( storageReserved, function( err, data ) {
                    if ( err ) {
                        console.log( "Failed!" );
                        storageReserved = 0;
                        task.on( 'error', "Failed to allocate quota space on storage node!" );
                    } else {
                        // console.log( "Success!" );
                        task.on( 'success' );
                    }
                } );
            })( this );

        } );
        
        tasker.sync( function() {
            ( function( task ) {
                
                // console.log( "AccountID: ", filePacket.accountId );
                
                // save job in database...
                
                var UploadJob = registry.UploadJob;
                
                uploadJob = new UploadJob(
                    
                    destinationNode,
                    pathSegment,
                    fileName,
                    filePacket.fileSize,
                    
                    ( filePacket && filePacket.jobInfo && filePacket.jobInfo.contentType )
                        ? filePacket.jobInfo.contentType
                        : 'application/octet-stream',
                    
                    filePacket.remoteIp || '0.0.0.0',
                    
                    ( function() {
                        
                        if ( filePacket.jobInfo && filePacket.jobInfo.jobs ) {
                            
                            for ( var i=0, jobs = filePacket.jobInfo.jobs, len = filePacket.jobInfo.jobs.length; i<len; i++ ) {
                                
                                filePacket.jobInfo.jobs[i].priority = taskPriority( filePacket.jobInfo.jobs[i].converter );
                                
                            }
                            
                            return filePacket.jobInfo.jobs;
                            
                        } else return [];
                        
                    } )(),

                    filePacket.accountId
                );
                
                uploadJob.save( function( err, data ) {
                    
                    if ( err ) {
                        
                        task.on( 'error', err );
                        
                    } else {
                        
                        uploadId = data.uploadId;
                        
                        task.on( 'success' );
                    }
                    
                } );
                
            } )( this );
        } ); 
        
        tasker.sync( function() {
            // Transfer file on storage node...

            ( function( task ) {
            
                me.putFile( 
                    destinationNode.ip + ':' + destinationNode.port,
                    remoteFilePath,
                    filePacket.localFile,
                    function() {
                        // success
                        task.on( 'success' );
                    },
                    function( reason ) {
                        // error
                        task.on( 'error', "Failed to upload file on storage node: " + reason );
                    },
                    function( progress ) {
                        // progress not displaying
                        // console.log( "Uploading to storage: " + progress );
                    }
                );
            })( this );
        } );
        
        tasker.run( function(  ) {
        
            // console.log( "MAIN: SUCCESS" );
        
            callback( false, {
                "files": fileVersions,
                "uploadId": uploadId
            } );
        
        }, function( err ) {
        
            // console.log( "MAIN: FAILURE: " + err );
        
            callback( err, null );
        
        } );
        
    };
    
    me.interval( 'loop', function() {
        //console.log( 'loop' );
        me.on( 'loop' );
    }, 10000 );
    
    /* Every minute we send the notifications to the uploaders */
    me.interval( 'notification_sender', function() {
        
        NotificationSender.run( function( err ) {
            
            if ( err )
                console.log( "* notifications sender: " + err );
            
        } );
        
    }, 60000 );
    
    // @ every 10 minutes, the api is reporting it's state to
    // the cloud admin group, IF it don't have at least one
    // worker and one storage connected to it.
    me.interval( 'network_failure_notification', function() {
        
        if ( workers.length != 0 && storages.length != 0 )
            return;
        
        if ( !mail.cloudWatchers )
            return;

        mail.textMail( mail.cloudWatchers, "API " + apiInterface + ":" + apiPort + " network problem detected", [
            "Hi,",
            "",
            "I am the cloud api running on " + apiInterface + ":" + apiPort + ", and I detected some network ",
            "connectivity problems:",
            "",
            [ workers.length == 0 ? "- No workers are connected to me" : "",
              storages.length == 0 ? "- No storages are connected to me" : ""
            ].join( "\n" ).replace(/(^\n|\n$)/g, ''),
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
                console.log( "* Notification: Api detected network connection problems. An email was sent to the cloud watchers group" );
        } );
        
    }, 600000 );
    
    /* API FIREWALL */
    
    return me;
}