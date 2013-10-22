<?php
    
    require_once __DIR__ . '/lib/vendor/phpws/websocket.client.php';
    
    class StorageApi {
        
        protected $_apiPort = 8080;
        protected $_apiHost = 'localhost';
        
        private $_handle = NULL;
        
        // Events queues
        protected $_events = [];
        
        /* @param $apiHostNameAndPort should be a string in format "127.0.0.1:8080" or "127.0.0.1"
            where "127.0.0.1" is the hostname of the api, and 8080 is the port on which
            the api serves requests to public world */
        
        public function __construct( $apiHostNameAndPort ) {
            
            if ( !preg_match( '/^([\S]+)\:([\d]+)$/', $apiHostNameAndPort, $matches ) ) {
                $this->_apiHost = $apiHostNameAndPort;
            } else {
                $this->_apiHost = $matches[1];
                $this->_apiPort = $matches[2];
            }
            
            $self = $this;
            
            $this->bind( 'error', function( $reason = NULL ) use (&$self) {
                $self->closeOpenedFiles();
                throw new Exception( $reason ? $reason : "Unknown error" );
            } );
            
            $this->bind( 'success', function( $data = NULL ) use (&$self) {
                $self->closeOpenedFiles();
            } );
        }
        
        public function closeOpenedFiles() {
            if ( $this->_handle !== NULL && is_resource( $this->_handle ) ) {
                @fclose( $this->_handle );
                $this->_handle = NULL;
            }
        }
        
        /* Binds an event to the Storage Api.
           @param $eventName: The name of the event
           @param $callback : A callable php closure
         */
        public function bind( $eventName, $callback ) {
            
            if ( isset( $this->_events[ $eventName ] ) )
                $this->_events[ $eventName ][] = $callback;
            else
                $this->_events[ $eventName ] = [ $callback ];
        }
        
        /* Fires an event of the Storage Api.
           @param $eventName: The name of the event
           @param $eventData <optional>: Data to be passed to the event
         */
        public function on( $eventName, $eventData = NULL ) {
            
            if ( isset( $this->_events[ $eventName ] ) )
                foreach ( $this->_events[ $eventName ] as $callback ) {
                    if ( $callback( $eventData ) === FALSE )
                        return FALSE;
                }
            
            return TRUE;
        }
        
        /* Dumps data in STDOUT in json prettified format
           @param $data: <any>
         */
        public function log( $data ) {
            $this->on( 'log', $data );
        }
        
        private function testFrame( $frameData ) {
            if ( is_array( $frameData ) && isset( $frameData['ok'] ) &&
                 $frameData['ok'] === FALSE )
            throw new Exception( isset( $frameData['error'] ) ? $frameData['error'] : "Unknown error!" );
            
            return $frameData;
        }
        
        /* API FUNCTIONS SPECIFIC FOR THE CLIENTS */
        
        /* Stores a file in the transcoding cloud, and returns the store result 
        */
        
        public function storeFileByPath( $localFilePath, $options = NULL ) {
            
            if ( !@file_exists( $localFilePath ) ) {
                $this->on('error', "Failed to store local file '$localFilePath' to cloud: File does not exists!" );
            }
            
            $this->_handle = @fopen( $localFilePath, "r" );
            
            if ( !is_resource( $this->_handle ) )
                $this->on('error', "Failed to open local file!" );
            
            $ws = new WebSocket( 'ws://' . $this->_apiHost . ':' . $this->_apiPort . '/api/', 'api' );
            
            $ws->open();
            
            // Send file packet
            
            $filePacket = [
                'name' => basename( $localFilePath ),
                'size' => filesize( $localFilePath )
            ];
            
            $ws->sendMessage( WebSocketMessage::create( json_encode( $filePacket ) ) );
            
            // Read acknowledge packet
            
            $ack = $ws->readMessage();
            
            if ( $ack === NULL )
                $this->on('error', "Failed to ack frame!" );
            
            $ack = $this->testFrame( json_decode( $ack->getData(), TRUE ) );
            
            if ( !is_array( $ack ) || !isset( $ack['ack'] ) || $ack['ack'] != 1 ||
                 !isset( $ack['phase'] ) || $ack['phase'] != 'transfer' )
            $this->on('error', "Failed to transferr file: Error at first acknowledge packet: " . json_encode( $ack ));
            
            // echo "Reading from file...\n";
            
            // Send file packet data
            
            $numRead = 0;
            
            $frame = WebSocketMessage::create('');
            
            while ( !feof( $this->_handle ) ) {
                
                $buffer = @fread( $this->_handle, 45000 );
                
                if ( $buffer === FALSE )
                    $this->on('error', "Failed to read data from file!" );
                
                $frame->setData( '"' . base64_encode(  $buffer ) . '"' );
                $ws->sendMessage( $frame );
                
                // Read ack back from client
                
                $ack = $ws->readMessage();
                
                if ( $ack === NULL )
                    $this->on('error', "Failed to ack frame!");
                
                $ack = $ack->getData();
                
                $ack = $this->testFrame( json_decode( $ack, TRUE ) );
                
                $numRead += $ack['got'];
                
                if ( !isset( $ack['got'] ) || $ack['got'] != strlen( $buffer ) )
                    $this->on('error', "Transfer error!");
                
                echo $numRead, "\n";
            }
            
            fclose( $this->_handle );

            $this->_handle = NULL;
            
            // Read final packet
            
            echo "reading final packet...\n";
            
            $packet = $ws->readMessage();
            
            if ( $packet === NULL )
                throw new Exception("Failed to ack frame!");
            
            $packet = $this->testFrame( json_decode( $packet->getData(), TRUE ) );
            
            echo "Done\n";

            $ws->close();
            
            $this->on("success", TRUE );
            
            return $packet;

        }
        
    }
    
?>