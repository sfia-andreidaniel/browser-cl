/* Arguments of the apiclient nodejs interface:
   
   Usage:
   apiclient.js --host localhost --port 8080 "filename"
   
 */

var conf = {
    "host": null,
    "port": null,
    "file": null,
    "options": null
};

var fs      = require( 'fs' ),
    async   = require( __dirname + '/lib/async.js' ).Async,
    thing   = require( __dirname + '/lib/thing.js' ).Thing,
    integer = require( __dirname + '/lib/math.js' ).integer;

// All errors are dumped to stdout, in json format
function error( reason ) {
    process.stdout.write( JSON.stringify({"event": "error", "data": ( reason || "unknown reason" )}) + "\n" );
    process.exit( 1 );
}

function status( message ) {
    process.stdout.write( JSON.stringify({"event": "status", "data": ( message || null )}) + "\n" );
}

function progress( percent ) {
    process.stdout.write( JSON.stringify({"event": "progress", "data": ( percent || 0 )}) + "\n" );
}

function success( data ) {
    process.stdout.write( JSON.stringify({"event": "success", "data": ( data || {} ) } ) + "\n" );
    process.exit( 0 );
}

// parse arguments

for( var i=2, len = process.argv.length; i<len; i++ ) {
    switch ( process.argv[i] ) {
        case '--host':
            if ( i < len - 1 ) {
                conf.host = process.argv[i + 1];
                i++;
            } else {
                error("Unterminated host argument!");
            }
            break;
        case '--port':
            if ( i < len - 1 ) {
                conf.port = integer( process.argv[i + 1] );
                i++;
            } else
                error("Unterminated port argument!");
            break;
        case '--file':
            if ( i < len - 1 ) {
                conf.file = process.argv[i + 1];
                i++;
            } else
                error("unterminated file argument!");
            break;
        
        case '--options':
            if ( i < len - 1 ) {
                conf.options = process.argv[ i + 1 ];
                i++;
            } else
                error( "unterminated options argument!");
            break;
        
        default:
            error("Unknown argument " + process.argv[i]);
            break;
    }
}

if ( conf.port == null || conf.port < 1 || conf.port > 65534 )
    error("You must specify a valid port by using the --port argument");

if ( conf.host == null || !conf.host )
    error("You must specify a valid host by using the --host argument");

if ( conf.file == null || !conf.file )
    error("You must specify a valid file argument (last argument)");

var tasker = new async(),
    eventer = new thing(),
    WebSocketClient = require('websocket').client,
    filePacket = null,
    fh = null,
    numRead = 0,
    lastPercent = 0,
    connection = null,
    successPacket = null;
    
var fileName = conf.file.replace( /^([\s\S]+)[\/\\]+/i, '' );

if ( !fileName )
    error( "Failed to determine a file name!" );

eventer.bind( 'error', function( reason ) {
    tasker.currentTask.on( 'error', reason );
} );

eventer.bind( 'stat-file', function() {
    
    status( 'opening and testing file: ' + conf.file );
    
    fs.stat( conf.file, function( err, stats ) {
        if ( err ) {
            eventer.on( 'error', "Failed to stat file: " + ( err + '' || 'unknown error' ) );
            return;
        }
        
        if ( !stats.isFile() ) {
            eventer.on( 'error', conf.file + " is not a file!" );
            return;
        }
        
        if ( !stats.size ) {
            eventer.on( 'error', "file is zero bytes length!" );
            return;
        }
        
        // open file...
        
        fs.open( conf.file, 'r', function( err, handle ) {
            if ( err ) {
                eventer.on( 'error', "error opening file: " + ( err + "" || "unknown error" ) );
                return;
            }
            
            fh = handle;
            
            filePacket = {
                "name": fileName,
                "size": stats.size
            };
            
            // Merge the options from the command line with the options from the filePacket
            
            if ( conf.options ) {
                try {
                
                    filePacket.options = JSON.parse( conf.options );
                    
                } catch ( err ) {
                    
                    eventer.on( "error", "Failed to parse options from the command line!" );
                    
                }
            }
            
            status("Api send packet: " + JSON.stringify( filePacket ) );
            
            tasker.currentTask.on( 'success' );
        } );
    } );
} );

