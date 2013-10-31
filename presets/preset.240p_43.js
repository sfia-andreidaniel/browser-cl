// Transcoder type should be of type videotranscoder

exports.preset = function( transcoder ) {
    transcoder.addArgs(
        '-s',           '320x240',
        '-aspect',      '4:3',
        '-r',           '30000/1001',   // framerate
        '-b',           '464k',
        '-maxrate',     '768k',
        '-bufsize',     '1536k',        // 2 * maxrate
        '-vcodec',      'libx264',
        '-g',           '30',           // keyframe each seconds
        '-acodec',      'libfaac',
        '-ac',          '1',            // audio channels
        '-ar',          '44100',        // audio rate
        '-ab',          '32k'           // audio bitrate
    );

    transcoder.enableQtFastStart();

}