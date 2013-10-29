// Transcoder type should be of type videotranscoder

exports.preset = function( transcoder ) {
    transcoder.addArgs(
        '-f',           'mp4',
        '-vcodec',      'mpeg4',
        '-b',           '400k',
        '-r',           '24000/1001',
        '-strict',
        '-2',
        '-s',           '432x320',
        '-aspect',      '4:3',
        '-acodec',      'libfaac',
        '-ar',          '22050',
        '-ac',          '2',
        '-ab',          '48k'
    );
}