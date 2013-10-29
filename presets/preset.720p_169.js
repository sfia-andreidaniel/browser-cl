// Transcoder type should be of type videotranscoder

exports.preset = function( transcoder ) {
    transcoder.addArgs(
        '-s',           '1280x720',
        '-aspect',      '16:9',
        '-r',           '30000/1001',   // framerate
        '-b',           '1904k',
        '-maxrate',     '3088k',
        '-bufsize',     '6176k',        // 2 * maxrate
        '-vcodec',      'libx264',
        '-g',           '30',           // keyframe each frames
        '-acodec',      'libfaac',
        '-ac',          '2',            // audio channels
        '-ar',          '44100',        // audio rate
        '-ab',          '128k'          // audio bitrate
    );
}