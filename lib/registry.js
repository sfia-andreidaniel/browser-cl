var mysql = require( 'mysql' ),
    dbInfo = null,
    pool = null,
    fs = require( 'fs' ),
    Async = require( __dirname + '/async.js' ).Async,
    main = new Async(),
    thing = require( __dirname + '/thing.js' ).Thing,
    MySQLCondition = require( __dirname + '/mysql-conditions.js' ).MySQLCondition;

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

var UploadJob = function( storageNode, pathSegment, fileName, fileSize, mimeType, uploaderIp, jobs ) {
    
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
            };
        
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
                        "storage_address, storage_path, storage_file, storage_http, upload_date, upload_ip, ",
                        "jobs_completed, jobs_errors, jobs_success, jobs_total, file_size, total_size, mime",
                    ") VALUES (",
                        conn.escape( storageNode.ip + ':' + storageNode.port ) + ", ",
                        conn.escape( ( pathSegment + '/' ).replace( /[\/]+$/g, '/' ) ) + ", ",
                        conn.escape( fileName ) + ", ",
                        conn.escape( ( storageNode.www + '/' ).replace( /[\/]+$/g, '/' ) ) + ", ",
                        ~~( ( new Date() ).getTime() / 1000 ) + ", ",
                        conn.escape( uploaderIp ) + ", ",
                        '0, 0, 0, ',
                        ( jobs.length + '' ) + ", ",
                        ( ~~( fileSize ) + '' ) + ", ",
                        ( ~~( fileSize ) + '' ) + ", ",
                        conn.escape( mimeType ),
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

var Job = function( config ) {
    
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
        jobs = jobs.slice( many, count );
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
        
        console.log( sql );
    }
    
    return me;
}

exports.JobsCollection = JobsCollection;
exports.Job = Job;

/*
var test = new JobsCollection();

test.find( { "taskStatus": "new" }, function( err ) {
    
    if ( err ) {
        console.log( "Search error: " + err );
        return;
    }
    
    test.each( function() {
        
        console.log( "Task #" + this.taskId + " from Upload #" + this.uploadId + " URL=" + this.url);
        
    } );
    
    console.log( "Search completed" );
    
} );
*/