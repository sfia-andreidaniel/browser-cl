var Async    = require( __dirname + '/async.js' ).Async,
    Registry = require( __dirname + '/registry.js' ),
    Thing    = require( __dirname + '/thing.js' ).Thing,
    Affinity = null,
    fs       = require( 'fs' ),
    mkdirp   = require( 'mkdirp' ),
    Remove   = require( 'remove' ),
    Dirty    = require( __dirname + '/dirty.js' ),
    integer  = require( __dirname + '/math.js' ).integer;

try {

    Affinity = JSON.parse( fs.readFileSync( __dirname + '/../conf/worker-affinity.json' ) );

    if ( !( Affinity instanceof Object ) )
        throw "ERROR: Parsed worker affinity was expected to be an object!";

} catch( error ) {
    
    console.log( "Using default affinity ( got ERROR while parsing conf/worker-affinity.json: " + error + ")" );
    
    Affinity = {
        "taskStatus": "new"
    };
    
}

console.log( "WORKER: Using affinity: ", Affinity );


function Executor( apiHostNameAndPort, workerHostNameAndPort, controller, dataDir ) {
    
    console.log( "WORKER: Using data dir: " + dataDir + ", and api address: " + apiHostNameAndPort );
    
    var me = new Thing()
        state = 'idle',
        
        noJobsConsecutive   = 0,
        skipNextConsecutive = 0;
    
    // the state of the executor is read-only
    Object.defineProperty( me, "state", {
        "get": function() {
            return state;
        }
    } );
    
    // The executor is not doing a transcoding task, it
    // is in the idle state
    me.bind( 'idle', function() {
        state = 'idle';
        console.log( "WORKER: The process entered in idle state" );
    } );
    
    // When the executor is executing a transcoding job, it
    // automatically enters in 'working' mode
    me.bind( 'working', function() {
        state = 'working';
        console.log( "WORKER: The process entered in working state" );
    } );
    
    me.bind( 'no-jobs', function() {
        noJobsConsecutive++;
    } );
    
    me.bind( "job-status", function( status ) {
        
        console.log( "WORKER.status: ", status );
        
    } );
    
    // Executes the next transcoding task.
    me.next = function( callback ) {
        
        // If the task executor encounters a "nothing to do" signal,
        // it will ignore the next 10 "start-next-task" signals,
        // in order to optimize the flow.
        
        if ( noJobsConsecutive  ) {
            
            skipNextConsecutive++;
            
            if ( skipNextConsecutive > 9 ) {
                
                skipNextConsecutive = 0;
                noJobsConsecutive = 0;
                
            } else
                return;
            
        }
        
        callback = callback || ( function() {} );
        
        if ( state != 'idle' ) {
            callback( "WORKER.next: Worker is allready working at another transcoding job" );
            return;
        }
        
        me.on( 'working' );
        
        var query,
            tasker = new Async(),
            job    = null,
            rollbacks = {
                
            },
            Transcoder = null,
            taskDir = null,
            
            totalTranscodedSize = 0;
        
        // me.on( 'working' );
        
        // Step 1. Initialize the query interface
        tasker.sync( function() {
            
            // me.on( 'job-status', "1. initialize query interface" );
            
            try {
                query = new Registry.JobsCollection();
                this.on( 'success' );
            } catch ( error ) {
                this.on( 'error', "Failed to initialize the api query interface: " + error );
            }

        } );
        
        // Step 2. Perform a search on api server, in order to
        // get the next task based on the worker affinity setting.
        tasker.sync( function() {
            
            // me.on( 'job-status', "2. perform a task search on the api server" );
            
            
            ( function( task ) {
                
                query.remoteFind( apiHostNameAndPort, 0, 1, Affinity, function( error ) {
                    
                    if ( error ) {
                    
                        task.on( 'error', "Api query error: " + error );

                        return;
                        
                    } else {
                        
                        //console.log( "Got #" + query.length + " tasks" );
                        
                        // we're having a new transcoding job. Yessss!!!
                        if ( query.length >= 1 ) {
                            
                            job = query.at( 0 );
                            
                            rollbacks[ 'jobState' ] = job.taskStatus;
                            
                            me.on( "job-status", "\n\n=== BEGIN WORKER JOB #" + job.taskId );
                            
                            task.on( 'success' );
                            
                        } else {
                            
                            task.on( 'error', "ERR_NOTHING_TO_DO" );
                            
                        }
                        
                    }
                    
                } );
                
            })( this );
            
        } );
        
        // Step 3. Mark the job as "started"
        tasker.sync( function() {
            
            me.on( 'job-status', "3. mark the job as started" );
            
            // me.on( 'job-status', "debug: Andrei, do not forget to alter the job status" );
            
            // this.on('success');
            // return;
            
            ( function( task ) {
                job.setStatus( "started", function( error ) {
                    
                    if ( error )
                        task.on( "error", error );
                    else {
                        
                        me.on( 'job-status', '3.1. mark the job as "dirty"' );
                        
                        Dirty.set_dirty( job.taskId, function( err ) {
                            
                            if ( err ) {
                                job.setStatus( 'error' );
                                task.on( 'error', 'failed to mark the job as "dirty": ' + err );
                            } else {
                                task.on( "success" );
                            }

                        } );
                        
                        
                    }
                    
                }, 0, workerHostNameAndPort );
            })( this );
        } );
        
        // Step 4. Create the task transcoding directory on local filesystem
        tasker.sync( function() {
            
            me.on( 'job-status', "4. create the task transcoding directory on local filesystem" );
            
            ( function( task ) {
            
                taskDir = dataDir + "/" + ( new Date() ).getTime() + "-" + integer( 1000 * Math.random() );
                
                mkdirp( taskDir, function( err ) {
                    
                    if ( err ) {
                        
                        task.on( 'error', "Failed to create job local folder in '" + taskDir + "'" );
                        
                    } else {
                        
                        rollbacks.taskDir = taskDir;
                        
                        task.on( 'success' );
                    }
                    
                } );
            
            })( this );
            
        } );
        
        // Step 5. Download the file from the storage node in it's task transcoding directory.
        tasker.sync( function() {
            
            rollbacks.storageFile = ( ( job.storagePath + '/' ).replace( /[\/]+$/, '/' ) + job.storageFile ),
                    
            rollbacks.localFile   = ( ( rollbacks.taskDir + '/' ) + job.storageFile ),
                    
            me.on( 'job-status', "5. downloading the file " + rollbacks.storageFile + " from the storage node in transcoding directory " + rollbacks.localFile );
            
            ( function( task ) {
                
                controller.getFile( 
                    
                    job.storageAddress, 
                    
                    rollbacks.storageFile,
                    
                    rollbacks.localFile,
                    
                    function( ) {
                        // success
                        task.on( 'success' );
                    },
                    function( reason ) {
                        task.on( 'error', "Failed to transferr file from storage node: " + reason );
                    },
                    function( percent ) {
                        // no percent transferr callback
                    }
                );
                
            })( this );
            
        } );
        
        // Step 6. Initialize appropriate transcoder for the file....
        tasker.sync( function() {
            
            me.on( 'job-status', "6. initialize appropriate transcoder for the job" );
            
            switch ( job.taskType ) {
                
                case 'video':
                    Transcoder = require( __dirname + "/videotranscoder.js" ).transcoder;
                    this.on( 'success' );
                    break;
                
                case 'image':
                    Transcoder = require( __dirname + "/imagetranscoder.js" ).transcoder;
                    this.on( 'success' );
                    break;
                
                case 'audio':
                default:
                    // not implemented
                    this.on( 'error', "Failed to initialize a transcode of type " + job.taskType + " for the task!" );
                    break;
                
            }
            
        } );
        
        // Step 7. Instantiate the transcoder, and run it against local file.
        tasker.sync( function() {
            
            me.on( 'job-status', "7. instantiating and running the transcoder against local file..." );
            
            ( function( task ) {
            
                rollbacks.transcoder = new Transcoder();
                
                rollbacks.transcoder.onStatus( function( status ) {
                    
                    me.on( "job-status", "7." + status );
                    
                } ).onSecond( function( second ) {
                    
                    me.on( "job-status", "7.3.1. processing (" + second + " sec. done)" );
                    
                } );
                
                rollbacks.transcoder.run( 
                    rollbacks.localFile,
                    rollbacks.localTranscodedFile = rollbacks.localFile + "." + job.taskExtension,
                    job.taskPreset,
                    function( err, success ) {
                        
                        if ( err ) {
                            
                            task.on( "error", "Transcoder error!" );
                            
                        } else {
                            
                            task.on( "success" );
                            
                        }
                        
                    }
                );
            })( this );
            
        } );
        
        // Step 8. Test if the transcoded file exists
        tasker.sync( function() {
            
            me.on( 'job-status', "8. statting transcoded file..." );
            
            ( function( task ) {
                
                fs.exists( rollbacks.localTranscodedFile, function( exists ) {
                    
                    if ( !exists )
                        task.on( "error", "After transcoding, the file '" + rollbacks.localTranscodedFile + "' does not exists" );
                    else
                    
                        fs.stat( rollbacks.localTranscodedFile, function( err, statInfo ) {
                            
                            if ( err ) {
                                task.on( "error", "Failed to stat transcoded file '" + rollbacks.localTranscodedFile + "': " + err );
                                return;
                            }
                            
                            if ( !statInfo.isFile() ) {
                                task.on( "error", "The transcoded path '" + rollbacks.localTranscodedFile + "' exists, but it is not a file" );
                                return;
                            }
                            
                            totalTranscodedSize = statInfo.size;
                            
                            task.on( 'success' );
                            
                        } );
                    
                } );
                
            } )( this );
            
        } );
        
        // Step 9. Upload the file back to the storage
        
        tasker.sync( function() {
            
            me.on( 'job-status', "9. uploading the transcoded job to the storage server..." );
            
            ( function( task ) {
                
                controller.putFile( 
                    job.storageAddress,
                    rollbacks.storageFile + "." + job.taskExtension,
                    rollbacks.localTranscodedFile,
                    function() {
                        // success
                        task.on( 'success' );
                    },
                    function( reason ) {
                        // error
                        task.on( 'error', "Failed to upload the transcoded file to storage node: " + reason );
                    },
                    function( percent ) {
                        // progress
                    }
                );
                
            } )( this );
            
        } );
        
        // Step 10. Mark the job as "success"
        
        tasker.sync( function() {
            
            me.on( 'job-status', '10. setting job status as "success" ...' );
            
            ( function( task ) {
                
                job.setStatus( 'success', function( err ) {
                    
                    // console.log( "ERROR: ", err );
                    
                    if ( err ) {
                        task.on( "error", "Failed to mark job as success: " + err );
                    } else {
                        
                        me.on( 'job-status', '10.1. mark the job as "clean"' );
                        
                        Dirty.set_clean( job.taskId, function( err ) {
                            if ( err ) {
                                task.on( "error", "failed to mark the job as \"clean\": " + err );
                            } else task.on( 'success' );
                            
                        } );
                        
                    }
                    
                }, totalTranscodedSize, workerHostNameAndPort );
                
            })( this );
            
        } );
        
        var cleanedUp = false,

        cleanup = function( success ) {
            
                if ( cleanedUp ) // ensure the cleanup process is called only once
                return;
            
            cleanedUp = true;
            
            try {
            
                // me.on( 'job-status', "COMPLETE. Doing job cleanup..." );
                
                // If the job status is NOT "success", we mark the job status as "error"
                
                if ( job && job.taskStatus != 'success' && !success ) {
                    
                    job.setStatus( 'error', function( err ) {
                        // Doesn't matter?
                        if ( err ) {
                            me.on( 'job-status', "CLEANUP: ERROR: failed to mark task status as \"error\": " + err );
                        } else {
                            
                            Dirty.set_clean( job.taskId, function( err ) {
                                if ( err ) {
                                    me.on( 'job-status', 'WARNING: failed to mark the job as \"clean\": ' + err );
                                }
                            } );
                            
                        }
                    } );
                    
                }
                
                // Remove the transcoding folder if found ...
                
                if ( rollbacks.taskDir ) {
                    
                    Remove( rollbacks.taskDir, function( err ) {
                        
                        if ( err ) {
                            me.on( 'job-status', "CLEANUP: ERROR: failed to delete the job task dir '" + rollbacks.taskDir + "': " + err );
                        }
                        
                    } );
                    
                }
            } catch ( cleanupError ) {
                
                me.on( "job-status", "CLEANUP: ERROR: " + cleanupError );
                
            }
            
            me.on( 'idle' );
        };
        
        tasker.run( 
            function() {
                cleanup( true );
                me.on( 'job-status', "=== SUCCESS: JOB #" + job.taskId + " FINISHED SUCCESSFULLY\n\n" );
                callback( false );
            },
            function( reason ) {
                
                // There is a special case error, when the task executer has
                // nothing to do. In such case, we treat the
                // signal as a success signal.
                
                if ( reason && ( /ERR_NOTHING_TO_DO/.test( reason + '' ) ) ) {
                    
                    me.on( 'idle' );
                    me.on( 'no-jobs' );

                    callback( false );

                } else {
                
                    cleanup( false );

                    me.on( 'job-status', "=== FAILURE: JOB ERROR " + ( job ? "( #" + job.taskId + ") " : "" ) + ": " + ( reason || "UNKNOWN REASON" ) + "\n\n" );
                
                    callback( reason );
                
                }
                
            }
        );
        
    }
    
    return me;
}

exports.Executor = Executor;