var mysql          = require( 'mysql' ),
    dbInfo         = null,
    pool           = null,
    fs             = require( 'fs' ),
    Async          = require( __dirname + '/async.js' ).Async,
    main           = new Async(),
    thing          = require( __dirname + '/thing.js' ).Thing,
    MySQLCondition = require( __dirname + '/mysql-lib.js' ).MySQLCondition,
    
    mailer         = require( __dirname + '/mail.js' ),
    ajax           = require( __dirname + '/ajax.js' ).$_POST,
    
    ip2long        = require( __dirname + '/socket-utils.js' ).ip2long,
    
    integer        = require( __dirname + '/math.js' ).integer;

main.sync( function() {
    
    ( function( task ) {
    
        try {

            var data = fs.readFileSync( __dirname + '/../conf/database.json', { "encoding": "utf8" } );
            
            dbInfo = JSON.parse( data + '' );
            
            if ( !dbInfo instanceof Object )
                throw "Failed to decode conf/database.json file as an object from JSON format!";
            
            if ( !dbInfo.host || !dbInfo.user || !dbInfo.pass || !dbInfo.database )
                throw "The config file should contain an object with non-empty values in the following format: { 'host': '...', 'user': '...', 'pass': '...', 'database': '...'}";
            
            pool = mysql.createPool({
                
                "host": dbInfo.host,
                "user": dbInfo.user,
                "password": dbInfo.pass,
                "database": dbInfo.database,
                "supportBigNumbers": true
                
            });
            
            pool.getConnection( function( err, connection ) {
                
                if ( err )
                    task.on( 'error', "Failed to connect to mysql: " + err );
                else {
                    
                    connection.query( "SELECT 1+1", function( err, rows ) {
                        
                        if ( err )
                            task.on( 'error', "Test query error: " + err );
                        else {
                            connection.destroy();
                            task.on( 'success' );
                        }
                        
                    } );
                    
                }
                
            } );
            
        } catch ( error ) {
            throw "Failed to initialize registry: " + error;
        }
        
    })( this );
});

main.run( function() {
    console.log( "* Registry: Initialized" );
    main.initialized = true;
}, function( reason ) {
    console.log( "* Registry: FAILED: " + reason );
} );

/* @param: storageNode: (api-storage.js).ApiStorage
   @param: pathSegment: <string>: "2013/09/24"
   @param: fileName   : <string>: "foo.mpg"
   @param: fileSize   : <int>   : 2331123123
   @param: mimeType   : <string>: "application/octet-stream"
   @param: uploaderIp : <string>: "0.0.0.0"
   @param: jobs: [
        { extension: 'ogv', converter: 'ogv_43', jobType: 'video' },
        ...
   ]
 */

