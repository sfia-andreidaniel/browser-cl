window.StorageApi = ( function() {

var Thing = function() {
    
    var events      = {},
        intervals   = {},
        me          = this;
    
    /* Event listeners interface */
    
    me.bind = function (eventName, handlerFunction ) {
        events[ eventName ] = events[ eventName ] || [];
        events[ eventName ].push( handlerFunction );
    }
    
    me.blind = function( handlerFunction ) {
        events[ '*' ] = events[ '*' ] || [];
        events[ '*' ].push( handlerFunction );
    }
    
    me.on = function( eventName, eventData ) {
        if (events[ eventName ] instanceof Array ) {
            for ( var i=0, len = events[eventName].length; i<len; i++ ) {
                if ( events[ eventName ][i]( eventData ) === false ) {
                    return false;
                    break;
                }
            }
        }
        
        else
        
        if ( events[ '*' ] instanceof Array ) {
            for ( var i=0, len = events['*'].length; i<len; i++ ) {
                if ( events[ '*' ][i]( eventData ) === false ) {
                    return false;
                    break;
                }
            }
        }
        
        return true;
    }
    
    me.remove = function( eventName, handlerFunction ) {
        handlerFunction = handlerFunction || null;
        if ( events[ eventName ] instanceof Array ) {
            if ( !handlerFunction ) {
                delete events[ eventName ];
            } else {
                for ( var i=0, len=events[ eventName ].length; i<len; i++ ) {
                    if ( events[ eventName ][i] == handlerFunction ) {
                        events[eventName].splice( i, 1 );
                        return true;
                    }
                }
            }
        }
        return true;
    }
    
    me.interval = function( intervalName, intervalFunction, durationMs ) {
        
        if ( typeof intervals[ intervalName ] != 'undefined' )
            throw "Failed to register interval!";
        
        intervals[ intervalName ] = setInterval( intervalFunction, durationMs ).unref();
    }
    
    return me;
}

var TasksGroup = function( init ) {
    
    Object.defineProperty( init, "allAre", {
        "get": function( ) {
            
            return function( propertyName, isPropertyValue ) {
            
                // console.log( "All are begin!: ", init.length );
            
                var value;
                
                for ( var i = 0, len = init.length; i<len; i++ ) {
                    value = init[i][ propertyName ];
                    
                    // console.log( "All are value: ", i, ": ", value, " cmpWith: ", isPropertyValue );
                    
                    if ( value != isPropertyValue )
                        return false;
                }
            
                // console.log( "All are: ", isPropertyValue );
            
                return true;
            };
        }
    } );
    
    Object.defineProperty( init, "first", {
        
        "get": function( ) {
            return init.length 
                ? init[0] 
                : null;
        }
        
    } );
    
    Object.defineProperty( init, "last", {
        
        "get": function() {
            
            return init.length > 0 
                ? init[ init.length - 1 ] 
                : null;

        }
        
    } );
    
    return init;
}

var Task = function( async, index, callback, success, error, taskOwner ) {
    
    var me = new Thing();
    
    me.async = !!async;

    me.complete = false;
    me.started  = false;
    me.error    = null;
    me.success  = null;
    me.prev     = null;
    me.next     = null;
    me.syncRes  = undefined;
    
    me.index    = index;
    
    Object.defineProperty( me, "siblingTasks", {
        
        "get": function() {
            
            if ( !me.async )
                return [];
            else {
                
                var out = [],
                    cursorNext = me.next,
                    cursorPrev = me.prev;
                
                while ( cursorPrev && cursorPrev.async == me.async ) {
                    out.push( cursorPrev );
                    cursorPrev = cursorPrev.prev;
                }
                
                while ( cursorNext && cursorNext.async == me.async ) {
                    out.push( cursorNext );
                    cursorNext = cursorNext.next
                }
                
                return new TasksGroup( out );
                
            }
        },
        "set": function() {
            throw "siblingTasks of a task are read-only!";
        }

    } );
    
    me.bind( 'complete', function() {
        
        if ( me.complete || me.success || me.error || !me.started ) {
            //console.log( "Task.cancel(complete):" + index + ", started=", me.started, "error=", me.error, "success=", me.success, "complete=",me.complete );
            return;
        }
        
        me.complete = true;
        
        // console.log( "Task: " + index + ".on('complete')" );
        
        // If the task encountered an error, we don't complete
        // the last sibling next task start, but we rather
        // announce the task owner of the failure
        
        if ( me.error ) {
            
            taskOwner.on( 'error', me.error );
            
            return;
        }
        
        var myGroup = me.siblingTasks,
            allComplete = true;
            
        for ( var i=0, len=myGroup.length; i<len; i++ ) {
                
            if ( !myGroup[i].complete ) {
                return;
            }
        }
        
        // If all my sibling tasks are complete, and myGroup.last has a next task,
        // and that task is not started we start that task
        
        if ( ( myGroup && 
               myGroup.allAre && 
               myGroup.allAre('complete', true ) && 
               myGroup && myGroup.last
                ? (
                   myGroup.last &&
                   myGroup.last.next && 
                   !myGroup.last.next.started
                )
                : (
                  me.next &&
                  !me.next.started
                )
            )
        )
            setTimeout( function() {
                myGroup && myGroup.last
                    ? myGroup.last.next.on( 'start' )
                    : me.next.on( 'start' );
                
            }, 10 );

        else

            if ( me.next && !me.async )
                me.next.on( 'start' );
        
    } );
    
    me.bind( 'start', function() {
        
        if ( me.started || me.error || me.success ) {
            
            //console.log( "Task.cancel(start):" + index + ", ", me.started, me.error, me.success );
            
            return;
        }
        
        me.started = true;
        
        // console.log( "Task: " + me.index + ".on( 'start') " + ( me.async ? ": async" : ": sync" ) );
        
        if ( !me.async ) {
            
            try {
                
                // console.log( "BEFORE SUCCES!" );
                
                try {
                    if ( !taskOwner.ignoreFurtherCommands )
                        var result = callback.call( me );
                    else
                        throw "Task Owner is ignoring further commands";
                
                } catch ( f ) {
                
                    // console.log( "Callback error: " + f );
                    
                    throw f;
                
                }
                
                // console.log( "SUCCESS!" );
                
                // me.on( 'success', result || true );
                
            } catch ( e ) {
                
                // console.log( "SUCCESS ERROR: " + e )
                
                me.on( 'error', e + '' );
                
            }
            
        } else {
            
            try {
                
                if ( !taskOwner.ignoreFurtherCommands )
                    callback.call( me );
                else
                    throw "TaskOwker is ignoring further commands";
                
                if ( !me.error ) {
                
                    // start the next async sibling task
                    
                    // console.log( "Call next!" );
                    
                    if ( me.next && me.next.async == me.async )
                        me.next.on( 'start' );
                    
                }
                
            } catch ( e ) {
                
                me.on( 'error', e + '' );
                
            }
            
        }
        
    } );
    
    me.bind( 'success', function( result ) {
        
        if ( !me.complete )
            me.on( 'complete' );
        
        if ( me.error || me.success ) {
            // console.log( "Task.cancel(success):" + index + ", ", me.error, me.success );
            return;
        }
        
        // console.log( "Task: " + index + ".on('success')" );

        me.success = result || true;
        
        taskOwner.on( 'complete' );

        if ( success ) {
            
            try {
                
                if ( !taskOwner.ignoreFurtherCommands )
                    success.call( me, result || true );
                else
                    throw "TaskOwner is ignoring further commands";
                
            } catch ( e ) {
                
                me.on( 'error', e + '' );
                
                return;
            }
            
        }
        
    } );
    
    me.bind( 'error', function( reason ) {
        
        me.error = reason || "Unknown error";
        
        if ( !me.complete )
            me.on( 'complete' );
        
        
        if ( me.success ) {
            // console.log( "Task.cancel(error):" + index + ", ", me.error, me.success );
            return;
        }
        
        // console.log( "Task: " + index + ".on('error')" );
        
        if ( error ) {
            
            try {
                if ( !taskOwner.ignoreFurtherCommands )
                    error.call( me, reason || null );
                else
                    throw "Task owner is ignoring further commands";
            } catch ( e ) {}
            
        }
        
        taskOwner.on( 'error', reason || 'unknown error' );
        
    } );
    
    me.bind( 'reset', function() {
        
        me.error = false;
        me.success = false;
        me.complete = false;
        me.started = false;
        me.prev = null;
        me.next = null;
        
    } );
    
    return me;
}

var Async = function( ) {
    var me = new Thing(),

        events = {},

        length = 0,
        
        error      = false,
        complete   = false,
        success    = false,
        
        callbackSuccess  = false,
        callbackError    = false,
        callbackComplete = false;
    
    Object.defineProperty( me, "ignoreFurtherCommands", {
        "get": function( ) {
            return complete || error || success;
        }
    } );
    
    me.sync = function( callback, success, error ) {
        
        events [ length ] = new Task( false, length, callback, success, error, me );
        
        length++;
        
        return me;
        
    };
    
    me.async = function( callback, success, error ) {
        
        events[ length ] = new Task( true, length, callback, success, error, me );
        
        length++;
        
        return me;
        
    };
    
    me.bind( 'complete', function() {
        
        // The complete
        
        if ( error || success || complete )
            return; // If any of the finally events occured, we abort.
        
        // Test if all the tasks are completed.
        // If not all of the tasks are completed, abort
        
        for ( var i = 0; i<length; i++ ) {
            if ( !events[i].complete )
                return;
        }
        
        complete = true;
        
        if ( callbackComplete ) {
            
            try {
            
                callbackComplete();
            
            } catch ( e ) {
                
                me.on( 'error', e + '' );
                
                return;
            }
        }
        
        if ( !me.error )
            me.on( 'success' );
        else
            me.on( 'error' );
        
    } );
    
    me.bind( 'error', function( reason ) {
        
        if ( error || success )
            return;
        
        error = true;
        
        if ( callbackError ) {
            callbackError.call( me, reason || 'unknown error' );
        }
        
    } );
    
    me.bind( 'success', function( data ) {
        
        if ( error || success )
            return;
        
        if ( callbackSuccess ) {
            try { 
                callbackSuccess.call( data || true );
            } catch ( e ) {
                me.on( 'error' );
                return;
            }
        }
        
        success = true;

    } );
    
    me.run = function( success, error, complete ) {

        callbackSuccess = success || false;
        callbackError   = error   || false;
        callbackComplete= complete|| false;
        
        success  = false;
        error    = false;
        complete = false;
        
        for ( var i=0; i<length; i++ ) {
            
            events[i].on( 'reset' );
            
        }
        
        for ( var i=1; i<length; i++ ) {
            
            events[i - 1].next = events[i];
            events[i].prev = events[i - 1];
            
        }
        
        if ( length ) {
            
            events[0].on('start');
            
        } else {
            
            me.on( 'success' );
            
        }
        
        return me;
    }
    
    return me;
};

function StorageApi( apiHostNameAndPort ) {
    
    var _apiPort = 8080,
        _apiHost = null,
        _events  = {},
        _priv    = {},
        api      = this;
    
    this.bind = function( eventName, eventHandler ) {
        _events[ eventName ] = _events[ eventName ] || [];
        _events[ eventName ].push( eventHandler );
    };
    
    this.on = function( eventName, eventData ) {

        if ( !_events[ eventName ] )
            return true;
        
        for ( var i=0, len = _events[ eventName ].length; i<len; i++ ) {
            if ( _events[ eventName ][i]( eventData ) === false )
                return false;
        }
        
        return true;
    };
    
    _priv.testFrame = function( frameData ) {
        if ( frameData && typeof frameData.ok != 'undefined' && frameData.ok === false ) {
            throw ( frameData.reason && frameData.error ) ? frameData.reason : "unknown api error";
        }
        return frameData;
    }
    
    this.storeFile = function( HTML5File, options, callback ) {
        
        callback = callback || function( err, data ) {
            
            console.log( "callback: ", err, data );
            
            if ( err ) {
                api.on( 'error', err );
            } else {
                api.on( 'complete', data );
            }
            
        }
        
        var eventer = new Thing(),
            tasker  = new Async(),
            filePacket = null,
            numRead = 0,
            lastPercent = 0,
            successPacket = null,
            fileName = HTML5File.name,
            connection = null,
            maxBufferSize = 64000,
            readNext = 0,
            fileSize = HTML5File.size,
            connection = null,
            reader = null,
            byteStart = 0,
            byteStop = 0,
            lastReadLength = 0;
        
        eventer.bind( 'error', function( reason ) {
            tasker.currentTask.on( 'error', reason );
        } );
        
        eventer.bind( 'stat-file', function() {
            
            api.on( 'status', 'checking file...' );
            
            if ( !HTML5File.size ) {
                eventer.on( 'error', "Cannot upload zero-bytes files" );
            }
            
            filePacket = {
                "name": fileName,
                "size": HTML5File.size
            };
            
            if ( options )
                filePacket.options = options;
            
            api.on( 'status', 'Api send packet: ' + JSON.stringify( filePacket ) );
            
            tasker.currentTask.on( 'success' );
            
        } );
        
        eventer.bind( 'transfer-file', function() {
            
            // api.on( 'status', 'opening connection to the server...' );
            
            connection = new WebSocket( 'ws://' + _apiHost + ':' + _apiPort + '/api/', [ 'api' ] );
        
            connection.onopen = function() {

                api.on( 'status', 'connected to api' );
                
                // api.on( 'status', 'sent file packet!' );
                connection.send( JSON.stringify( filePacket ) );

            };
        
            connection.onmessage = function(evt) {
                
                // api.on( 'status', 'frame: ' + evt.data );
                
                try {
                    
                    var frame = JSON.parse( evt.data );
                    
                    eventer.on( 'frame', frame );
                    
                } catch ( error ) {
                    
                    eventer.on( 'error', "Failed to process frame: " + error );
                    
                }
            };
            
            connection.onclose = function() {
                api.on( 'status', 'connection to api has been closed' );
            };
            
            connection.onerror = function( error ) {
                eventer.on( 'error', "connection error: " + error );
            };
        } );
        
        reader = new FileReader();
        
        reader.onloadend = function( evt ) {
            if ( evt.target.readyState == FileReader.DONE ) {
            
                //console.log('status', "Sending: " + evt.target.result.byteLength + " bytes of type " + ( typeof evt.target.result ) );
                connection.send( evt.target.result );
                numRead += ( lastReadLength = evt.target.result.byteLength );
            }
        };
                
        var fread = function() {
            if ( numRead < fileSize - 1 ) {
                
                byteStart = numRead;
                byteStop  = byteStart + maxBufferSize;
                
                if ( byteStop >= fileSize )
                    byteStop = fileSize;
                
                // console.log( 'status', "Reading: " + ( byteStop - byteStart ) + " bytes (" + byteStart + " .. " + byteStop + ")" );
                
                reader.readAsArrayBuffer( HTML5File.slice( byteStart, byteStop ) );
                
            }
        };
        
        eventer.bind( 'frame', function( frameData ) {
            
            frameData = frameData || {};
            
            if ( frameData.error ) {
                eventer.on( 'error', frameData.reason || 'unknown reason' );
                return;
            }
            
            //api.on( 'status', 'tasker.currentPhase is in: ' + tasker.currentPhase );
            
            switch ( tasker.currentPhase ) {
                
                case 'transfer-file':
                
                    if ( frameData.ack && frameData.phase == 'transfer' ) {
                        
                        if ( numRead == 0 )
                            api.on( 'status', 'starting to transfer file' );
                        
                        if ( byteStop >= 0 && byteStop < fileSize )
                            fread();
                        
                        if ( frameData.got && frameData.got != lastReadLength )
                            eventer.on( 'error', "Transfer error. Server acked " + frameData.got + ", expected " + lastReadLength );
                        else {
                            var prog = Math.floor( numRead / ( fileSize / 100 ) );
                            if ( prog != lastPercent ) {
                                lastPercent = prog;
                                api.on( 'progress', prog );
                            }
                        }

                    } else {
                        
                        // we're having a success frame?
                        
                        if ( frameData.name && frameData.size ) {
                            if ( frameData.size != fileSize ) {
                                eventer.on( 'error', "Api file transfer size mismatch. Api got: " + frameData.size + ", expected: " + fileSize );
                            } else {
                                successPacket = frameData;
                                tasker.currentTask.on( 'success', frameData );
                            }
                        }
                    }
                
                    break;
                
                default:
                    eventer.on( 'error', 'unknown frame logic' );
                    break;
                
            }
            
        } );
        
        tasker.sync( function() {
            
            ( function( task ) {
                
                tasker.currentTask = task;

                eventer.on( tasker.currentPhase = 'stat-file' );
                
            } )( this );
            
        } );
        
        tasker.sync( function() {
            
            ( function( task ) {
                
                tasker.currentTask = task;
                
                eventer.on( tasker.currentPhase = 'transfer-file' );
                
            } )( this );
            
        } );
        
        tasker.run( function() {
            
            api.on( 'status', "file transfer completed successfully" );
            
            callback(false, successPacket );
            
        }, function( reason ){
            
            api.on( 'error', "file transfer failed: " + reason );
            
            callback( reason || 'unknown error' );
            
        }, function() {
            
            if ( connection ) {
                
                try {
                    connection.close();
                } catch ( e ) {
                    api.on( 'error', 'failed to close connection: ' + e );
                }
                
            }
            
            api.on( 'status', 'all pending operations completed' );
            
        } );
        
        this.on( "status", "Using javascript driver..." );
        
        
    }
    
    this.__construct = function( apiHostNameAndPort ) {
    
        var matches;
        
        apiHostNameAndPort = apiHostNameAndPort || '';
        
        if ( !( matches = /^([\S]+)\:([\d]+)$/.exec( apiHostNameAndPort ) ) ) {
            _apiHost = apiHostNameAndPort;
        } else {
            _apiHost = matches[1];
            _apiPort = ~~matches[2];
            
            if ( _apiPort < 1 || _apiPort > 65534 )
                throw "Invalid api port (" + _apiPort + ")";
        }
    };
    
    this.__construct( apiHostNameAndPort );
    
    return this;
}

return StorageApi;

})();