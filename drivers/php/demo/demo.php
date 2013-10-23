<?php
    
    require_once __DIR__ . "/StorageApi.class.php";
    
    $api = new StorageApi( '127.0.0.1:8080' );
    
    $api->bind( 'status', function( $status ) {
        
        echo "# ", $status, "\n";
        
    } );
    
    $api->bind( 'error', function( $reason ) {
        
        echo( "ERROR: $reason\n" );
        
        return FALSE;
        
    } );
    
    $api->bind( 'progress', function( $number ) {
        echo $number, "%\n";
    } );
    
    print_r( $api->storeFileByPath( '/home/andrei/Desktop/sample.mp4', [], STORAGE_API_ENGINE_NODEJS ) );
    
?>