eventer.bind( 'transfer-file', function() {
    
    status( "Opening connection to server..." );
    
    var client = new WebSocketClient();
    
    client.on( 'connectFailed', function(err) {
        eventer.on( 'error', "Failed to connect to api via websocket: " + ( err + '' ) );
    } );
    
    client.on( 'connect', function( conn ) {
        
        status( "Connected to api" );
        
        connection = conn;
        
        connection.on( 'error', function( reason ) {
            eventer.on( 'error', reason + "" );
        } );
        
        connection.on( 'close', function() {
            status( 'connection to api has been closed' );
        } );
        
        connection.on( 'message', function( evt ) {
            
            if ( evt.type == 'utf8' ) {
                
                // Try to decode packet as json
                
                try {
                
                    var frame = JSON.parse( evt.utf8Data );
                    
                    eventer.on( 'frame', frame );
                
                } catch ( err ) {
                    eventer.on( 'error', "Failed to process frame: " + err );
                }
                
            } else {
                
                eventer.on( 'error', "Bad frame type: " + evt.type );
                
            }
            
        } );
        
        // Send the packet frame
        
        connection.sendUTF( JSON.stringify( filePacket ) );
        
    } );
    
    client.connect( 'ws://' + conf.host + ':' + conf.port + '/api/', 'api' );
    
} );

var maxBufferSize = 64000,
    buffer = new Buffer( maxBufferSize ),
    lastReadLength = 0;

var fread = function() {
    
    fs.read( fh, buffer, 0, maxBufferSize, null, function( err, bytesRead, buffer ) {
        
        if ( err ) {
            
            eventer.on( 'error', "File read error: " + ( err || 'unknown error' ) );
            
        } else {
            
            numRead += bytesRead;
            
            // Send the frame as binary frame. This is why the api on
            // node js is faster
            
            if ( bytesRead == maxBufferSize ) {
                connection.sendBytes( buffer );
            } else {
                connection.sendBytes( buffer.slice( 0, bytesRead ) );
            }
            
            lastReadLength = bytesRead;
        }
        
    } );
    
}

eventer.bind( 'frame', function( frameData ) {
    // console.log( "Got frame: ", frameData, "phase: ", tasker.currentPhase );
    
    frameData = frameData || {};
    
    if ( frameData.error ) {
        
        eventer.on( 'error', frameData.reason || "Unknown api error!" );
        
        return;
    }
    
    switch ( tasker.currentPhase ) {
        
        case 'transfer-file':
            
            if ( frameData.ack && frameData.phase == 'transfer' ) {
                
                if ( numRead == 0 )
                    status( "Starting to transfer file..." );
                
                if ( lastReadLength == 0 || lastReadLength == maxBufferSize )
                    fread();
            
                if ( frameData.got && frameData.got != lastReadLength ) {
                    eventer.on( 'error', "Transfer error. Server acked " + frameData.got + ", expected " + lastReadLength );
                } else {
                    
                    var prog = integer( numRead / ( filePacket.size / 100 ) );
                    
                    if ( prog != lastPercent ) {
                        lastPercent = prog;
                        progress( prog );
                    }
                    
                }
        
            } else {
                
                // we're having a success frame?
                
                if ( frameData.name && frameData.size ) {
                    
                    if ( frameData.size != filePacket.size ) {
                        
                        eventer.on( 'error', "Api transfer file size mismatch. Api got: " + frameData.size + ", local file size is: " + filePacket.size );
                        
                    } else {
                    
                        successPacket = frameData;
                    
                        tasker.currentTask.on( 'success', frameData );
                    
                    }
                }
                
            }
            
            break;
        
        default:
            
            eventer.on( 'error', "Unknown frame logic!" );
            break;
        
    }
    
} );

tasker.sync( function() {
    
    ( function( task ) {
        
        tasker.currentTask = task;

        eventer.on( tasker.currentPhase = 'stat-file' );
        
    } )( this );
    
} );

tasker.sync( function() {
    ( function( task ) {
        
        tasker.currentTask = task;
        
        eventer.on( tasker.currentPhase = 'transfer-file' );
        
    } )( this );
} );

tasker.run( 
    function() {
        // success
        status( "file transfer completed successfully");
        
        success( successPacket );
    },
    function( err ) {
        // error
        error( err || "unknown error" );
    },
    function( ) {
        // Close connection ...
        
        try {
            if ( connection ) {
                status( "closing connection" );
                connection.close();
                status( "connection closed successfully" );
            }
        } catch ( e ) {}
        
        // Close local file ...
        
        try {
            if ( fh ) {
                status( "closing local file" );
                fs.closeSync( fh );
                status( "local file closed successfully" );
            }
        } catch ( e ) {}
        
        if ( buffer )
            buffer = null;
        
        status( "all pending operations completed" );
    }
);