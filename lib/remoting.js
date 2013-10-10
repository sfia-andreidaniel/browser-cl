var ajax = require( __dirname + '/ajax.js' ).$_JSON_GET;

exports.Remoting = function( targetHTTP ) {
    
    this.url = 'http://' + targetHTTP + '/event/',
         me = this;
    
    this.emmit = function( eventName, eventData, success, error ) {
        
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
    
}