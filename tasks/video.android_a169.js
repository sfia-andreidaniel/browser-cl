exports.task = function( fileTypeInfo, parserInfo ) {
    if ( parserInfo 
         && parserInfo.video 
         && parserInfo.video.width 
         && parserInfo.video.height 
         && parserInfo.video.aspect == '16:9'
     ) {
        return {
            "extension": "android.mp4",
            "converter": "android_169"
        };
    } else {
        return false;
    }
}