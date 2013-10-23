<?php
    
    require_once __DIR__ . '/lib/vendor/phpws/websocket.client.php';
    require_once __DIR__ . '/lib/vendor/other/OSUtils.class.php';
    
    define( "STORAGE_API_ENGINE_PHP", "PHP" );
    define( "STORAGE_API_ENGINE_NODEJS", "NODE" );
    define( "STORAGE_API_ENGINE_AUTO", "AUTO" );
    
    define( "STORAGE_NODEJS_BINARY_NAME", "nodejs" ); // .exe will be automatically appended if on windows platform
    
    class StorageApi {
        
        protected $_apiPort = 8080;
        protected $_apiHost = 'localhost';
        
        private $_handle = NULL;
        
        // Events queues
        protected $_events = [];
        
        
        // Weather nodejs is present on this machine
        protected static $_nodejs_support = FALSE;
        protected static $_nodejs_binnary = NULL;
        
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
                $this->_events[ $eventName ] = array_merge( [ $callback ], $this->_events[ $eventName ] );
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
        
        private function testFrame( $frameData ) {
            if ( is_array( $frameData ) && isset( $frameData['ok'] ) &&
                 $frameData['ok'] === FALSE )
            throw new Exception( isset( $frameData['error'] ) ? $frameData['error'] : "Unknown error!" );
            
            return $frameData;
        }
        
        /* API FUNCTIONS SPECIFIC FOR THE CLIENTS */
        
        /* Stores a file in the transcoding cloud, and returns the store result 
        */
        
        public function storeFileByPath( $localFilePath, $options = NULL, $engine = STORAGE_API_ENGINE_AUTO ) {
            
            switch ( $engine ) {
                
                case STORAGE_API_ENGINE_AUTO:
                    if ( self::$_nodejs_support )
                        return $this->storeFileByPathNodeJS( $localFilePath, $options );
                    else
                        return $this->storeFileByPathPHP( $localFilePath, $options );
                    
                    break;
                
                case STORAGE_API_ENGINE_PHP:
                    return $this->storeFileByPathPHP( $localFilePath, $options );
                    break;
                
                case STORAGE_API_ENGINE_NODEJS:
                    if ( !self::$_nodejs_support )
                        $this->on( 'error', 'NODE JS is not detected on this machine (checked in PATH variable for nodejs binary)' );
                    return $this->storeFileByPathNodeJS( $localFilePath, $options );
                    break;
                
                default:
                    $this->on( 'error', "Unknown api engine!" );
                    break;
                
            }
        
        }
        
        private function storeFileByPathPHP( $localFilePath, $options = NULL ) {
            
            try {
                
                $this->on( 'status', 'using PHP transfer engine (slowest) ...' );
                
                $this->on( 'status', 'opening and testing file' );
                
                if ( !@file_exists( $localFilePath ) ) {
                    throw new Exception("Failed to store local file '$localFilePath' to cloud: File does not exists!" );
                }
                
                $this->_handle = @fopen( $localFilePath, "r" );
            
                if ( !is_resource( $this->_handle ) )
                    throw new Exception( "Failed to open local file!" );
                
                $this->on( 'status', 'creating server connection' );
                
                $ws = new WebSocket( 'ws://' . $this->_apiHost . ':' . $this->_apiPort . '/api/', 'api' );
                
                $ws->open();
                
                $this->on( 'status', 'sending description packet' );
                // Send file packet
                
                $filePacket = [
                    'name' => basename( $localFilePath ),
                    'size' => $totalSize = filesize( $localFilePath )
                ];
                
                $ws->sendMessage( WebSocketMessage::create( json_encode( $filePacket ) ) );
                
                // Read acknowledge packet
                
                $ack = $ws->readMessage();
                
                if ( $ack === NULL )
                    throw new Exception( "Failed to ack frame!" );
                
                $ack = $this->testFrame( json_decode( $ack->getData(), TRUE ) );
                
                if ( !is_array( $ack ) || !isset( $ack['ack'] ) || $ack['ack'] != 1 ||
                     !isset( $ack['phase'] ) || $ack['phase'] != 'transfer' )
                throw new Exception("Failed to transferr file: Error at first acknowledge packet: " . json_encode( $ack ));
                
                $this->on( 'status', 'transferring file' );
                
                // echo "Reading from file...\n";
                
                // Send file packet data
                
                $numRead = 0;
                $lastProgress = 0;
                
                $frame = WebSocketMessage::create('');
                
                while ( !feof( $this->_handle ) ) {
                    
                    $buffer = @fread( $this->_handle, 45000 );
                    
                    if ( $buffer === FALSE )
                        throw new Exception("Failed to read data from file!" );
                    
                    $frame->setData( '"' . base64_encode(  $buffer ) . '"' );
                    $ws->sendMessage( $frame );
                    
                    // Read ack back from client
                    
                    $ack = $ws->readMessage();
                    
                    if ( $ack === NULL )
                        throw new Exception( "Failed to ack frame!" );
                    
                    $ack = $ack->getData();
                    
                    $ack = $this->testFrame( json_decode( $ack, TRUE ) );
                    
                    $numRead += $ack['got'];
                    
                    if ( !isset( $ack['got'] ) || $ack['got'] != strlen( $buffer ) )
                        throw new Exception( "Transfer error!");
                    
                    $currentProgress = ~~( $numRead / ( $totalSize / 100 ) );
                    
                    if ( $currentProgress != $lastProgress ) {
                        $lastProgress = $currentProgress;
                        $this->on( "progress", $currentProgress );
                    }
                }
                
                $this->on( 'status', 'transfer complete. closing file' );
                
                @fclose( $this->_handle );
                $this->_handle = NULL;
                
                // Read final packet
                
                $this->on( 'status', 'waiting for server to send response data' );
                
                $packet = $ws->readMessage();
                
                if ( $packet === NULL )
                    $this->on("error", "Failed to ack frame!");
                
                $packet = $this->testFrame( json_decode( $packet->getData(), TRUE ) );
                
                $this->on( 'status', 'closing connection' );

                $ws->close();
                
                $this->on("success", $packet );
                
                return $packet;
            
            } catch ( Exception $e ) {
            
                $this->on( 'error', $e->getMessage() );
            
            }
        }
        
        private function _eventParser( &$buffer, $forceNewLine = FALSE ) {
            if ( $forceNewLine )
                $buffer .= "\n";
            
            $out = [];
            
            while ( $pos = strpos( $buffer, "\n" ) ) {
                $chunk = substr( $buffer, 0, $pos );
                $buffer = substr( $buffer, $pos + 1 );
                
                if ( !strlen( $chunk ) )
                    continue;
                
                $data = @json_decode( $chunk, TRUE );
                
                if ( !is_array( $data ) )
                    throw new Exception("Bad event raw chunk '$chunk'!");
                
                else
                    $out[] = $data;
            }
            
            return $out;
        }
        
        private function storeFileByPathNodeJS( $localFilePath, $options = NULL ) {
            
            try {
                
                $this->on( 'status', 'using NodeJS transfer engine (fastest), nodejs binary = ' . self::$_nodejs_binnary );
                
                $returnValue = NULL;
                
                $self = $this;
                
                $eventDispatcher = function( $event ) use ( &$returnValue, &$self ) {
                    if ( isset( $event['event'] ) ) {
                        
                        switch ( $event['event'] ) {
                            
                            case 'error':
                                $self->on( 'error', isset( $event['data'] ) ? $event['data'] : "unknown error" );
                                break;
                            
                            case 'status':
                                $self->on( 'status', isset( $event['data'] ) ? $event['data'] : "unknown status message" );
                                break;
                            
                            case 'success':
                                $returnValue = isset( $event['data'] ) ? $event['data'] : [];
                                break;
                            
                            case 'progress':
                                $self->on( 'progress', isset( $event['data'] ) ? $event['data'] : -1 );
                                break;
                            
                            default:
                                $self->on( 'error', 'Unknown event type received from node process: ' . $event['event'] );
                                break;
                        }
                        
                    }
                };
                
                $commandLine = escapeshellarg( self::$_nodejs_binnary ) . " "
                              . escapeshellarg( realpath( __DIR__ . "/lib/vendor/nodejs/apiclient.js" ) ) . " "
                              . "--host " . escapeshellarg( $this->_apiHost ) . " "
                              . "--port " . escapeshellarg( $this->_apiPort ) . " "
                              . "--file " . escapeshellarg( $localFilePath ) . " "
                              . "--options " . escapeshellarg( json_encode( $options ) );
                
                $descriptorspec = [
                    [ "pipe", 'r' ], // stdin
                    [ "pipe", 'w' ], // stdout
                    [ "pipe", 'w' ]  // stderr
                ];
                
                $pipes   = [ ];                     // Pipe arrays. ( 0 stdin, 1 stdout, 2 stderror )
                $pstates = [ FALSE, FALSE, FALSE ]; // Pipe states. ( FALSE = NOT CLOSED, TRUE = CLOSED )
                $pbuffers= [ '', '', '' ];          // Pipe buffers ( 0 not used, 1 stdout buffer, 2 stderror buffer )
                
                $process = @proc_open( $commandLine, $descriptorspec, $pipes );
                
                if ( !is_resource( $process ) )
                    throw new Exception( "Failed to execute process: $commandLine" );
                
                // Set the pipes in non blocking mode
                for ( $i = 0; $i < 3; $i++ )
                    stream_set_blocking( $pipes[$i], 0 );
                
                try {
                    // While stdout and stderror pipes are not closed, ...
                    while ( !$pstates[1] && !$pstates[2] ) {
                    
                        // Read data from remaining opened pipes
                        for ( $i = 1; $i < 3; $i++ ) {
                            
                            if ( $pstates[$i] === TRUE )
                                continue; // Ignore pipe if has been closed
                            
                            // If reached at end of pipe, mark pipe as closed and continue
                            if ( feof( $pipes[$i] ) ) {
                                $pstates[$i] = TRUE;
                                continue;
                            }
                            
                            // Read data from current pipe...
                            $bytes = @fread( $pipes[$i], 8192 );
                            
                            if ( $bytes !== FALSE ) {
                            
                                $pbuffers[ $i ] .= $bytes;
                                
                                if ( $i == 2 && strlen( $bytes ) ) {
                                    
                                    /// Woups, we've got something on stderror. This is not good
                                    break 2;
                                } else {
                                    if ( $i == 1 && strlen( $bytes ) ) {
                                        $events = $this->_eventParser( $pbuffers[1] );
                                        if ( count( $events ) ) {
                                            foreach ( $events as $event ) {
                                                $eventDispatcher( $event );
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    $events = $this->_eventParser( $pbuffers[1], TRUE );
                    
                    if ( count( $events ) ) {
                        
                        foreach ( $events as $event ) {
                            $eventDispatcher( $event );
                        }
                        
                    }
                    
                } catch ( Exception $e ) {
                    
                    $finallyException = $e;
                    
                } finally {
                
                    $this->on( 'status', 'closing pipes...' );
                    
                    // Close the remaining process opened pipes
                    for ( $i=0; $i<3; $i++ ) {
                        if ( $pstates[$i] === FALSE ) {
                            @fclose( $pipes[$i] );
                            $pstates[$i] = TRUE;
                        }
                    }
                }
                
                if ( isset( $finallyException ) )
                    throw $finallyException;
                
                return $returnValue;
                
            } catch ( Exception $e ) {
                
                $this->on( 'error', $e->getMessage() );
                
            }
            
        }
        
        public static function initialize() {
            
            $nodeBinary = OSUtils::which( STORAGE_NODEJS_BINARY_NAME );
            
            if ( empty( $nodeBinary ) )
                self::$_nodejs_support = FALSE;
            else {
                self::$_nodejs_support = TRUE;
                self::$_nodejs_binnary  = $nodeBinary;
            }
            
        }
        
    }
    
    StorageApi::initialize();
    
?>