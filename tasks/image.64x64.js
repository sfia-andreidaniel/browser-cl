exports.task = function( fileTypeInfo, parserInfo ) {
    if ( parserInfo 
         && parserInfo.width
         && parserInfo.height
         && parserInfo.width >= 64
         && parserInfo.height >= 64
     ) {
        return {
            "extension": "64.png",
            "converter": "thumb_64"
        };
    } else {
        return false;
    }
}