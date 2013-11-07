<?php
    
    require_once __DIR__ . "/classes/StorageApi.class.php";
    
    // The IP and port where the API server is installed is required
    $api = new StorageApi( '127.0.0.1:8080' );
    
    // When the api sends a status message regarding
    // the job upload progress, you can catch the message
    // in order to process it somewhere else
    $api->bind( 'status', function( $status ) {
        
        echo "# ", $status, "\n";
        
    } );
    
    // When the api sends an error message regarding
    // the job upload progress, you can catch the message
    // in order to process it somewhere else
    $api->bind( 'error', function( $reason ) {
        echo ("ERROR: " . $reason . "\n" );
        return FALSE;
    } );
    
    // When the api sends a progress percent regarding
    // the job upload progress, you can catch the
    // percent in order to process it...
    $api->bind( 'progress', function( $number ) {
        echo $number, "%\n";
    } );
    
    // And finally, we upload a file to the storage...
    var_dump( $api->storeFileByPath( '../../samplefiles/file.mp4', [
        'apiKey' => '623231243a59d73a92fbac7646f182df'
    ], STORAGE_API_ENGINE_NODEJS ) );
    
?>