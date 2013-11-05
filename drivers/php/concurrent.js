var spawn = require( 'child_process' ).spawn,
    async = require( __dirname + '/../../lib/async.js' ).Async,
    tasker = new async();

for ( var i=0; i<2000; i++ ) {
    
    ( function( index ) {
    
    tasker.async( function() {
        
        var 
            proc = spawn( '/usr/bin/php', [ 'demo.php' ] ),
            error = false;
        
        console.log( "Started thread #" + index );
        
        ( function( task ) {
            
            proc.stdout.on( 'data', function( data ) {
                if ( ( data + '' ).match( /error\:/i ) )
                    console.log( error = "Task #" + index + " error: " + data );
            } );
            
            proc.stderr.on( 'data', function( data ) {
                if ( ( data + '' ).match( /error\:/i ) )
                    console.log( error = "Task #" + index + " error: " + data );
            } );
            
            proc.on( 'exit', function() {
                
                if ( !error )
                    console.log( "Upload #" + index + " finished ok" );
                
                task.on( 'success' );
            } );
            
        } )( this );
        
    } );
    
    })( i );
    
}

tasker.run( function() {
    
    console.log( "Test completed ok" );
    
}, function( reason ) {
    
    console.log( "Test failed: " + reason );
    
} );