var UploadJob = function( storageNode, pathSegment, fileName, fileSize, mimeType, uploaderIp, jobs, accountId ) {
    
    jobs = jobs || [];
    
    // console.log( "JOBS: ", jobs );
    
    mimeType = mimeType || 'application/octet-stream';
    uploaderIp = uploaderIp || '0.0.0.0';
    fileSize = fileSize || 0;
    
    this.save = function( callback ) {
    
        var tasker = new Async(),
            conn   = null,
            dbResult = {
                "ok": true,
                "uploadId": 0,
                "tasks": []
            },
            longIp = null,
            longPort = null;
        
        longIp = ip2long( storageNode.ip );
        longPort = integer( storageNode.port );
            
        if ( !longIp ) {
            callback( "Failed to convert ip " + storageNode.ip + " to it's long representation!" );
            return;
        }
    
        tasker.sync( function() {
            
            if ( !fileName ) {
                this.on( 'error', "Which fileName" );
                return;
            }
            
            if ( !pathSegment ) {
                this.on( 'error', "Which pathSegment?");
                return;
            }
            
            if ( !storageNode ) {
                this.on( 'error', "Which storageNode?" );
                return;
            }
            
            this.on( 'success' );
            
        } );
        
        tasker.sync( function() {
            
            ( function( task ) {
            
                // Obtain connection to mysql
                
                pool.getConnection( function( err, connection ) {
                    
                    if ( err )
                        task.on( 'error', "Failed to obtain db connection: " + err );
                    else {
                        conn = connection;
                        task.on( 'success' );
                    }
                    
                } );
            
            })( this );
            
        } );
        
        tasker.sync( function( ) {
            
            ( function( task ) {
                
                var sql = [
                    "INSERT INTO uploads (",
                        "storage_address, storage_address_ip, storage_address_port, storage_path, storage_file, storage_http, upload_date, upload_ip, ",
                        "jobs_completed, jobs_errors, jobs_success, jobs_total, file_size, total_size, mime, account_id",
                    ") VALUES (",
                        conn.escape( storageNode.ip + ':' + storageNode.port ) + ", ",
                        longIp + ', ',
                        longPort + ', ',
                        conn.escape( ( pathSegment + '/' ).replace( /[\/]+$/g, '/' ) ) + ", ",
                        conn.escape( fileName ) + ", ",
                        conn.escape( ( storageNode.www + '/' ).replace( /[\/]+$/g, '/' ) ) + ", ",
                        integer( ( new Date() ).getTime() / 1000 ) + ", ",
                        conn.escape( uploaderIp ) + ", ",
                        '0, 0, 0, ',
                        ( jobs.length + '' ) + ", ",
                        ( integer( fileSize ) + '' ) + ", ",
                        ( integer( fileSize ) + '' ) + ", ",
                        conn.escape( mimeType ) + ", ",
                        accountId + '',
                    ")"
                ].join( "\n" );
                
                // console.log( sql );
                
                conn.query( sql, function( err, result ) {
                    
                    // console.log( result );
                    
                    if ( err )
                        task.on( 'error', "Error inserting upload: " + err );
                    else {
                        
                        dbResult.uploadId = result.insertId;

                        task.on( 'success' );
                        
                    }
                    
                } );
                
                // task.on( 'success' );
                
            } )( this );
    
        });
        
        for ( var i=0, len = jobs.length; i<len; i++ ) {
            
            ( function( job ) {
                
                tasker.sync( function() {
                    
                    ( function( task ) {
                        
                        var sql = [
                            
                            "INSERT INTO uploads_tasks (status, upload_id, task_type, task_preset, task_extension, task_priority ) VALUES (",
                            "'new', ",
                            dbResult.uploadId + ", ",
                            conn.escape( job.jobType ) + ", ",
                            conn.escape( job.converter ) + ", ",
                            conn.escape( job.extension ) + ", ",
                            ( job.priority || 0 ) + "",
                            ")"
                            
                        ].join( "\n" );
                        
                        conn.query( sql, function( err, result ) {
                            
                            if ( err )
                                task.on( 'error', "Failed to insert task: " + err );
                            else {
                                
                                dbResult.tasks.push( result.insertId );
                                task.on( 'success' );
                            }
                            
                        } );
                        
                    })( this );
                    
                } );
                
            } )( jobs[i] );
            
        }
        
        tasker.run(
            function() {
            
                if ( conn ) {
                    conn.destroy();
                }
            
                callback( false, dbResult );
            },
            function( reason ) {
                if ( conn ) {
                    if ( dbResult.uploadId ) {
                        conn.query("DELETE FROM uploads WHERE id = " + dbResult.uploadId, function( err, result ) {
                            if ( err )
                                console.log( "Registry: Failed to rollback upload: " + dbResult.uploadId );
                        } );
                    }
                    
                    if ( dbResult.tasks ) {
                        for ( var i=0, len = dbResult.tasks.length; i<len; i++ ) {
                            ( function( taskId ) {
                                conn.query( "DELETE FROM uploads_tasks WHERE id = " + taskId + " LIMIT 1", function( err, result ) {
                                    console.log( "Registry: Failed to rollback upload task: " + taskId );
                                } );
                            })( dbResult.tasks[i] );
                        }
                    }
                    
                    conn.destroy();
                }
                
                callback( reason, null );
            },
            function() {
                // Complete
            }
        );
        
    }
};

/*
var upld = new UploadJob( 
    {
        "ip": "127.0.0.1",
        "port": 8080,
        "www": "http://localhost:9072"
    },
    "2013/08/23", 
    "1023901293123-sample.mp4", 
    981237818, 
    'video/mp4', 
    null,
    [
        { extension: '240p.mp4', converter: '240p_43', jobType: 'video' },
        { extension: 'android.mp4', converter: 'android_43', jobType: 'video' },
        { extension: 'blackberry.mp4', converter: 'blackberry_43', jobType: 'video' },
        { extension: 'iphone.mp4', converter: 'iphone_43', jobType: 'video' },
        { extension: 'ogv', converter: 'ogv_43', jobType: 'video' },
        { extension: 'webm', converter: 'webm_43', jobType: 'video' }
    ]
);

upld.save( function( err, data ) {
    if ( err ) {
        console.log( "Failed to save: ", err );
    } else {
        console.log( "OK: ", data );
    }
} );

*/

exports.UploadJob = UploadJob;

