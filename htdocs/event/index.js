exports.handle = function( response, request, urlInfo, controller ) {
    //response.writeHeader( "Content-Type: application/json" );
    
    var eventName = urlInfo.event || null;
    
    if ( !eventName ) {
        
        response.write( JSON.stringify({
            "error": true,
            "reason": "Which event?"
        }) );
        
        return;
        
    } else {
        
        var data = urlInfo.data || "{}";
        
        try {
            data = JSON.parse( data );
        } catch ( e ) {
            response.write( JSON.stringify({
                "error": true,
                "reason": "Unserializeable request data"
            }));
            
            return;
        }
        
        data.request = request;
        data.response= response;
        data.eventName = eventName;
        
        controller.on( eventName, data );
    }
    
}

exports.async = true;