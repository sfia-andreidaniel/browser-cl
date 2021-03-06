var workers      = 0,
    port         = 0;
    modules      = [];
    docroot      = null;
    https        = null;
    listen       = '0.0.0.0';
    memory_limit = -1,
    
    integer      = require( __dirname + '/math.js' ).integer,
    strtob       = require( __dirname + '/osutils.js' ).strtob
    ;

var customArgs = {};

var tmp = null;

for ( var i=2,len=process.argv.length; i<len; i++ ) {
    switch ( process.argv[i] ) {
        case '-workers':
            if (!workers && process.argv[i+1]) {
                workers = parseInt( process.argv[i+1] );
                i++;
            }
            break;
        case '-port':
            if (!port && process.argv[i+1]) {
                port = parseInt( process.argv[i+1] );
                i++;
            }
            break;
        case '-module':
            if ( process.argv[i+1] ) {
                modules.push( process.argv[i+1] );
                i++;
            }
            break;
        case '-docroot':
            if ( process.argv[i+1] && docroot === null ) {
                docroot = process.argv[i+1];
                i++;
            }
            break;
        
        case '-secure':
            https = true;
            break;
        
        case '-listen':
            if ( process.argv[i+1] && listen === '0.0.0.0' ) {
                listen = process.argv[i+1];
                i++
            }
            break;
        
        case '-memory-limit':
        
            if ( process.argv[i+1] && memory_limit == -1 ) {
                memory_limit = strtob( process.argv[i+1], true );
                i++;
            };
            
            break;
        
        default:
        
            if ( tmp = /^\-([a-z_]([a-z\d_\-]+)?)$/i.exec( process.argv[i] ) ) {
                if ( typeof process.argv[i+1] != 'undefined' && [ 'workers', 'port', 'module', 'docroot', 'listen' ].indexOf( tmp[1] ) == -1 ) {
                    customArgs[ tmp[1].replace(/\-/g, '_') ] = process.argv[ i + 1 ];
                    i++;
                }
            }
            
            break;
    }
}

exports.workers = workers || 1;
exports.port = port || 0;
exports.modules = modules;
exports.docroot = docroot;
exports.customArgs = customArgs;
exports.https = https;
exports.listen = listen;
exports.memory_limit = memory_limit;