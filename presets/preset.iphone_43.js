// Transcoder type should be of type videotranscoder

exports.preset = function( transcoder ) {
    transcoder.addArgs(
        '-s',           '432x320',
        '-aspect',      '4:3',
        '-r',           '24000/1001',
        '-vcodec',      'libx264',
        '-flags',       '+loop',
                        '-cmp',
                        '+chroma',
                        '-crf', '24',
                        '-bt', '256k',
                        '-refs', '1',
                        '-coder', '0',
                        '-subq', '5',
                        '-partitions', '+parti4x4+parti8x8+partp8x8',
        '-g',           '24',
        '-keyint_min',  '25',
        '-level',       '30',
        '-qmin',        '10',
        '-qmax',        '51',
        '-trellis',     '2',
        '-sc_threshold','40',
        '-i_qfactor',   '0.71',
        '-acodec',      'libfaac',
        '-ab',          '128k',
        '-ar',          '44100',
        '-ac',          '2'
    );
}