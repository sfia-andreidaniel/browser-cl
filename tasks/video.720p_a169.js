exports.task = function( fileTypeInfo, parserInfo ) {
    if ( parserInfo 
         && parserInfo.video 
         && parserInfo.video.width 
         && parserInfo.video.height 
         && parserInfo.video.aspect == '16:9' 
         && parserInfo.canvasSize 
         && parserInfo.canvasSize >= 737280 ) {
        return {
            "extension": "720p.mp4",
            "converter": "720p_169"
        };
    } else {
        return false;
    }
}