var Job = function( config, apiAddress ) {
    
    apiAddress = apiAddress || null;
    
    /* 
    
    uploadId: 2,
    storageAddress: '127.0.0.1:10000',
    storagePath: '2013/10/29/',
    storageFile: '1383071505283-3053-file.mpg',
    storageHttp: 'http://storage01/',
    uploadDate: 1383071505,
    uploadIp: '127.0.0.1',
    jobsCompleted: 0,
    jobsErrors: 0,
    jobsSuccess: 0,
    jobsTotal: 6,
    fileSize: 5232640,
    storageSize: 5232640,
    mimeType: 'video/mpeg',
    taskId: 12,
    taskStatus: 'new',
    taskType: 'video',
    taskPreset: 'webm_43',
    taskSize: 0,
    taskExtension: 'webm',
    taskPriority: 1000,
    taskStartDate: 0,
    taskEndDate: 0
    
    */
    
    var mods = {},
        self = this,
        readOnlyKeys = [
            "taskId",
            "uploadId",
            "storageAddress",
            "storagePath",
            "storageFile",
            "storageHttp",
            "uploadDate",
            "uploadIp",
            "jobsCompleted",
            "jobsErrors",
            "jobsSuccess",
            "jobsTotal",
            "fileSize",
            "storageSize",
            "mimeType",
            "taskStatus",
            "taskType",
            "taskPreset",
            "taskSize",
            "taskExtension",
            "taskPriority",
            "taskStartDate",
            "taskEndDate"
        ];
    
    for ( var i = 0, len = readOnlyKeys.length; i<len; i++ ) {
        ( function( key ) {
            
            Object.defineProperty( self, key, {
                "get": function() {
                    return config[key];
                },
                "set": function( value ) {
                    throw "Property '" + key + "' of a task is read-only!";
                }
            } );
            
        } )( readOnlyKeys[i] );
    }
    
    Object.defineProperty( this, "url", {
        
        "get": function() {
            return ( config.storageHttp + "/" ).replace( /[\/]+$/, '/' )
                 + ( config.storagePath + "/" ).replace( /[\/]+$/, "/" )
                 + ( config.storageFile )
                 + "."
                 + ( config.taskExtension );
        }
        
    } );
    
    /* Note that the optionalTaskSize and optionalTaskStartedBy parameters are optional.
       Moreover: 
          @optionalTaskSize is considered only if the staus parameter is 'success'
          @optionalTaskStartedBy parameter is considered only if the status is 'started'
     */
    
    this.setStatus = function( status, callback, optionalTaskSize, optionalTaskStartedBy ) {
        
        optionalTaskSize = optionalTaskSize || 0;
        optionalTaskStartedBy = optionalTaskStartedBy || '';
        
        status = ( status + '' || '' ).toLowerCase();
        
        if ( [ 'new', 'started', 'error', 'success' ].indexOf( status ) == -1 ) {
            callback( "Allowed statuses are: 'new', 'started', 'error', 'success'" );
            return;
        }
        
        if ( status == config.taskStatus ) {
            callback( "The task is allread in the " + status + " state!" );
            return;
        }
        
        var tasker = new Async(),
            conn   = null;
        
        if ( !apiAddress ) {
            
            tasker.sync( function() {
                
                if ( !main.initialized ) {
                    this.on( 'error', "The database is not initialized!" );
                    return;
                }
                
                ( function( task ) {
                    
                    pool.getConnection( function( err, connection ) {
                    
                        if ( err )
                            task.on( 'error', "Failed to obtain db connection: " + err );
                        else {
                            conn = connection;
                            task.on( 'success' );
                        }
                        
                    } );

                } )( this );
                
            } );
            
            tasker.sync( function() {
                
                ( function( task ) {
                
                    var sql = [
                        "UPDATE uploads_tasks",
                        "SET status='" + status + "'",
                        
                        /* The optionalTaskSize parameter */
                        
                        ( function() {
                            
                            if ( status == 'success' ) {
                                
                                if ( optionalTaskSize && ( integer( optionalTaskSize ) >= 0 ) )
                                    return ", task_size = " + ( integer( optionalTaskSize ) );
                                else
                                    return ", task_size = 0";
                                
                            } else return ", task_size = 0";
                        
                        } )(),
                        
                        /* End of optionalTaskSize parameter */
                        
                        /* The optional taskStartedBy parameter */
                        
                        ( function() {
                            
                            if ( status == 'started' ) {
                                
                                if ( optionalTaskStartedBy ) {
                                    return ", task_started_by=" + conn.escape( optionalTaskStartedBy );
                                } else return ", task_started_by = 'unknown'";
                                
                            } else return "";
                            
                        } )(),
                        
                        /* End of optionalTaskStartedBy parameter */
                        
                        "WHERE id=" + config.taskId + "",
                        "LIMIT 1"
                    ].join( "\n" );
                
                    conn.query( sql, function( err, result ) {
                        
                        if ( err )
                            task.on( 'error', "Database error: " + err );
                        else {
                            if ( result.affectedRows == 1 ) {
                                task.on( 'success' );
                            } else {
                                task.on( 'error', "The task has been allready in the " + status + " phase!" );
                            }
                        }
                        
                    } );
                
                })( this );

            } );
            
        } else {
            
            /* We do an ajax call to the api, in order to update the status */
            
            tasker.sync( function() {
                
                try {
    
                    var Remoting = require( __dirname + "/remoting.js" ).Remoting,
                        remote   = new Remoting( apiAddress );
                
                } catch ( err ) {
                    
                    this.on( 'error', "Failed to initite remoting interface: " + err );
                    
                    return;
                    
                }
                
                ( function( task ) {

                    remote.emmit( 'set-task-status', {
                        "taskId": config.taskId,
                        "status": status,
                        "optionalTaskSize": optionalTaskSize || 0,
                        "optionalTaskStartedBy": optionalTaskStartedBy || ''
                    }, function( response ) {
                        
                        // console.log( "Response: ", response );
                        
                        if ( !response || !response.ok )
                            task.on( "error", "Invalid response from api: " + JSON.stringify( response ) );
                        else
                            task.on( 'success' );
                        
                    }, function( reason ) {
                        
                        task.on( 'error', reason );
                        
                    } );
                
                })( this );

            } );
            
        }
        
        tasker.run( function() {
            
            // Also update the status of the job locally
            config.taskStatus = status;
            
            callback( false );
            
        }, function( reason ) {
        
            callback( "Failed to set task status: " + reason );
        
        }, function() {

            if ( conn )
                conn.destroy();

        } );
    }
    
    this.clone = function() {
        return JSON.parse( JSON.stringify( config ) );
    };
    
    return this;
}

