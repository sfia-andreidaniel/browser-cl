var controller = new ( require( __dirname + "/lib/filecontroller.js" ).ApiFileController )();

controller.handleFile( './file.png' );