// DAMN "~~" operator, it runs in overflows for numbers bigger than 32 bit integers

function integer( mixed ) {
    
    var v = parseInt( mixed );
    
    if ( isNaN( v ) || !isFinite( v ) )
        return 0;
    
    return Math.floor( v );
}

exports.integer = integer;