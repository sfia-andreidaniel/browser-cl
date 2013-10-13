var ajax = require( __dirname + '/ajax.js' ).$_JSON_GET,
    Thing = require( __dirname + '/thing.js' ).Thing;

exports.Remoting = function( targetHTTP ) {
    
    var me = new Thing();
        me.url = 'http://' + targetHTTP + '/event/';
    
    // console.log( "REMOTING_NEW:" + targetHTTP );
    
    me.emmit = function( eventName, eventData, success, error ) {
        
        var url = me.url + '?event=' + encodeURIComponent( eventName ) + '&data=' + encodeURIComponent( JSON.stringify( eventData || {} ) );
        
        // console.log( "Remoting.emmit: " + url );
        
        ajax( url, function( response ) {
            
            // console.log( "Remoting.response: ", response );
            
            response = response || {};
            
            if ( !response.ok ) {
                error( response.reason || 'unknown error' );
            } else {
                success( response );
            }
            
        } );
    }
    
    return me;
}