exports.task = function( fileTypeInfo, parserInfo ) {
    if ( parserInfo 
         && parserInfo.video 
         && parserInfo.video.width 
         && parserInfo.video.height 
         && parserInfo.video.aspect == '4:3'
     ) {
        return {
            "extension": "blackberry.mp4",
            "converter": "blackberry_43"
        };
    } else {
        return false;
    }
}