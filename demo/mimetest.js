var mmm     = require( 'mmmagic' ),
    Magic   = mmm.Magic,
    fs      = require( 'fs' ),
    fd      = null,
    buffer  = new Buffer( 65535 ),
    numRead = 0,
    
    mime    = new Magic( mmm.MAGIC_MIME_TYPE );

// console.log( process.argv );

if ( process.argv.length < 3 )
    throw "Usage: mimetest.js <filename>";

fs.open( process.argv[2], 'r', function( err, fd ) {

    if ( err )
        throw "Error opening file: " + err;

    fs.read( fd, buffer, 0, 65535, null, function( err, read, buff ) {

        if ( err )
            throw "Error reading from file: " + err;

        numRead = read;

        buffer = buffer.slice( 0, numRead );

        console.log( 'readed ' + read + " bytes" );

        fs.closeSync( fd );

        mime.detect( buffer, function( err, result ) {

            if ( err )
                throw "Failed to detect: " + err;

            console.log( "Content-Type: ", result );

        } );

    } );

} );