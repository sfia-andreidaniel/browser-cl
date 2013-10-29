exports.task = function( fileTypeInfo, parserInfo ) {
    if ( parserInfo &&
         parserInfo.video &&
         parserInfo.video.width &&
         parserInfo.video.height &&
         parserInfo.video.aspect == '16:9'
    ) {
        return {
            "extension": "240p.mp4",
            "converter": "240p_169"
        }
    } else {
        return false;
    }
}