var JobsCollection = function( ) {
    
    var me   = new thing(),
        jobs = [];
    
    Object.defineProperty( me, "length", {
        "get": function() {
            return jobs.length;
        }
    } );
    
    me.each = function( callback ) {
        if ( callback ) {
            
            for ( var i=0, len = jobs.length; i<len; i++ ) {
                if ( callback.call( jobs[i], jobs[i] ) === false )
                    break;
            }
            
        }
        
        return me;
    }
    
    me.skip = function( many ) {
        jobs = jobs.slice( many );
        return me;
    }
    
    me.limit = function( count ) {
        jobs = jobs.slice( 0, count );
        return me;
    }
    
    var error = function( reason ) {
        throw reason;
    }
    
    me.at = function( index ) {
        return index >= 0 && index < jobs.length
            ? jobs[ index ]
            : error( "Index out of bounds (" + index + ")" );
    }
    
    /* @param filter: Object {
            
            uploadId:      <condition int>
            uploadDate:    <condition date>
            uploadIp:      <condition string>
            storagePath:   <condition string>
            storageFile:   <condition string>
            storageHttp:   <condition string>
            jobsCompleted: <condition int>
            jobsErrors:    <condition int>
            jobsSuccess:   <condition int>
            jobsTotal:     <condition int>
            isCompleted:   <condition bool>
            allSuccess:    <condition bool>
            fileSize:      <condition int>
            storageSize:   <condition int>
            mimeType:      <condition string>
            
            taskId:        <condition int>
            taskStatus:    <condition string>
            taskType:      <condition string>
            taskPreset:    <condition string>
            taskSize:      <condition int>
            taskExtension: <condition string>
            taskPriority:  <condition int>
            taskStartDate: <condition date>
            taskEndDate:   <condition date>
       }
    */
    
    var dbBindings = {
        "uploadId"      : "int:uploads.id",
        "uploadDate"    : "int:uploads.upload_date",
        "uploadIp"      : "string:uploads.upload_ip",
        "storagePath"   : "string:uploads.storage_path",
        "storageFile"   : "string:uploads.storage_file",
        "storageHttp"   : "string:uploads.storage_http",
        "storageAddress": "string:uploads.storage_address",
        "jobsCompleted" : "int:uploads.jobs_completed",
        "jobsErrors"    : "int:uploads.jobs_errors",
        "jobsSuccess"   : "int:uploads.jobs_success",
        "jobsTotal"     : "int:uploads.jobs_total",
        "fileSize"      : "int:uploads.file_size",
        "storageSize"   : "int:uploads.total_size",
        "mimeType"      : "string:uploads.mime",
        
        "taskId"        : "int:uploads_tasks.id",
        "taskStatus"    : "string:uploads_tasks.status",
        "taskType"      : "string:uplods_tasks.task_type",
        "taskPreset"    : "string:uploads_tasks.task_preset",
        "taskSize"      : "int:uploads_tasks.task_size",
        "taskExtension" : "string:uploads_tasks.task_extension",
        "taskPriority"  : "int:uploads_tasks.task_priority",
        "taskStartDate" : "int:uploads_tasks.started_date",
        "taskEndedDate" : "int:uploads_tasks.ended_date"
    };
    
    me.sort = function( sortCallback ) {
        if ( sortCallback ) {
            jobs = jobs.sort( sortCallback );
        }
        return me;
    }
    
    /* Search in local database after tasks */
    
    me.find = function( filter, callback ) {
        
        var tasker = new Async(),
            sql    = null,
            conn   = null;
        
        tasker.sync( function() {
        
            try {
        
                filter = filter || {};
        
                var where = [];
                
                for ( var k in filter ) {
                    
                    if ( filter.hasOwnProperty( k ) && filter.propertyIsEnumerable( k ) ) {
                        
                        ( function( propertyName, propertyValue ) {
                            
                            if ( !dbBindings[ propertyName ] )
                                throw "Search condition `" + propertyName + "` is invalid!";
                            
                            where.push( new MySQLCondition( dbBindings[ propertyName ], propertyValue ) );
                            
                        } )( k, filter[ k ] );
                        
                    }
                    
                }
                
                for ( var i=0, len = where.length; i<len; i++ ) {
                    where[i] = where[i] + '';
                }
                
                sql = [
                    
                    "SELECT ",
                        "uploads.id                   AS uploadId,",
                        "uploads.storage_address      AS storageAddress,",
                        "uploads.storage_path         AS storagePath,",
                        "uploads.storage_file         AS storageFile,",
                        "uploads.storage_http         AS storageHttp,",
                        "uploads.upload_date          AS uploadDate,",
                        "uploads.upload_ip            AS uploadIp,",
                        "uploads.jobs_completed       AS jobsCompleted,",
                        "uploads.jobs_errors          AS jobsErrors,",
                        "uploads.jobs_success         AS jobsSuccess,",
                        "uploads.jobs_total           AS jobsTotal,",
                        "uploads.file_size            AS fileSize,",
                        "uploads.total_size           AS storageSize,",
                        "uploads.mime                 AS mimeType,",
                        
                        "uploads_tasks.id             AS taskId,",
                        "uploads_tasks.status         AS taskStatus,",
                        "uploads_tasks.task_type      AS taskType,",
                        "uploads_tasks.task_preset    AS taskPreset,",
                        "uploads_tasks.task_size      AS taskSize,",
                        "uploads_tasks.task_extension AS taskExtension,",
                        "uploads_tasks.task_priority  AS taskPriority,",
                        "uploads_tasks.started_date   AS taskStartDate,",
                        "uploads_tasks.ended_date     AS taskEndDate",
                    "FROM uploads",
                    "LEFT JOIN uploads_tasks",
                        "ON uploads_tasks.upload_id = uploads.id"
                     
                ];
                
                if ( where.length ) {
                    
                    sql.push( "WHERE" );
                    
                    for ( var i=0, len = where.length; i<len; i++ ) {
                        sql.push( where[i] + ( ( i < len - 1 ) ? " AND " : "" ) );
                    }
                    
                }
                
                sql = sql.join( "\n" );
                
                this.on( 'success' );
                
            } catch ( error ) {
                
                this.on( 'error', "Query exception: " + error );
                
            }
        });
        
        tasker.sync( function() {
            
            ( function( task ) {
                
                if ( !main.initialized ) {
                    
                    task.on( 'error', "Database connection not initialized!" );
                    return;
                    
                }
                
                pool.getConnection( function( err, connection ) {
                    
                    if ( err )
                        task.on( 'error', "Failed to obtain db connection: " + err );
                    else {
                        conn = connection;
                        task.on( 'success' );
                    }
                    
                } );
                
            } )( this );
            
        } );
        
        tasker.sync( function() {
            
            ( function( task ) {
            
                conn.query( sql, function( err, rows ) {
                    
                    if ( err ) {
                        task.on( "error", "Database error: " + err );
                    } else {
                    
                        jobs = [];
                        
                        for ( var i=0, len=rows.length; i<len; i++ )
                            jobs.push( new Job( rows[i] ) );
                        
                        task.on( 'success' );
                    }
                    
                } );
            
            })( this );
            
        } );
        
        tasker.run(
            function( ) {
                // ok
                callback( false );
            },
            function( reason ) {
                // error
                callback( reason || "Unknown reason" );
            },
            function( ) {
                // completed
                if ( conn ) {
                    try {
                        conn.destroy();
                    } catch ( error ) {
                        // 
                    }
                }
            }
        );
        
        //console.log( sql );
    }
    
    me.remoteFind = function( apiAddress, skip, limit, filter, callback ) {
        
        var tasker = new Async(),
            $_GET  = require( __dirname + '/ajax.js' ).$_GET;
        
        skip = skip || 0;
        limit = limit === 0
            ? 0
            : ( limit || 1000 );
        
        if ( limit < 0 )
            limit = 0;
        
        if ( limit > 1000 )
            limit = 1000;
        
        skip = integer( skip );
        limit= integer( limit );
        
        filter = filter || {};
        
        tasker.sync( function() {
            
            var targetURL = 'http://' + apiAddress + '/query/?q=' + encodeURIComponent( JSON.stringify( filter ) ) + "&skip=" + skip + "&limit=" + limit;
            
            ( function( task ){ 
                
                $_GET( targetURL, function( data ) {
                    
                    // console.log( "Ajax: " + data );
                    
                    if ( !data ) {
                        
                        task.on( "error", "No data received by the api!" );
                        return;
                        
                    }
                    
                    try {
                        
                        data = JSON.parse( data );
                        
                        if ( !( data instanceof Object ) )
                            throw "Expected object from the api!";
                        
                        if ( !data.ok || data.error )
                            throw data.reason ? data.reason : "Unknown api error";
                        
                        if ( !( data.data instanceof Array ) )
                            throw "The result set should be an array!";
                        
                    } catch ( error ) {
                        
                        task.on( 'error', "Error processing data: " + error );
                        return;
                    }
                    
                    jobs = [];
                    
                    for ( var i=0, len = data.data.length; i<len; i++ ) {
                        
                        jobs.push( new Job( data.data[i], apiAddress ) );
                        
                    }
                    
                    task.on( 'success' );
                    
                } );
                
            })( this );
            
        } );
        
        tasker.run(
            function() {
                if ( callback )
                    callback( false );
            },
            function( reason ) {
                if ( callback )
                    callback( reason || "unknown error" );
            }
        );
    }
    
    return me;
}

