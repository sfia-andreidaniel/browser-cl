// Transcoder type should be of type videotranscoder

exports.preset = function( transcoder ) {
    
    transcoder.addArgs(
        '--videobitrate', '768',
        '--width',        '640',
        '--height',       '368',
        '--aspect',       '16:9',
        '--framerate',    '24000:1001',
        '--seek-index',
        '--output'
    );
}