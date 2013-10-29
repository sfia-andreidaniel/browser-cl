exports.task = function( fileTypeInfo, parserInfo ) {
    if ( parserInfo 
         && parserInfo.video 
         && parserInfo.video.width 
         && parserInfo.video.height 
         && parserInfo.video.aspect == '4:3' 
         && parserInfo.canvasSize 
         && parserInfo.canvasSize >= 135168 ) {
        return {
            "extension": "360p.mp4",
            "converter": "360p_43"
        };
    } else {
        return false;
    }
}