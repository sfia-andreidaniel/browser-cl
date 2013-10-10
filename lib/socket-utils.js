var ip2long = function (IP) {
  var i = 0;
  IP = IP.match(/^([1-9]\d*|0[0-7]*|0x[\da-f]+)(?:\.([1-9]\d*|0[0-7]*|0x[\da-f]+))?(?:\.([1-9]\d*|0[0-7]*|0x[\da-f]+))?(?:\.([1-9]\d*|0[0-7]*|0x[\da-f]+))?$/i); // Verify IP format.
  if (!IP)
    return false; // Invalid format.

  // Reuse IP variable for component counter.
  IP[0] = 0;
  for (i = 1; i < 5; i += 1) {
    IP[0] += !! ((IP[i] || '').length);
    IP[i] = parseInt(IP[i]) || 0;
  }
  IP.push(256, 256, 256, 256);
  IP[4 + IP[0]] *= Math.pow(256, 4 - IP[0]);
  if (IP[1] >= IP[5] || IP[2] >= IP[6] || IP[3] >= IP[7] || IP[4] >= IP[8])
    return false;
  return IP[1] * (IP[0] === 1 || 16777216) + IP[2] * (IP[0] <= 2 || 65536) + IP[3] * (IP[0] <= 3 || 256) + IP[4] * 1;
}

exports.ip2long = ip2long;

exports.hostAllowed = function( conf, socket ) {
    var allowedClasses = conf.allowFrom || [];
    
    var clientIP = ip2long( socket.remoteAddress );
    var matches, classBoundStart, classBoundStop, classScope, classStart;
    
    for ( var i=0,len=allowedClasses.length; i<len; i++ ) {
        
        if ( matches = /^(([1-9]\d*|0[0-7]*|0x[\da-f]+)(?:\.([1-9]\d*|0[0-7]*|0x[\da-f]+))?(?:\.([1-9]\d*|0[0-7]*|0x[\da-f]+))?(?:\.([1-9]\d*|0[0-7]*|0x[\da-f]+))?)(\/([\d]+))?$/i
            .exec( allowedClasses[i] )
        ) {
            classScope = parseInt( matches[7] ) || 32;
            classStart = ip2long( matches[1] );
            classBoundStart = classStart;
            classBoundStop  = Math.pow(2, 32 - classScope ) + classStart + 1;

            if ( clientIP >= classBoundStart &&
                 clientIP <= classBoundStop
            ) return true;
        }
    }
    
    return false;
}