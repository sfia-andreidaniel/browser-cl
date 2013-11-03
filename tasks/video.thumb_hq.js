exports.task = function( fileTypeInfo, parserInfo ) {
    if ( parserInfo 
         && parserInfo.duration
         && parserInfo.video 
         && parserInfo.video.width 
         && parserInfo.video.height
         && parserInfo.canvasSize
         && parserInfo.canvasSize >= 737280
    ) {
        return {
            "extension": "thumb.hq.jpg",
            "converter": "video_thumb_hq"
        };
    } else {
        return false;
    }
}