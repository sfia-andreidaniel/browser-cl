<?php

    require_once __DIR__ . '/lib/vendor/phpws/websocket.client.php';
    
    try {
    
    $input = str_repeat( 'a', 64000 );
    $msg   = WebSocketMessage::create( $input );
    
    $now = time();
    
    $client = new WebSocket( "ws://127.0.0.1:8080/api/", "api" );
    
    $client->open();
    
    for ( $i=0; $i < 100000; $i++ ) {
    
        $client->sendMessage( $msg );
    
        $msg = $client->readMessage();
        
        echo $i, " ", strlen( $msg->getData() ), "\n";
    
    }
    
    $client->close();
    
    $now2 = time();
    
    echo $now2 - $now, " seconds\n";
    
    } catch ( Exception $e ) {
        echo $e->getMessage(), "\n";
    }

?>