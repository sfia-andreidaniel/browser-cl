var Thing = require( __dirname + "/thing.js" ).Thing;

exports.ApiWorker = function( workerIP, workerPort, api ) {
    
    var me = new Thing();
    
    me.ip = workerIP;
    me.port = workerPort;
    me.api = api;
    
    console.log("Created new ApiWorker( ip=" + workerIP + ", port=" + workerPort +")" );
    
    return me;
}