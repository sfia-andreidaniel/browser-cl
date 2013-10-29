// Transcoder type should be of type videotranscoder

exports.preset = function( transcoder ) {
    transcoder.addArgs(
        '-s',           '640x480',
        '-aspect',      '4:3',
        '-r',           '30000/1001',   // framerate
        '-b',           '1072k',
        '-maxrate',     '1616k',
        '-bufsize',     '3232k',        // 2 * maxrate
        '-vcodec',      'libx264',
        '-g',           '30',           // keyframe each frames
        '-acodec',      'libfaac',
        '-ac',          '2',            // audio channels
        '-ar',          '44100',        // audio rate
        '-ab',          '128k'          // audio bitrate
    );
}