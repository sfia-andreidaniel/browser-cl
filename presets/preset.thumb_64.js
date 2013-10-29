// transcoder type should be image transcoder

exports.preset = function( transcoder ) {
    transcoder.addParams(
        {
            "method": "resize",
            "args": [ 32, 32 ]
        }
    );
}