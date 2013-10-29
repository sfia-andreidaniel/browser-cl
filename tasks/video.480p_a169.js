exports.task = function( fileTypeInfo, parserInfo ) {
    if ( parserInfo 
         && parserInfo.video 
         && parserInfo.video.width 
         && parserInfo.video.height 
         && parserInfo.video.aspect == '16:9' 
         && parserInfo.canvasSize 
         && parserInfo.canvasSize >= 352632 ) {
        return {
            "extension": "480p.mp4",
            "converter": "480p_169"
        };
    } else {
        return false;
    }
}