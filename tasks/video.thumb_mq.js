exports.task = function( fileTypeInfo, parserInfo ) {
    if ( parserInfo 
         && parserInfo.duration
         && parserInfo.video 
         && parserInfo.video.width 
         && parserInfo.video.height
         && parserInfo.canvasSize
         && parserInfo.canvasSize >= 245760
    ) {
        return {
            "extension": "thumb.mq.jpg",
            "converter": "video_thumb_mq"
        };
    } else {
        return false;
    }
}