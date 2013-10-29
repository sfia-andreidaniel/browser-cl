exports.task = function( fileTypeInfo, parserInfo ) {
    if ( parserInfo &&
         parserInfo.video &&
         parserInfo.video.width &&
         parserInfo.video.height &&
         parserInfo.video.aspect == '4:3'
    ) {
        return {
            "extension": "240p.mp4",
            "converter": "240p_43"
        };
    } else {
        return false;
    }
}