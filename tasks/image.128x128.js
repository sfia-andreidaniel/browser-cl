exports.task = function( fileTypeInfo, parserInfo ) {
    if ( parserInfo 
         && parserInfo.width
         && parserInfo.height
         && parserInfo.width >= 128
         && parserInfo.height >= 128
     ) {
        return {
            "extension": "128.png",
            "converter": "thumb_128"
        };
    } else {
        return false;
    }
}