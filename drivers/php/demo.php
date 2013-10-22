<?php
    
    require_once dirname(__FILE__) . "/StorageApi.class.php";
    
    $api = new StorageApi( '127.0.0.1:8080' );
    
    print_r( $api->storeFileByPath( '/home/andrei/Desktop/sample.mp4' ) );
    
?>