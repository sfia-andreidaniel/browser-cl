exports.task = function( fileTypeInfo, parserInfo ) {
    if ( parserInfo 
         && parserInfo.video 
         && parserInfo.video.width 
         && parserInfo.video.height 
         && parserInfo.video.aspect == '16:9' 
         && parserInfo.canvasSize 
         && parserInfo.canvasSize >= 188416 ) {
        return {
            "extension": "360p.mp4",
            "converter": "360p_169"
        };
    } else {
        return false;
    }
}