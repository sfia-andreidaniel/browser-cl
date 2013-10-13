<?php
    
    class WebSocketClient {
        
        protected $_services = [];
        protected $_host = NULL;
        protected $_port = NULL;
        protected $_path = NULL;
        protected $_key  = "o158us95aNEv4bgKxH0ayQ==";
        
        protected $_socket = NULL;
        
        protected $_bufferIn  = "";
        protected $_bufferOut = "";
        
        protected $_ttl = NULL;
        
        protected $_events = [];
        
        protected $_connected = FALSE;
        
        private function microtime() {
            list( $usec, $sec ) = explode( " ", microtime() );
            return (float)$usec + (float)$sec;
        }
        
        public function __construct( $wsURL, array $services ) {
            
            $this->_ttl = $this->microtime();
            
            $info = parse_url( $wsURL );
            
            if ( !isset( $info[ 'scheme' ] ) || $info['scheme'] != 'ws' )
                throw new Exception("WebSocket: the scheme of the URL should be 'ws'" );
            
            if ( !isset( $info['host'] ) || !isset( $info['port'] ) )
                throw new Exception("WebSocket: the url does not contain a host and a port!");
            
            if ( !isset( $info['path'] ) )
                $info['path'] = '/';
            
            $this->_path = $info['path'];
            $this->_host = $info['host'];
            $this->_port = $info['port'];
            
            if ( !count( $services ) )
                throw new Exception("WebSocket: You must specify at least one service in the @service argument!" );
            
            $this->_services = $services;
            
            
            $self = $this;
            
            $this->bind( 'error', function( $reason ) use ( $self ) {
                
                $self->close();

            } );
            
            $this->bind( 'frame', function() {
            
                $this->_bufferIn .= $this->_bufferIn;
            
                while ( strlen( $this->_bufferIn ) > 2 ) {
            
                    $frame = $this->decodeFrame( $this->_bufferIn );
                    $data = $frame['payload'];
                    $data = substr( $data, 0, $frame['payloadLength'] );
                    
                    $this->_bufferIn = substr( $this->_bufferIn, $frame[ 'payloadLength' ] + 2 );
                    
                    $this->on( 'message', $data );
                    
                }
                
            } );
        }
        
        // The loop method of the WebSocket client should be
        // executed before tring to read packets
        public function loop( $microSeconds = 50000 ) {
            
            usleep( $microSeconds );
            
            // If the _bufferOut contains data, we write the data to the websocket server
            if ( strlen( $this->_bufferOut ) ) {
                
                // echo "Debug: Sending " . strlen( $this->_bufferOut ) . "\n";
                
                @stream_set_blocking( $this->_socket, 1 );
                
                if ( fwrite( $this->_socket, $this->_bufferOut ) === FALSE ) {
                    @stream_set_blocking( $this->_socket, 0 );
                    $this->on( 'error', "Failed to write data to websocket server!" );
                    return;
                } else {
                    $this->_bufferOut = '';
                    @stream_set_blocking( $this->_socket, 0 );
                }
            }
            
            $dataIn = @fread( $this->_socket, 1000000 );
            
            if ( $dataIn !== FALSE && $dataIn !== '') {
                $this->_bufferIn .= $dataIn;
                $this->on( 'frame' );
            }
            
        }
        // Connects to the websocket server
        public function connect() {
        
            $this->_key = base64_encode( $this->generateRandomString() );
            
            if ( $this->_socket ) {
                @fclose( $this->socket() ); // Close previous socket connection if existed
            }
        
            $this->_connected = FALSE;
        
            $this->_socket = @fsockopen( $this->_host, $this->_port );
            
            if ( !is_resource( $this->_socket ) ) {
                $this->on( 'connectionError', "Failed to connect to $this->_host:$this->_port" );
                return FALSE;
            }
            
            // Set socket timeout
            if ( @stream_set_timeout( $this->_socket, 1 ) === FALSE ) {
                $this->on( 'connectionError', "Failed to set connection stream timeout!" );
                return FALSE;
            }
            
            if ( @fwrite( $this->_socket, $connectHeader = $this->getHeaders() ) === FALSE ) {
                $this->on( 'connectionError', "Failed to write handshake connection header!" );
                return FALSE;
            }
            
            usleep( 10000 );
            
            $handshake = @fread( $this->_socket, 2048 );
            
            if ( empty( $handshake ) ) {
                $this->on( 'connectionError', "Failed to obtain the handshake buffer!" );
                return FALSE;
            }
            
            try {
                $this->checkHandshake( $handshake );
            } catch ( Exception $e ) {
                $this->on( 'connectionError', "Failed to make a handshake with the WebSocket server!" );
                return FALSE;
            }
            
            // Assume that the websocket server, sent us a command on connect
            $_dataIn = explode( "\r\n\r\n", $handshake );
            
            if ( count( $_dataIn ) > 1 )
                $this->_bufferIn = implode( "\r\n\r\n", array_slice( $_dataIn, 1 ) );
            
            // Set the socket operating mode to non-blocking
            stream_set_blocking( $this->_socket, 0 );
            
            $this->on('connected');
            
            $this->_connected = TRUE;
            
            return TRUE;
        }
        
        public function close() {
            if ( $this->_socket ) {
                @fclose( $this->_socket );
                $this->_socket = FALSE;
                $this->_connected = FALSE;
                $this->on( 'disconnect' );
            }
        }
        
        private function getHeaders() {
            
            $out = [
                
                "GET ws://" . $this->_host . ":" . $this->_port . $this->_path . ' HTTP/1.1',
                "Pragma: no-cache",
                "Origin: http://" . $this->_host . ":" . $this->_port,
                "Host: " . $this->_host . ":" . $this->_port,
                "Sec-WebSocket-Key: " . $this->_key,
                "User-Agent: PHP-WebSocketClient",
                "Upgrade: websocket",
                "Cache-Control: no-cache",
                "Sec-WebSocket-Protocol: " . implode( ', ', $this->_services ),
                "Connection: Upgrade",
                "Sec-WebSocket-Version: 13"
            ];
            
            return implode( "\r\n", $out ) . "\r\n\r\n";
        }
        
        private function generateRandomString($length = 10, $addSpaces = true, $addNumbers = true) {
            $characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!"§$%&/()=[]{}';
            $useChars = array();
            // select some random chars:    
            for($i = 0; $i < $length; $i++) {
                $useChars[] = $characters[mt_rand(0, strlen($characters)-1)];
            }
            // add spaces and numbers:
            if($addSpaces === true) {
                array_push($useChars, ' ', ' ', ' ', ' ', ' ', ' ');
            }
            if($addNumbers === true) {
                array_push($useChars, rand(0,9), rand(0,9), rand(0,9));
            }
            shuffle($useChars);
            $randomString = trim(implode('', $useChars));
            $randomString = substr($randomString, 0, $length);
            return $randomString;
        }

        private function checkHandshake( $initialResponse ) {
        
            // echo json_encode( $initialResponse );
        
            if ( preg_match('#Sec-WebSocket-Accept:\s(.*)$#mU', $initialResponse, $matches) ) {
        
                $keyAccept = trim($matches[1]);
                
                $expectedResponse = base64_encode(pack('H*', sha1($this->_key . '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')));
                
                if ( $expectedResponse == $keyAccept )
                    return TRUE;
                else
                    throw new Exception("WebSocket: The handshake response returned an invalid handshake key: $keyAccept but expected $expectedResponse" );

            } else throw new Exception( "WebSocket: The handshake response did not contained a valid Sec-WebSocket-Accept header!" );
        }
        
        public function send( $string ) {
            
            if ( !$this->_connected ) {
                $this->on( 'error', "Cannot send data while not connected!" );
                return FALSE;
            }
            
            if ( empty( $string ) )
                return FALSE;
            
            $this->_bufferOut .= $this->encodeFrame( $string, 'text', TRUE );
            
            $this->loop();
        }

        public function bind( $eventName, $callback ) {
            
            if ( isset( $this->_events[ $eventName ] ) )
                $this->_events[ $eventName ][] = $callback;
            else
                $this->_events[ $eventName] = [ $callback ];
        }
        
        public function on( $eventName, $eventData = NULL ) {
            if ( isset( $this->_events[ $eventName ] ) )
                foreach ( $this->_events[ $eventName ] as $callback ) {
                    if ( $callback( $eventData ) === FALSE )
                        return FALSE;
                }
            return TRUE;
        }
        
        public function __destruct() {
            $this->close();
        }
        
        private function encodeFrame ($payload, $type = 'text', $masked = true) {
            $frameHead = array();
            $frame = '';
            $payloadLength = strlen($payload);
        
            switch($type) {
                case 'text':
                    // first byte indicates FIN, Text-Frame (10000001):
                    $frameHead[0] = 129;
                    break;
        
                case 'close':
                    // first byte indicates FIN, Close Frame(10001000):
                    $frameHead[0] = 136;
                    break;
        
                case 'ping':
                    // first byte indicates FIN, Ping frame (10001001):
                    $frameHead[0] = 137;
                    break;
        
                case 'pong':
                    // first byte indicates FIN, Pong frame (10001010):
                    $frameHead[0] = 138;
                    break;
            }
        
            // set mask and payload length (using 1, 3 or 9 bytes) 
            if( $payloadLength > 65535 ) {
                $payloadLengthBin = str_split( sprintf( '%064b', $payloadLength ), 8);
                $frameHead[1] = ( $masked === true ) ? 255 : 127;
                for( $i = 0; $i < 8; $i++ ) {
                    $frameHead[$i+2] = bindec( $payloadLengthBin[$i] );
                }
                // most significant bit MUST be 0 (close connection if frame too big)
                if( $frameHead[2] > 127 ) {
                    $this->on( 'error', "Frame too big!" );
                    return FALSE;
                }
            } elseif ( $payloadLength > 125 ) {
                $payloadLengthBin = str_split( sprintf( '%016b', $payloadLength ), 8 );
                $frameHead[1] = ( $masked === true ) ? 254 : 126;
                $frameHead[2] = bindec( $payloadLengthBin[0] );
                $frameHead[3] = bindec( $payloadLengthBin[1] );
            } else {
                $frameHead[1] = ($masked === true) ? $payloadLength + 128 : $payloadLength;
            }

            // convert frame-head to string:
            foreach( array_keys( $frameHead ) as $i ) {
                $frameHead[ $i ] = chr( $frameHead[$i] );
            }
        
            if($masked === true) {
                // generate a random mask:
                $mask = array();
                for($i = 0; $i < 4; $i++) {
                    $mask[$i] = chr( rand( 0, 255 ) );
                }
            
                $frameHead = array_merge( $frameHead, $mask );
            }
        
            $frame = implode('', $frameHead);

            // append payload to frame:
            $framePayload = array();
            
            for($i = 0; $i < $payloadLength; $i++) {
                $frame .= ($masked === true) ? $payload[$i] ^ $mask[$i % 4] : $payload[$i];
            }

            return $frame;
        }

        private function decodeFrame( $data ) {
            $payloadLength = '';
            $mask = '';
            $unmaskedPayload = '';
            $decodedData = array();
        
            // estimate frame type:
            $firstByteBinary = sprintf('%08b', ord($data[0]));
            $secondByteBinary = sprintf('%08b', ord($data[1]));
            $opcode = bindec(substr($firstByteBinary, 4, 4));
            $isMasked = ($secondByteBinary[0] == '1') ? TRUE : FALSE;
            $payloadLength = ord($data[1]) & 127;
            
            $_dataLength = $payloadLength;
            
            switch( $opcode ) {
                // text frame:
                case 1:
                    $decodedData['type'] = 'text';
                    // echo "CODE: text frame\n";
                    break;
        
                case 2:
                    $decodedData['type'] = 'binary';
                    //echo "CODE: binary frame\n";
                    break;
            
                // connection close frame:
                case 8:
                    $decodedData['type'] = 'close';
                    break;
            
                // ping frame:
                case 9:
                    $decodedData['type'] = 'ping';                
                    break;
            
                // pong frame:
                case 10:
                    $decodedData['type'] = 'pong';
                    break;
            
                default:
                    return FALSE;
                    break;
            }
        
            if( $payloadLength === 126 ) {
                $mask = substr($data, 4, 4);
                $payloadOffset = 8;
                $dataLength = bindec(sprintf('%08b', ord($data[2])) . sprintf('%08b', ord($data[3]))) + $payloadOffset;
            } elseif( $payloadLength === 127 ) {
                $mask = substr($data, 10, 4);
                $payloadOffset = 14;
                $tmp = '';
                for( $i = 0; $i < 8; $i++ ) {
                    $tmp .= sprintf('%08b', ord($data[$i+2]));
                }
                $dataLength = bindec($tmp) + $payloadOffset;
                unset($tmp);
            } else {
                $mask = substr($data, 2, 4);
                $payloadOffset = 6;
                $dataLength = $payloadLength + $payloadOffset;
            }
        
            if( $isMasked === TRUE ) {
                for($i = $payloadOffset; $i < $dataLength; $i++) {
                    $j = $i - $payloadOffset;
                    if( isset($data[$i]) ) {
                        $unmaskedPayload .= $data[$i] ^ $mask[$j % 4];
                    }
                }
            
                $decodedData['payload'] = $unmaskedPayload;
            } else {
                $payloadOffset = $payloadOffset - 4;
                $decodedData['payload'] = substr($data, $payloadOffset);
            }
            
            $decodedData[ 'payloadLength' ] = $_dataLength;
        
            return $decodedData;
        }

    }
    
    /*
    $ws = new WebSocketClient( 'ws://localhost:8080/api/', [ 'api' ] );
    
    $ws->bind( 'connected', function() {
        echo "Connected\n";
    });
    
    $ws->bind( 'connectionError', function( $reason ) {
        echo "Connection Error: " . ( $reason ? $reason : "Unknown reason" ) . "\n";
    });
    
    $ws->bind( 'disconnect', function() {
        echo "Disconnected\n";
    } );
    
    $ws->bind( 'error', function( $reason ) {
        echo "Connection error: " . ( $reason ? $reason : "Unknown reason" ) . "\n";
    } );
    
    $ws->bind( 'message', function( $str ) {
        
        echo "Message: " . json_encode( $str ) . "\n";
        
    } );
    
    if ( $ws->connect() ) {
        
        $ws->send( "Hello" );

        for ( $i = 0; $i<100; $i++ ) {
            $ws->loop();
        }

    }
    
    */
?>