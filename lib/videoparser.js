var which = require( __dirname + '/osutils.js' ).which,
    async = require( __dirname + '/async.js' ).Async,
    spawn = require( 'child_process' ).spawn,
    fs    = require( 'fs' );

var parseVideoLine = function( line, result ) {

    var matches;

    if ( !!( matches = /[\s]+([\d]+x[\d]+)(([\s]+)?\[[\s\S]+?\]([\s+])?)?,/.exec( line ) ) ) {
        result.video = result.video || {};
        result.video.width = ~~( matches[1] ).split( 'x' )[0];
        result.video.height= ~~( matches[1] ).split( 'x' )[1];
    }
        
    if ( !!( matches = /,[\s]+([\d]+) kb\/s(\,|$)?/.exec( line ) ) ) {
        result.video = result.video || {};
        result.video.bitrate = ~~matches[1];
    }
    
    if ( !!( matches = /^ ([a-z\d]+) /.exec( line ) ) ) {
        result.video = result.video || {};
        result.video.codec = matches[1];
    }
    
    // extract advanced codec info
    var parts = line.split( ', ' );
    
    if ( parts.length ) {
        
        parts = parts[0];
        
        if ( !!( matches = /\((.*)\)$/.exec( parts ) ) ) {
            result.video = result.video || {};
            
            var parts = matches[1].replace( /(\) \()/g, ', ' ).split( ', ' );
            
            result.video.codecDetails = parts[ parts.length - 1 ];
        }
        
    }
    
    if ( !!( matches = /,[\s]+([\d]+(\.[\d]+)?)[\s]+fps(\,|$)/.exec( line ) ) ) {
        
        switch ( true ) {
    
            case [ '23.98', '23.97', '23.976' ].indexOf( matches[1] + '' ) >= 0:
                result.video = result.video || {};
                result.video.fps = 24000 / 1001;
                break;
                
            case [ '29.98', '29.97', '29.970' ].indexOf( matches[1] + '' ) >= 0:
                result.video = result.video || {};
                result.video.fps = 30000 / 1001;
                break;
                
            default:
                result.video = result.video || {};
                result.video.fps = parseFloat( matches[1] );
                break;
        }
    }
}

var parseDurationLine = function( line, result ) {
    
    var matches, hh, mm, ss, s100, total, secDuration;
    
    if ( matches = /^([\d]+)\:([\d]+)\:([\d]+)\.([\d]+),/.exec( line ) ) {
        hh = ~~matches[1];
        mm = ~~matches[2];
        ss = ~~matches[3];
        s100 = ~~matches[4];
        
        total = parseFloat( (secDuration = ( ( hh * 3600 ) + ( mm * 60 ) + ss ) ) + '.' + s100 );
        
        result.duration = total;
    }
}

var parseAudioLine = function( line, result ) {
    
    var matches;
    
    if ( !!( matches = /,[\s]+([\d]+) Hz,/.exec( line ) ) ) {
        result.audio = result.audio || {};
        result.audio.samplerate = parseFloat( matches[1] );
    }
    
    if ( !!( matches = /,[\s]+([\d]+) kb\/s(\,|$)?/.exec( line ) ) ) {
        result.audio = result.audio || {};
        result.audio.bitrate = parseFloat( matches[1] );
    }
    
    if ( !!( matches = /^ ([a-z\d]+) /.exec( line ) ) ) {
        result.audio = result.audio || {};
        result.audio.codec = matches[1];
    }
    
    // extract advanced codec info
    var parts = line.split( ', ' );
    
    if ( parts.length ) {
        
        parts = parts[0];
        
        if ( !!( matches = /\((.*)\)$/.exec( parts ) ) ) {
            result.audio = result.audio || {};
            
            var parts = matches[1].replace( /(\) \()/g, ', ' ).split( ', ' );
            
            result.audio.codecDetails = parts[ parts.length - 1 ];
        }
        
    }
}

var VideoParser = function( fileName, callback ) {
    
    var ffmpeg = null,
        tasker = new async(),
        proc   = null,
        stdout = '',
        stderr = '',
        
        result = {};
    
    tasker.sync( function() {
        
        ( function( task ) {
            
            which( 'ffmpeg', function( err, path ) {
                
                if ( err )
                    task.on( 'error', "FFmpeg not found: " + err );
                else {
                    
                    ffmpeg = path;

                    task.on( 'success' );
                    
                }
                
            } );
            
        } )( this );
        
    } ).sync( function() {
        
        ( function( task ) {
            
            // stat the file
            
            fs.stat( fileName, function( err, statInfo ) {
                
                if ( err || !statInfo.isFile() )
                    task.on( 'error', 'Failed to stat ' + fileName + ' as file!' );
                else
                    task.on( 'success' );
                
            } );
            
        } )( this );
        
    } ).sync( function() {
        
        ( function( task ) {
            
            proc = spawn( ffmpeg, [ '-i', fileName ] );
            
            proc.stdout.on( 'data', function( data ) {
                stdout += data;
            } );
            
            proc.stderr.on( 'data', function( data ) {
                stderr += data;
            } );
            
            proc.on( 'close', function() {
                task.on( 'success' );
            } );
            
        } )( this );
        
    } ).sync( function() {
        
        var lines = ( stdout + "\n" + stderr ).split( "\n" ),
            matches,
            section = null;
        
        for ( var i=0, len = lines.length; i<len; i++ ) {
            
            line = lines[i];
            
            // console.log( line );
            
            if ( matches = /^[\s]+Stream #[\d].[\d](\[[\S]+\]|\([\S]+\))?\: (Video|Audio)\:([^*]+)/.exec( line ) ) {
                
                section = ( matches[2] + '' ).toLowerCase();
                
                if ( section == 'video' )
                    parseVideoLine( matches[3], result );
                else
                if ( section == 'audio' )
                    parseAudioLine( matches[3], result );
            } else
            if ( matches = /^[\s]+Duration\:[\s]+([^*]+)/.exec( line ) ) {
                parseDurationLine( matches[1], result );
            }
        }
        
        if ( result.video && result.video.width && result.video.height ) {
            var a16_9 = 1.777777778,
                a4_3  = 1.333333333,
                aspect= result.video.width / result.video.height;
            if ( Math.abs( aspect - a16_9 ) <= Math.abs( aspect - a4_3 ) ) {
                result.video.aspect = '16:9';
            } else {
                result.video.aspect = '4:3';
            }
            
            result.video.canvasSize = result.video.width * result.video.height;
        }
        
        if ( result.duration && result.video && result.video.fps ) {
            result.video.totalFrames = ~~( result.video.fps * result.duration );
        }
        
        this.on( 'success' );
        
    } ).run( 
        
        //success
        function() {
            callback( false, result );
        },
        
        //error
        function( reason ) {
            callback( reason, null );
        }
        
    );
    
}

exports.VideoParser = VideoParser;

/*
VideoParser( '../file.mp4', function( err, result ) {
    
    console.log( err, result );
    
} );
*/