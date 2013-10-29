exports.task = function( fileTypeInfo, parserInfo ) {
    if ( parserInfo 
         && parserInfo.video 
         && parserInfo.video.width 
         && parserInfo.video.height 
         && parserInfo.video.aspect == '4:3' 
         && parserInfo.canvasSize 
         && parserInfo.canvasSize >= 245760 ) {
        return {
            "extension": "480p.mp4",
            "converter": "480p_43"
        };
    } else {
        return false;
    }
}