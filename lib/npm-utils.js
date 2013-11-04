var Async = require( __dirname + '/async.js' ).Async,
    fs    = require( 'fs' ),
    spawn = require( 'child_process' ).spawn,
    which = require( __dirname + '/osutils.js' ).which;

function module_exists( moduleName, callback ) {
    
    fs.exists( __dirname + '/../node_modules/' + moduleName + '/package.json', function( exists ) {
        
        callback( exists ? false : "Package " + moduleName + " is not installed" );
        
    } );
    
}

function install_module( moduleName, callback ) {
    
    module_exists( moduleName, function( err ) {
        
        if ( !err ) {
            callback( false );
            return;
        }
        
        var tasker = new Async(),
            npmpath = null,
            proc;
        
        // check for "npm"
        tasker.sync( function() {
            
            ( function( task ) {
                
                which( 'npm', function( err, path ) {
                    
                    if ( err )
                        task.on( 'error', 'npm not found!' );
                    else {
                        npmpath = path;
                        task.on( 'success' );
                    }
                    
                } );
                
            })( this );
            
        } );
        
        tasker.sync( function() {
            
            ( function( task ) {
                
                console.log( "* installing node module: " + moduleName );
                
                proc = spawn( npmpath, [ 'install', moduleName ], {
                    "cwd": __dirname + "/../"
                } );
            
                proc.on( 'close', function( ) {
                    
                    task.on( 'success' );
                
                } );
            
            })( this );
        
        });
        
        tasker.sync( function() {
            
            ( function( task ) {
            
                module_exists( moduleName, function( err ) {
                    
                    if ( err )
                        task.on( 'error', "Failed to install module: " + moduleName );
                    else {
                        task.on( 'success' );
                    }
                    
                } );
            
            })( this );
        });
        
        tasker.run( function() {
            callback( false );
        },
        function( reason ) {
            callback( reason || "Failed to install module " + moduleName + " because of an unknown reason" );
        });
        
    } );
    
}

function require_modules( modules_list, callback ) {
    
    modules_list = modules_list || [];
    
    if ( !modules_list.length ) {
        callback( false );
        return;
    }
    
    var tasker = new Async();
    
    for ( var i=0, len=modules_list.length; i<len; i++ ) {
        ( function( module_name ) {
            
            tasker.sync( function() {
                
                ( function (task) {
                
                    install_module( module_name, function( err ) {
                        
                        if ( err )
                            task.on( 'error', "failed to install nodejs module: " + module_name+ " : " + err );
                        else
                            task.on( 'success' );
                        
                    } );
                
                })( this );
            
            });
            
        })( modules_list[i] );
    }
    
    tasker.run( function() {
        callback( false );
    }, function( reason ) {
        callback( reason || "Failed to resolve dependencies " + modules_list.join( ', ' ) + " because of an unknown error" );
    });
}

exports.require_modules = require_modules;

exports.ensure_runtime = function( callback ) {
    
    var runtime = null;
    
    try {
        runtime = fs.readFileSync( __dirname + '/../conf/node.modules' ) + '';
    } catch ( err ) {
        callback( "Failed to interpret conf/node.modules: " + err );
        return;
    }
    
    var modules = runtime.split( "\n" ),
        modules_list = [],
        module;
    
    for ( var i=0, len=modules.length; i<len; i++ ) {
        module = modules[i].replace( /(^[\s]+|[\s]+$)/g, '' );
        if ( module )
            modules.push( module );
    }
    
    if ( !modules.length )
        callback( false );
    else
        require_modules( modules, callback );
}

/*
require_modules( [
        'mysql',
        'websocket'
    ], function( err ) {
        if ( err )
            console.log( err );
        else
            console.log( "All modules are installed!" );
    }
);
*/