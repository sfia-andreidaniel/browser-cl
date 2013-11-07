var integer = require( __dirname + "/math.js" ).integer;

try {
    
    var fs = require( 'fs' ),
        list = JSON.parse( fs.readFileSync( __dirname + '/../conf/tasks-priorities.json' ) );
    
    if ( !list instanceof Object )
        throw "Parsed file contents conf/tasks-priorities.json could not be parsed as object!";
    
} catch ( error ) {
    list = null;
    throw "Failed to initialize tasks priorities: " + error;
}

var getTaskPriority = function( preset ) {
    return !list ? 10000
              : ( ( list.propertyIsEnumerable( preset ) && list.hasOwnProperty( preset ) )
                     ? integer( list[ preset ] )
                     : integer( list[ '*' ] )
               );
};

exports.getTaskPriority = getTaskPriority;