exports.JobsCollection = JobsCollection;
exports.Job = Job;

var auth = exports.auth = function( apiKey, callback ) {
    
    if ( !main.initialized ) {
        callback( "The database is not initialized!" );
        return;
    }

    var tasker = new Async(),
        conn   = null,
        acctId = null; //account ID
    
    tasker.sync( function() {
        
        ( function( task ) {
            
            pool.getConnection( function( err, connection ) {
                if ( err )
                    task.on( 'error', 'Failed to obtain a database connection: ' + err );
                else {
                    conn = connection;
                    task.on( 'success' );
                }
            });
            
        })( this );
        
    } );
    
    tasker.sync( function() {
        ( function( task ) {

            conn.query( "SELECT token, id " +
                        "FROM access " +
                        "WHERE token = " + conn.escape( apiKey || '' ) + " LIMIT 1", 
                function( err, rows ) {
                    
                    if ( err )
                        task.on( 'error', err );
                    else {
                        if ( rows.length == 1 ) {
                            acctId = rows[0].id;
                            task.on( 'success' );
                        }
                        else
                            task.on( 'error', "Invalid api key" );
                    }
                    
            } );
        })( this );
    });
    
    tasker.run( function() {
        callback( false, acctId );

        // console.log( "Auth: AccountID=", acctId );

        if ( conn )
            conn.destroy();
        
    }, function( reason ) {
        
        callback( reason );
        
        if ( conn )
            conn.destroy();
    });
}

