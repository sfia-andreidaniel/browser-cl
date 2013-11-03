exports.task = function( fileTypeInfo, parserInfo ) {
    if ( parserInfo
         && parserInfo.duration
         && parserInfo.video
         && parserInfo.video.width
         && parserInfo.video.height
    ) {
        return {
            "extension": "thumb.lq.jpg",
            "converter": "video_thumb_lq"
        };
    } else {
        return false;
    }
}