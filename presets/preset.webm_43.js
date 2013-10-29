// Transcoder type should be of type videotranscoder

exports.preset = function( transcoder ) {
    
    transcoder.addArgs(
        '-f', 'webm',
        '-vcodec', 'libvpx',
        '-b', '768k',
        '-r', '24000/1001',
        '-strict', 
        '-2',
        '-s', '480x352',
        '-aspect', '4:3',
        '-acodec', 'libvorbis',
        '-ar', '44100',
        '-ac', '2',
        '-ab', '48k'
    );
    
}