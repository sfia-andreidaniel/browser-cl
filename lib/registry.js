var mysql = require( 'mysql' ),
    dbInfo = null,
    pool = null,
    fs = require( 'fs' ),
    Async = require( __dirname + '/async.js' ).Async,
    main = new Async();

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