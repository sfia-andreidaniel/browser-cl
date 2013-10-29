exports.task = function( fileTypeInfo, parserInfo ) {
    if ( parserInfo 
         && parserInfo.width
         && parserInfo.height
         && parserInfo.width >= 32
         && parserInfo.height >= 32
     ) {
        return {
            "extension": "32.png",
            "converter": "thumb_32"
        };
    } else {
        return false;
    }
}