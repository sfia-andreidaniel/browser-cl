// Transcoder type should be of type videotranscoder

exports.preset = function( transcoder ) {
    transcoder.addArgs(
        '-s',           '480x352',
        '-aspect',      '4:3',
        '-r',           '30000/1001',   // framerate
        '-b',           '768k',
        '-maxrate',     '1024k',
        '-bufsize',     '2048k',        // 2 * maxrate
        '-vcodec',      'libx264',
        '-g',           '30',           // keyframe each frames
        '-acodec',      'libfaac',
        '-ac',          '2',            // audio channels
        '-ar',          '44100',        // audio rate
        '-ab',          '128k'          // audio bitrate
    );
}