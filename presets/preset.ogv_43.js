// Transcoder type should be of type videotranscoder

exports.preset = function( transcoder ) {
    transcoder.addArgs(
        '--videobitrate', '768',
        '--width',        '480',
        '--height',       '352',
        '--aspect',       '4:3',
        '--framerate',    '24000:1001',
        '--seek-index',
        '--output'
    );
}