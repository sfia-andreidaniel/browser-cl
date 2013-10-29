// Transcoder type should be of type imagetranscoder

exports.preset = function( transcoder ) {
    transcoder.addParams(
        {
            "method": "resize",
            "args": [ 128, 128 ]
        }
    );
}