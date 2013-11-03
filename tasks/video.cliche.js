exports.task = function( fileTypeInfo, parserInfo ) {
    if ( parserInfo 
         && parserInfo.duration
         && parserInfo.video 
         && parserInfo.video.width 
         && parserInfo.video.height
     ) {
        return {
            "extension": "cliche.jpg",
            "converter": "cliche"
        };
    } else {
        return false;
    }
}