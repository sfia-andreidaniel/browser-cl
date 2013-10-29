exports.task = function( fileTypeInfo, parserInfo ) {
    if ( parserInfo 
         && parserInfo.video 
         && parserInfo.video.width 
         && parserInfo.video.height 
         && parserInfo.video.aspect == '16:9'
     ) {
        return {
            "extension": "iphone.mp4",
            "converter": "iphone_169"
        };
    } else {
        return false;
    }
}