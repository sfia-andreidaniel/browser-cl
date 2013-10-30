var Collection = require( __dirname + "/lib/registry.js" ).JobsCollection,
    query = new Collection();

query.remoteFind( "127.0.0.1:8080", 0, 1000, {
    
    "taskId": 1
    
}, function( err ) {
    
    if ( err ) {
        
        console.log( "Error: " + err );
        
    } else {
        
        query.each( function( task ) {
            
            console.log( this.taskId, this.url );
            
            this.setStatus( 'success', function( err ) {
                
                if ( !err )
                    console.log( "Task " + task.taskId + " changed!" );
                else
                    console.log( "Error: " + err );
                
            } );
            
        } );
        
    }
    
} );