function Notification( row ) {

    console.log( "* create notification #" +  row.notification_id );
    
    var me = new thing();
    
    // Borrow properties from row and place them in the "me" object
    for ( var key in row ) {
        if ( row.hasOwnProperty( key ) && row.propertyIsEnumerable( key ) ) {
            
            ( function( propertyName, propertyValue ) {
                
                Object.defineProperty( me, propertyName, {
                    
                    "get": function() {
                        return propertyValue;
                    },
                    "set": function( dummy ) {
                        throw "Property " + propertyName + " of a Notification object is read-only!";
                    }
                    
                } );
                
            })( key, row[ key ] );
            
        }
    }
    
    // Send notification ...
    me.send = function( callback ) {
        
        // console.log( "Sending notification #" + me.notification_id );
        
        callback = callback || function( err ) {
        };
        
        var tasker = new Async();
        
        tasker.sync( function() {
            
            if ( me.notification_url ) {
                
                ( function( task ) {
                    
                    var announce_url = me.notification_url + '';
                    
                    announce_url = announce_url.replace( /\%\{UPLOAD_ID\}/g, me.upload_id + '' );
                    announce_url = announce_url.replace( /\%\{STATUS\}/g, me.notification_status );
                    
                    //console.log( "Announce URL: " + announce_url );
                    
                    ajax( announce_url, [ 'upload_id=' + me.upload_id, 'status='+ me.notification_status ], function(result) {
                        
                        if ( !result ) {
                            task.on( 'error', "The url " + announce_url + " responded with no content" );
                        } else {
                            //console.log( "DL: " + result );
                            task.on( "success" );
                        }
                        
                    } );
                    
                    task.on( 'success' );
                    
                })( this );
                
            } else this.on( 'success' );
            
        } );
        
        tasker.sync( function() {
            
            if ( me.notification_email ) {
                
                ( function( task ) {
                    
                    // console.log( "Send mail to: " + me.notification_email, " title: ", me.notification_title, " text: ", me.notification_text );
                    
                    mailer.textMail( me.notification_email, me.notification_title, me.notification_text, function( err ) {
                        
                        if ( err ) {
                            task.on( 'error', "Failed to send mail: " + err );
                        } else
                            task.on( 'success' );
                        
                    } );
                    
                    task.on( 'success' );
                    
                })( this );
                
            } else this.on( 'success' );
            
        });
        
        var save = function( withError ) {
            
            withError = withError || false;
            
            pool.getConnection( function( err, connection ) {
                
                if ( err ) {
                    
                    console.log( "Notification.send.saveStatus: Failed to obtain a database connection: " + err );
                    return;
                    
                }
                
                var sql;
                
                if ( err )
                    sql = "UPDATE notifications SET sent_date = NOW(), sent_error = " + connection.escape( ( withError + "" ) || "unknown error" ) +
                          "WHERE id = " + me.notification_id + " LIMIT 1";
                else
                    sql = "UPDATE notifications SET sent_date = NOW() " +
                          "WHERE id = " + me.notification_id + " LIMIT 1";
                
                connection.query( sql, function( err, result ) {
                    
                    if ( err )
                        console.log( "Notification.send.saveStatus: Failed to save notification sent status in database: " + err );
                    
                    connection.destroy();
                    
                } );
                
            } );
            
        }
        
        tasker.run( 
            function() {
                
                save( false );
                
                callback( false );
                
            },
            function( reason ) {
                
                save( reason );
                
                callback( reason );
                
            }
        );
    }
    
    return me;
}

