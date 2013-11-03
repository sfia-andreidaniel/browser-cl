var Async = require( __dirname + "/async.js" ).Async,
    spawn = require( 'child_process' ).spawn;

function ffmpeg_capabilities ( ffmpegPath, callback ) {
    
    var tasker = new Async(),
        
        result = {
            "video": {},
            "audio": {},
            "subtitle": {},
            "flags": [],
            "libs": {},
            "version": "unknown",
            "date": "unknown"
        },
        
        stdout = '',
        stderr = '';
    
    tasker.sync( function() {
        
        ( function( task ) {
    
            var ffmpeg = spawn( ffmpegPath, [ '-encoders' ] );
    
            ffmpeg.stdout.on( 'data', function( data ) {
        
                stdout += data;
        
            } );
    
            ffmpeg.stderr.on( 'data', function( data ) {
        
                stderr += data;
    
            } );
    
            ffmpeg.on( 'close', function() {
                task.on( 'success' );
            } );
        
        } )( this );
    
    } );
    
    tasker.sync( function() {
        
        var lines = stdout.split("\n"),
            matches = null;

        for ( var i=0, len = lines.length; i<len; i++ ) {
            
            
            matches = /[\s]+([V|A|S])([\.F])([\.|S])([\.|X])([\.|B])([\.|D])[\s]+([\S]+)[\s]+([^*]+)$/.exec( lines[i] );
            
            if ( matches ) {
                
                if ( matches[7] == '=' )
                    continue;
                
                result[ matches[1] == 'A' ? "audio" : ( matches[1] == "V" ? "video" : "subtitle" ) ][ matches[7] ] = {
                    "experimental": matches[4] == '.' ? false : true,
                    "description": matches[8]
                };
                
            }
            
        }
        
        lines = stderr.split( "\n" );
        
        var matches2;
        
        for ( var i=0, len = lines.length; i<len; i++ ) {
            switch ( true ) {
                
                case !!( matches = /^ffmpeg version ([\S]+) Copyright /.exec( lines[i] ) ):
                    result.version = matches[1];
                    break;
                
                case !!( matches = /^[\s]+built on ([\S]+ [\d]+ [\d]{4} [\d]{2}\:[\d]{2}\:[\d]{2}) /.exec( lines[i] ) ):
                    result.date = matches[1];
                    break;
                
                case !!( matches = /^[\s]+configuration\: /.test( lines[i] ) ):
                    
                    var parts = lines[i].split( '--' );
                    
                    for ( var j=0, n=parts.length; j<n; j++ ) {
                        
                        if ( !!( matches2 = /^(extra|enable|disable)\-([\S]+)/.exec( parts[j] ) ) ) {
                            result.flags.push( matches2[1] + '-' + matches2[2] );
                        }
                        
                    }
                    
                    break;
                
                case !!( matches = /^[\s]+(libav(util|codec|format|device|filter)|libsw(scale|resample)|libpostproc)[\s]+([\d]+)([\.\s]+)?([\d]+)\./.exec( lines[i] ) ):
                    result.libs[ matches[1] ] = parseFloat(matches[4]+'.'+matches[6]);
                    break;
                
            }
        }
        
        this.on( 'success' );
    } );
    
    tasker.run( function( ) {
        
        Object.defineProperty( result, "queryCodec", {

            "get": function() {
                return function( codecType, codecRegex ) {
                if ( [ 'audio', 'video', 'subtitle' ].indexOf( codecType ) == -1 )
                    throw "Codec type can be: audio, video, or subtitle";
                
                var out = [];
                
                for ( var key in result[ codecType ] ) {
                    
                    if ( !( result[codecType].propertyIsEnumerable( key ) ) || !( result[codecType].hasOwnProperty( key ) ) )
                        continue;
                    
                    switch ( true ) {
                        
                        case codecRegex instanceof RegExp:
                            if ( codecRegex.test( key ) )
                                out.push( { 
                                    "name": key, 
                                    "experimental": result[ codecType ][ key ].experimental, 
                                    'description': result[ codecType ][key].description 
                                } );
                            break;
                        
                        default:
                            if ( ( codecRegex + '' ) == key )
                                out.push( { 
                                    "name": key, 
                                    "experimental": result[ codecType ][ key ].experimental, 
                                    'description': result[ codecType ][key].description 
                                } );
                            break;
                        
                    }
                    
                }
                
                return out;
            }; }
        } );
        
        Object.defineProperty( result, "getCodecs", {
            
            "get": function() {
                return function( codecTypes ) {
                    var out = [];
                    if ( [ 'video', 'audio', 'subtitle' ].indexOf( codecTypes ) >= 0 ) {
                        for ( var k in result[ codecTypes ] ) {
                            
                            if ( result[codecTypes].hasOwnProperty( k ) && result[codecTypes].propertyIsEnumerable( k ) )
                                out.push( k );
                            
                        }
                    }
                    return out;
                }
            }
            
        } );
        
        callback( false, result );
        
    }, function( reason ) {
        
        callback( reason );
        
    } );
}

exports.ffmpeg_capabilities = ffmpeg_capabilities;

/*
ffmpeg_capabilities( '/usr/local/bin/ffmpeg', function( err, result ) {
    if ( err )
        console.log( "Error getting ffmpeg capabilities: " + err );
    else
        console.log( "ok", result.queryCodec( 'video', /jpeg/ ) );
} );
*/