<?php
    
    require_once dirname( __FILE__ ) . "/WebSocketClient.class.php";
    
    class StorageApi {
        
        protected $_apiPort = 8080;
        protected $_apiHost = 'localhost';
        
        // Websocket connection to the api
        protected $_ws = NULL;
        
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
            
            $this->bind( 'log', function( $data ) {
                echo "LOG: ", json_encode( $data, JSON_PRETTY_PRINT ), "\n";
            } );
            
            $this->log( "Api address: HOST=" . $this->_apiHost . " PORT=" . $this->_apiPort );
            
            $this->bind( 'connect', function( $error ) {
                $this->log( empty( $error ) ? "Connected to api" : "Failed to connect to api: " . $error );
            } );
            
            $this->bind( 'disconnect', function() {
                $this->log( "Disconnected from api" );
            } );
            
            $this->bind( 'connectionFailed', function() {
                $this->log( "Connection failed!" );
            } );
            
            $this->_ws = new WebsocketClient( 'ws://' . $this->_apiHost . ':' . $this->_apiPort . '/api/', [ 'api' ] );
            
            $self = $this;
            
            $this->_ws->bind( 'connectionError', function() {
                throw new Exception("Error while connecting to api!" );
            } );
            
            $this->_ws->bind( 'error', function( $reason ) {
                throw new Exception("Api error: " . ( $reason ? $reason : "Unknown reason" ) );
            } );
            
            $this->_ws->bind( 'disconnect', function() use ( &$self ) {
                $self->log( "Disconnected from the api!" );
            } );
            
            if ( !$this->_ws->connect() )
                throw new Exception("Failed to connect to api!");
            
            $this->log( "Class initialized" );
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
        
        /* API FUNCTIONS SPECIFIC FOR THE CLIENTS */
        
        /* Stores a file in the transcoding cloud, and returns the store result 
        */
        
        public function storeFileByPath( $localFilePath, $options = NULL ) {
            
            if ( !@file_exists( $localFilePath ) ) {
                throw new Exception( "Failed to store local file '$localFilePath' to cloud: File does not exists!" );
            }
            
            $this->log( "Store file: " . $localFilePath );
            
            // Generate a unique-file-name of the file to the api server
            
            $packet = json_encode( [
                "do"   => "store-file",
                "name" => basename( $localFilePath ),
                "options" => $options
            ] );
            
            $this->_ws->send( $packet );
            
            return [
                'not_implemented' => TRUE
            ];
            
            throw new Exception("Store file: " . $localFilePath );
            
        }
        
    }
    
?>