function ApiNotifications() {
    
    var me = new thing(),
        working = false;
    
    me.run = function( callback ) {
        
        callback = callback || function( err ) {
            if ( err )
                console.log( "* failed to send notifications: " + err );
        };
        
        if ( working ) {
            
            callback( "previous notification sender job did not completed yet" );
            return;
        }
        
        working = true;
        
        var tasker = new Async(),
            conn,
            notifications = [];
        
        tasker.sync( function() {
            if ( !main.initialized )
                this.on( 'error', "The database backend is not initialized" );
            else
                this.on( 'success' );
        } );
        
        tasker.sync( function() {
            ( function( task ) {
                
                pool.getConnection( function( err, connection ) {
                    
                    if ( err )
                        task.on( 'error', "Failed to obtain a database connection: " + err );
                    else {
                        conn = connection;
                        task.on( 'success' );
                    }
                    
                } );
                
            })( this );
        } );
        
        tasker.sync( function() {
            ( function( task ) {
                
                var sql = [
                    "SELECT notifications.id                    AS notification_id, ",
                    "       notifications.notification_title    AS notification_title,",
                    "       notifications.notification_text     AS notification_text,",
                    "       notifications.status                AS notification_status,",
                    "       notifications.upload_id             AS upload_id,",
                    "       notifications.account_id            AS account_id,",
                    "       access.notification_url             AS notification_url,",
                    "       access.notification_email           AS notification_email",
                    "FROM notifications",
                    "LEFT JOIN access ON access.id = notifications.account_id",
                    "WHERE notifications.sent_date IS NULL"
                ].join( "\n" );
                
                conn.query( sql, function( err, rows ) {
                    
                    if ( err )
                        task.on( 'error', "Failed to fetch notifications from database: " + err );
                    else {
                        
                        for ( var i=0, len = rows.length; i<len; i++ )
                            notifications.push( new Notification( rows[i] ) );
                        
                        task.on( 'success' );
                    }
                    
                } );
                
            })( this );
        } );
        
        tasker.sync( function() {
            
            if ( notifications.length == 0 ) {
                this.on( 'success' );
                return;
            }
            
            ( function( task ) {
                
                var sender = new Async();
            
                for ( var i=0, len=notifications.length; i<len; i++ ) {
                    
                    ( function( notification ) {
                        
                        sender.sync( function( ) {
                            
                            ( function( subtask ) {
                                
                                notification.send( function( err ) {
                                    
                                    if ( err ) {
                                        
                                        console.log( "* failed to send notification #" + notification.notification_id + " to user account " + notification.account_id + ": " + err );
                                        
                                    }
                                    
                                    subtask.on( 'success' );
                                    
                                } );
                                
                            })( this );
                            
                        } );
                        
                    } )( notifications[i] );
                    
                }
                
                sender.run( function() {
                    task.on( 'success' );
                }, function( reason ) {
                    task.on( 'error', reason );
                } );
                
                
            })( this );
            
        } );
        
        tasker.run( 
            function() {
                working = false;
                if ( conn ) {
                    conn.destroy();
                }
                callback( false );
            }, 
            function( reason ) {
                working = false;
                if ( conn ) {
                    conn.destroy();
                }
                callback( reason );
            }
        );
    }
    
    return me;
    
}

