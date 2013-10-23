<?php

    class OSUtils {
        
        protected static $_paths = [];
        
        public static function initialize() {
            $path = getEnv( "PATH" );
            
            if ( $path !== FALSE )
                self::$_paths = preg_split( '/[\:\;]+/', $path );
            
            // Add to paths current directory
            self::$_paths[] = __DIR__;
        }
        
        public static function which( $binary ) {
            
            if ( preg_match( '/[\/\\\]+/', $binary ) )
                return @file_exists( $binary ) 
                    ? @realpath( $binary ) : FALSE;
            
            $binary = preg_split( '/[\/\\\]+/', $binary );
            
            $binary = end( $binary );
            
            $isUnix = self::is_unix();
            $isWin  = self::is_windows();
            
            foreach ( self::$_paths as $pathPart ) {
                
                if ( @file_exists( $cpath = ( $pathPart . DIRECTORY_SEPARATOR . $binary ) ) ) {
                    $cpath = @realpath( $cpath );
                    
                    if ( $isUnix ) {
                        if ( $cpath !== FALSE && @is_executable( $cpath ) )
                            return $cpath;
                    } else
                    if ( $isWin ) {
                        if ( $cpath !== FALSE && preg_match( '/\.exe/i', $binary ) )
                            return $cpath;
                    }
                }
                
                if ( $isWin && !preg_match('/\.exe\.exe$/i', "$binary.exe" ) && @file_exists( $cpath = ( $pathPart . DIRECTORY_SEPARATOR . $binary . ".exe" ) ) )
                    return @realpath( $cpath );
            
            }
            
            return FALSE;
        }
        
        public static function is_windows() {
            return DIRECTORY_SEPARATOR == '\\' && // '
                   PHP_SHLIB_SUFFIX == 'dll' &&
                   PATH_SEPARATOR == ';';
        }
        
        public static function is_unix() {
            return DIRECTORY_SEPARATOR == '/' &&
                    PHP_SHLIB_SUFFIX == 'so' &&
                    PATH_SEPARATOR == ':';
        }
    }
    
    OSUtils::initialize();
    
?>