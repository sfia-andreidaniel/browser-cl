// #!/usr/bin/node

require( __dirname + '/lib/npm-utils.js' ).ensure_runtime( function( err ) {
    
    if ( err ) {
        console.log( "Failed to ensure project runtime: " + err );
        process.exit( 1 );
        return;
    }

    /* Modules of the nitro client */
    var cluster               = require('cluster'),
        url                   = require('url'),
        fs                    = require('fs'),
        conf                  = require(__dirname + '/conf/nitro-client.js'),
        crypto                = require( 'crypto' ),
        urlutils              = require(__dirname + '/lib/urlutils.js'),
        sockutils             = require(__dirname + '/lib/socket-utils.js'),
        rewriteRules          = [],
        connectionUpgradeFunc = null,
        connectionUpgradeSymbiosis = null,
        controller            = null,
        listen                = require(__dirname + '/lib/argv-utils.js' ).listen,
        memoryLimitPerWorker  = require(__dirname + '/lib/argv-utils.js' ).memory_limit,
        btostr                = require(__dirname + '/lib/osutils.js' ).btostr,
        strtob                = require(__dirname + '/lib/osutils.js' ).strtob;

    /* Do rewrite expressions compiling */
    if ( conf.rewrite && conf.rewrite instanceof Object ) {
        for ( var key in conf.rewrite ) {
            if ( conf.rewrite.propertyIsEnumerable( key ) ) {
                try {
                    ( function( expr, rewrite ) {
                        var r = new RegExp( expr );
                        rewriteRules.push({
                            "expr" : r,
                            "url"  : rewrite
                        });
                    } )( key, conf.rewrite[ key ] );
                } catch (rewriteCompileException) {
                    console.log( "Could not compile rewrite condition '" + key + "'. Execution aborted!" );
                    return 1;
                }
            }
        }
    }

    if ( cluster.isMaster ) {

        if ( memoryLimitPerWorker >= 0 ) {
            
            console.log( "* Main: SERVER.memory_limit_per_cluster_node : ", btostr( memoryLimitPerWorker ) );
            
        }

        for ( var i=0; i<conf.workers; i++ )
            cluster.fork().on( 'disconnect', function() {
                console.log( "* Main: MASTER: A slave process was disconnected. Respawning another slave..." );
                cluster.fork();
            });

        cluster.on('exit', function( worker, code, signal ) {
            if ( worker.suicide === true ) {
                
                console.log("* Main: MASTER: slave process pid=" + worker.process.pid + " exited by it's will..." );
                cluster.fork();
                
            } else {
                if ( code != 0 ) {
                    console.log("* Main: MASTER: slave process " + worker.process.pid + " terminated with non-zero error code: " + code + ". Server will halt!" );
                    process.exit( 1 );
                } else cluster.fork();
            }
        });
        
        console.log( "* Main: HTTP" + (conf.https ? "S" : "" ) +".workers", conf.workers );
        // console.log( "HTTP" + (conf.https ? "S" : "" ) +".allowFom\n*", ( conf.allowFrom || [ 'none (port is still used though)' ] ).join( "\n* " ) );
        console.log( "* Main: HTTP" + (conf.https ? "S" : "" ) +".documentRoot", conf.documentRoot + "/" );
        console.log( "* Main: HTTP" + (conf.https ? "S" : "" ) +".port", conf.port );
        console.log( "* Main: HTTP" + (conf.https ? "S" : "" ) +".interface", listen );
        console.log( "* Main: URL.rewriteConditions", rewriteRules.length );

        if ( conf.modules && conf.modules.length ) {
            
            for ( var i=0,len=conf.modules.length; i<len; i++ ) {
                console.log("* Main: SERVER.module", conf.modules[i] );
                try {
                    
                    if ( fs.lstatSync( './modules/' + conf.modules[i] + '.js' ).isFile() ) {
                        ( function( modPath ) {
                            
                            var mod = require( modPath );
                            
                            if ( !mod.upgradeWebserver ) {
                            
                                if ( typeof mod.start == 'function' ) {
                                    
                                    console.log( "* Main: configuring module: ", conf.modules[i] );
                                    
                                    mod.start( conf );
                                    
                                }
                            }
                            
                        } )( __dirname + '/modules/' + conf.modules[i] + '.js' );
                    }
                    
                } catch (moduleException) {
                    console.log("Error loading module: " + conf.modules[i] + ": " + moduleException );
                }
            }
            
        }
        
        process.on( 'message', function( message ) {
            console.log( "Master: message: ", message );
        } );
    
    } else {
        
        // Report memory statistics to the master thread
        if ( memoryLimitPerWorker > 0 ) {
            
            setInterval( function() {
                var mem = process.memoryUsage();
                
                if ( mem.rss > memoryLimitPerWorker ) {
                    console.log( "* Main: Process #" + process.pid + " allocated more memory than it is allowed ( with " + btostr( memoryLimitPerWorker - mem.rss ) + " )." );
                    console.log( "        The process will now exit, and the master process will respawn another worker..." );
                    process.disconnect();
                } else {
                    
                    var free = parseFloat( ( ( memoryLimitPerWorker - mem.rss ) / ( 1024 * 1024 ) ).toFixed(2) );
                    
                    if ( free < 16 )
                        console.log( "* Main: WARNING: " + btostr( free ) + " ram free. The slave will restart soon!" );
                }
                
            }, 5000 ).unref();
        }
    
        if ( conf.modules && conf.modules.length ) {
            
            for ( var i=0,len=conf.modules.length; i<len; i++ ) {
    
                console.log("* Main: SERVER.upgrade module", conf.modules[i] );

                try {
                    
                    if ( fs.lstatSync( './modules/' + conf.modules[i] + '.js' ).isFile() ) {
                        ( function( modPath ) {
                        
                            var mod = require( modPath );
                        
                            if ( mod.upgradeWebserver ) {
                            
                                if ( typeof mod.upgrade == 'function' ) {
                                
                                    console.log( "* Main: configuring server upgrade module: ", conf.modules[i] );
                                
                                    if ( connectionUpgradeFunc !== null )
                                        throw "Loading module: Cannot use more than 1 server upgrade module!";
                                
                                    connectionUpgradeFunc = mod.upgrade;

                                    if ( mod.symbiosis ) {
                            
                                        console.log( "* Main: Module " + conf.modules[i] + " upgraded server in symbiosis mode" );
                                        connectionUpgradeSymbiosis = true;
                            
                                    }
                            
                                } else {
                                    throw "Loading module: Attempted to load a server upgrade module, but a .upgrade function is not defined in the module!";
                                }
                                
                            }
                            
                            if ( mod.controller ) {
                                if ( controller === null ) {
                                    controller = mod.controller;
                                } else
                                    throw "Cannot bind more than 1 controller!";
                            }
                            
                        } )( './modules/' + conf.modules[i] + '.js' );
                    }
                    
                } catch (moduleException) {
                    console.log("Error loading module: " + conf.modules[i] + ": " + moduleException );
                }
            }
            
        }

    






        var urlutils = require('./lib/urlutils.js');

        var server;

        var serverHandlerFunc = function( request, response ) {
            /* Test if the response is originating from a legitimate source */
        
            if ( connectionUpgradeFunc !== null && !connectionUpgradeSymbiosis ) {
                response.writeHead( 404 );
                response.end();
            }
        
            var urlinfo = url.parse( request.url, true ),
                urlpath = urlinfo.pathname;
        
            /* Execute rewrite conditions */
            var matches, rewritematches, replacewith;
            
            for ( var i=0,len=rewriteRules.length; i<len; i++ ) {
                if ( matches = rewriteRules[i].expr.exec( urlpath ) ) {
                    // console.log( "Rewrite match: ", urlpath, " against: ", rewriteRules[i].expr );
                    
                    urlpath = rewriteRules[i].url;
                    
                    while ( rewritematches = /\$\{([a-z\d]+)}/i.exec( urlpath ) ) {
                        
                        switch ( true ) {
                            case typeof matches[ rewritematches[1] ] != 'undefined':
                                replacewith = matches[ rewritematches[1] ];
                                break;
                            case rewritematches[1] == 'search':
                                replacewith = ( urlinfo.search || '' ).substr( 1 );
                                break;
                            default:
                                replacewith = 'undefined';
                                break;
                        }
                        
                        urlpath = urlpath.replace('${' + rewritematches[1] + '}', replacewith );
                    }
                    
                    request.url = urlpath;
                    urlinfo = url.parse( request.url, true );
                    urlpath = urlinfo.pathname;
                    break;
                }
            }
            
            if ( urlutils.ignoreList.indexOf( urlpath ) >= 0 ) {
                response.writeHeader("Content-Type: text/plain");
                response.writeHeader("404 Not found");
                response.write("Not found: " + urlpath );
                response.end();
                return;
            }
            
            /* Test if the urlpath ends in a '/' */
            switch (true) {
                
                case /\/$/.test( urlpath ):
                    // we're requesting a dir
                    try {
                        var stats = fs.lstatSync( conf.documentRoot + urlpath );
                        
                        if ( stats.isDirectory() ) {
                            /* Serve directory index */
                            
                            /* Test if an index.js file is present. If present, serve the index.js */
                            /* Otherwise, throw a forbidden! */
                            
                            try {
                                var statsIndex = fs.lstatSync( conf.documentRoot + urlpath + "index.js" );
                                if ( statsIndex.isFile() ) {
                                    try {
                                        var indexFile = require( conf.documentRoot + urlpath + "index.js" );
                                        if ( typeof indexFile.handle != 'function' ) {
                                            throw "Bad index module. It does not export a 'handle( response, request, get )' method!";
                                        } else {
                                            indexFile.handle( response, request, urlinfo.query || {}, controller );
                                                if ( !indexFile.async )
                                                response.end();
                                                return;
                                        }
                                    } catch (indexException) {
                                        response.responseError( response, 500, "Internal server error while serving folder index: " + indexException );
                                        response.end();
                                        return;
                                    }
                                } else {
                                    urlutils.responseError( response, 417, "the index is not a file!" );
                                    response.end();
                                    return;
                                }
                            } catch (statException) {
                                urlutils.responseError( response, 403, "Directory listing not allowed!\n" + statException );
                                response.end();
                                return;
                            }
                        } else {
                            urlutils.responseError( response, 400, "You attempted to make a bad request" );
                            response.end();
                            return;
                        }
                    } catch (e) {
                        urlutils.responseError( response, 404, "No such file or directory!" );
                        response.end();
                        return;
                    }
                    break;
                default:
                    // we're requesting a file
                    try {
                        try {
                            var statsFile = fs.lstatSync( conf.documentRoot + urlpath );
                        } catch (statError) {
                            urlutils.responseError( response, 404, "File not found: " + urlpath );
                            response.end();
                            return;
                        }
                        if ( !statsFile.isFile() )
                            throw "File: " + urlpath + " is not a file!";
                        if ( !/\.js$/i.test( urlpath ) ) {
                            // unsupported media type!
                            urlutils.responseError( response, 415, "The file you requested does exist, but is not supported by this webserver!" );
                            response.end();
                            return;
                        }
                        var serveFile = require( conf.documentRoot + urlpath );
                        if ( typeof serveFile.handle != 'function' )
                            throw "Bad server module. It does not export a 'handle( response, request, get )' method!";
                        serveFile.handle( response, request, urlinfo.query || {}, controller );
                        if ( !serveFile.async )
                            response.end();
                    } catch ( statFileException ) {
                        urlutils.responseError( response, 500, "Internal server error while serving file: " + urlpath + "\n" + statFileException );
                        response.end();
                        return;
                    }
                    return;
                    break;
            }
        }       

        if (!conf.https ) {
    
            console.log("* Main: Creating a HTTP server (port=" + conf.port +")");
    
            ( server = require('http').createServer(serverHandlerFunc) ).listen( conf.port, listen );
        
        } else {
        
            ( function() {      

                console.log("* Main: Creating a HTTPS server");
        
                var privateKey = fs.readFileSync('ssl/privatekey.pem').toString();
                var certificate = fs.readFileSync('ssl/certificate.pem').toString();    

                server = require('https').createServer( {key: privateKey, cert: certificate} ) ;
                server.addListener('request', serverHandlerFunc );
                server.listen( conf.port, listen );
            } )();
            
        }       
    
        /* Server firewall ... */
        server.on( 'connection', function( socket ) {
        
            if ( controller ) {
                // If we have a controller installed, we skip
                // the firewall logic and let the controller
                // to handle it
            } else {
        
                if ( !sockutils.hostAllowed( conf, socket ) ) {
                    // Break connection on unauthorized ip addresses !
                    socket.destroy();
                    console.log("Firewall.reject: ", socket.remoteAddress );
                }
            
            }   
    
        } );
        
        if ( connectionUpgradeFunc !== null ) {
            console.log("* Main: Upgrading server...");
            connectionUpgradeFunc( server );
        }
        
        if ( controller !== null )
            console.log("* Main: One of the module has a master request controller");
    }
});