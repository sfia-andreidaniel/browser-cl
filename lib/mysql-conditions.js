var is_int = function( val ) {
    return typeof val == 'number';
}

var is_object = function( val ) {
    return JSON.stringify( val ).indexOf( '{' ) == 0;
}

var is_string = function( val ) {
    return typeof val == 'string';
}

function mysql_real_escape_string (str) {
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) { // mc bug "
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
            case "\\":
            case "%":
                return "\\"+char; // prepends a backslash to backslash, percent,
                                  // and double/single quotes
        }
    });
};

var is_int_array = function( val ) {
    
    if ( !val || !val.length )
        return false;
    
    for ( var i = 0, len = val.length; i<len; i++ )
        if ( !is_int( val[i] ) )
            return false;
    
    return true;

}

var is_string_array = function( val ) {
    
    if ( !val || !val.length )
        return false;
    
    var out = [];
    
    for ( var i=0, len = val.length; i<len; i++ ) {
        
        if ( !is_string( val[i] ) )
            return false;
        else
            out.push( '"' + mysql_real_escape_string( val[i] ) + '"' );
        
    }
    
    return out;
}

function MySQLCondition( propertyName, propertyValue ) {
    
    var conditionType = null,
        dbField = null,
        matches,
        conditions = [],
        joiner = 'AND';
    
    if ( !( matches = /^(int|string)\:(.*)$/.exec( propertyName ) ) )
        throw "Bad MySQLCondition: " + propertyName;
    
    conditionType = matches[1];
    dbField = matches[2];
    
    this.toString = function() {
        
        switch ( conditions.length ) {
            case 0:
                return '';
                break;
            
            case 1:
                return conditions[0];
                break;
                
            default:
                return '( ' + conditions.join( ' ' + joiner + ' ' ) + ' )';
                break;
        }
    }
    
    switch ( conditionType ) {
        
        case 'int':
            
            if ( is_int( propertyValue ) ) {
                
                conditions.push( dbField + " = " + ~~propertyValue );
                
            } else {
                
                if ( !is_object( propertyValue ) )
                    throw "Object expected in condition field " + dbField;
                
                for ( var operand in propertyValue ) {
                    
                    if ( propertyValue.propertyIsEnumerable( operand ) && propertyValue.hasOwnProperty( operand ) ) {
                        
                        if ( [ '$lt', '$lte', '$gt', '$gte' ].indexOf( operand ) >= 0 &&
                             !is_int( propertyValue[ operand ] )
                        ) throw "Value should be of integer type in operand " + operand + " on property " + dbField;
                        
                        switch ( operand ) {
                            
                            case '$lt':
                                
                                conditions.push( dbField + " < " + ~~propertyValue[ operand ] );
                                break;
                            
                            case '$lte':
                                
                                conditions.push( dbField + " <= " + ~~propertyValue[ operand ] );
                                break;
                            
                            case '$in':
                                
                                if ( is_int_array( propertyValue[ operand ] ) )
                                    conditions.push( dbField + " IN ( " + propertyValue[ operand ].join( ", " ) + " )" );
                                else
                                    throw "Expected array of integer in condition field " + dbField + " clause $in!";
                                
                                break;
                            
                            case '$gt':
                                
                                conditions.push( dbField + " > " + ~~propertyValue[ operand ] );
                                break;
                            
                            case '$gte':
                                
                                conditions.push( dbField + " >= " + ~~propertyValue[ operand ] );
                                break;
                            
                            default:
                                
                                throw "Invalid operand: " + operand + " in field: " + dbField;
                                break;
                        }
                        
                    }
                    
                }
                
            }
            
            break;
        
        case 'string':
            
            if ( is_string( propertyValue ) ) {
                
                conditions.push( dbField + " = " + "'" + mysql_real_escape_string( propertyValue ) + "'" );
                
            } else {
                
                if ( !is_object( propertyValue ) )
                    throw "Object expected in condition field " + dbField;
                
                for ( var operand in propertyValue ) {
                    
                    if ( propertyValue.propertyIsEnumerable( operand ) && propertyValue.hasOwnProperty( operand ) ) {
                        
                        if ( [ "$like", "$lt", "$lte", "$gt", "$gte" ].indexOf( operand ) >= 0 &&
                             !is_string( propertyValue[ operand ] ) )
                            throw "Expected a string value in operand " + operand + " at field " + dbField;
                        
                        switch ( operand ) {
                            
                            case '$like':
                                conditions.push( dbField + " LIKE \"" + mysql_real_escape_string( propertyValue[operand] ).replace( /(^\\\%|\\\%$)/g, '%' ) + "\"" );
                                break;
                            
                            case '$lt':
                                conditions.push( dbField + " < \"" + mysql_real_escape_string( propertyValue[operand] ) + "\"" );
                                break;
                            
                            case '$lte':
                                conditions.push( dbField + " <= \"" + mysql_real_escape_string( propertyValue[ operand ] ) + "\"" );
                                break;
                            
                            case '$gt':
                                conditions.push( dbField + " > \"" + mysql_real_escape_string( propertyValue[ operand ] ) + "\"" );
                                break;
                            
                            case '$gte':
                                conditions.push( dbField + " >= \"" + mysql_real_escape_string( propertyValue[ operand ] ) + "\"" );
                                break;
                            
                            case '$in':
                                
                                var out = is_string_array( propertyValue[ operand ] );
                                
                                if ( !out )
                                    throw "Expected array of strings in operand $in on field " + dbField;
                                
                                conditions.push( dbField + " IN ( " + out.join( ", " ) + " )" );
                                
                                break;
                            
                            default:
                                throw "Unknown string operand: " + operand + " in field " + dbField;
                                break;
                        }
                        
                    }
                    
                }
                
            }
        
            break;
        
        default:
        
            throw "Bad data type: " + conditionType;
            break;
    }
    
    return this;
}

/*

var cond = new MySQLCondition( "string:foo.bar", { "$gte": "4", "$lte": "3", "$in": [ "3", "4", "5" ], "$like": "%first" } ),
    a    = cond + '';

console.log( a );

*/

exports.MySQLCondition = MySQLCondition;