function QuotaCalculator( storageNodeIpAndPort, callback ) {
    
    storageNodeIpAndPort = String( storageNodeIpAndPort || '' );
    
    if ( !main.initialized ) {
        
        callback( "The database is not initialized (yet?)" );
        return;
        
    }
    
    var tasker = new Async(),
        conn   = null,
        result;
    
    tasker.sync( function() {
        
        ( function( task ) {
            pool.getConnection( function( err, connection ) {
                
                if ( err )
                    task.on( 'error', "Failed to get a database connection: " + err );
                else {
                    conn = connection;
                    task.on( 'success' );
                }
                
            } );
        })( this );
        
    } );
    
    tasker.sync( function() {
        
        ( function( task ) {
            
            var sql = [
                "SELECT",
                "   SUM( IF( jobs_completed = jobs_total, total_size, file_size ) )                                 AS physical_size,",
                "   SUM( IF( jobs_completed <> jobs_total AND jobs_total > 0, file_size * ( jobs_total - 1 ), 0 ) ) AS predicted_additional_space",
                "FROM uploads",
                "WHERE uploads.storage_address = " + conn.escape( storageNodeIpAndPort )
            ].join( "\n" );
            
            conn.query( sql, function( err, rows ) {
                
                if ( err )
                    task.on( 'error', "Database error: " + err );
                else {
                    result = {
                        'physical_size': rows[0].physical_size || 0,
                        'predicted_additional_space': rows[0].predicted_additional_space || 0
                    };
                    
                    task.on( 'success' );
                }
                
            } );
            
        })( this );
        
    } );
    
    tasker.run( function() {
        
        conn.destroy();
        
        callback( false, result );
        
    }, function( reason ) {
        
        if ( conn )
            conn.destroy();
        
        callback( reason, null );
        
    } );
    
}

/*

setTimeout( function( ) {

    var test = new JobsCollection();

    test.find( { "taskStatus": "new" }, function( err ) {
    
        if ( err ) {
            console.log( "Search error: " + err );
            return;
        }
    
        test.skip(3).limit(10).each( function() {
        
            console.log( "Task #" + this.taskId + " from Upload #" + this.uploadId + " URL=" + this.url);

            console.log( this.clone() );
            
        } );
    
        console.log( "Search completed" );
    
    } );

}, 100 );

*/

/*
setTimeout( function() {
    auth( "cce23406fac43ad94aa6c498618d1550", function( err ) {
        if ( err )
            console.log( err );
        else
            console.log( "OK" );
    } );
}, 100 );
*/

/*
setTimeout( function() {
    
    var thread = new ApiNotifications();
    
    thread.run( function( err ) {
        
        if ( err )
            console.log( "Error: " + err );
        else
            console.log( "All notifications were sent successfully" );
        
    } );
    
}, 100 );
*/

/*
setTimeout( function() {
    
    QuotaCalculator( '127.0.0.1:10000', function( error, data ) {
        
        if ( error )
            console.log("ERROR: " + error );
        else
            console.log("SUCCESS: ", data );
        
    } );
    
}, 100 );
*/

exports.ApiNotifications = ApiNotifications;
exports.QuotaCalculator  = QuotaCalculator;