var XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;

function urlencode(something) {
    return encodeURIComponent(something);
}

function uniqueUrl(url) {
    var time = new Date().getTime(),
        url  = (url.indexOf('?') !== -1) ? url + '&rndval='+time.toString() : url + '?rndval='+time.toString();
    //console.log( url );
    return url;
}

Array.prototype.addPOST = function(name, value) {
    if (name.length == 0) return;
    var data = encodeURIComponent(name).concat('=').concat(encodeURIComponent(value));
    this.push(data);
    return this;
};

function $_GET(url, callback ) {

    var targetURL = url;
    var callbackFunction = callback || null;
    var syncMode = !!!callbackFunction;

    var HTTP = new XMLHttpRequest();
    
    if (callbackFunction) {
        HTTP.onreadystatechange = function() {
            if (this.readyState == 4) {
                // console.log("HTTP: ", "get: ", url, HTTP.responseText );
                callbackFunction( /^200($|\n)/.test( HTTP.status + '' ) ? HTTP.responseText : null );
            }
        };
    }

     
    if (!syncMode) {
        HTTP.open('GET', uniqueUrl(targetURL), true);
        HTTP.send();
        return HTTP;
    } else {
        HTTP.open('GET', uniqueUrl(targetURL));
        HTTP.send();
        return /^200($|\n)/.test( HTTP.status + '' ) ? HTTP.responseText : null;
    }
}

function $_POST(url, params, callback) {
    var targetURL = url;
    var callbackFunction = callback ? callback : null;
    var syncMode = callbackFunction ? false : true;
    
    var HTTP = new XMLHttpRequest();
    
    if (callbackFunction) {
        HTTP.onreadystatechange = function() {
            if ((HTTP.readyState == 4))
                callbackFunction( HTTP.status == 200 ? HTTP.responseText : null );
        };
    }
    
    if (params) {
        var p = params.join('&');
    } else { var p = ''; }
    
    if (!syncMode) {
        HTTP.open('POST', targetURL, true);
        HTTP.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
        HTTP.send(p);
        return HTTP;
    } else {
        HTTP.open('POST', targetURL, false);
        HTTP.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
        HTTP.send(p);
        if (HTTP.status == 200) {
            return HTTP.responseText;
        } else { 
            return null;
        }
    }
}

function $_JSON_POST(url, params, callback) {
    
    callback = typeof callback != 'undefined' ? ( callback ? callback : null ) : null;
        
    if (callback == null) {
        var buffer = $_POST(url, params, null);
        try {
            return (buffer === null) ? null : JSON.parse(buffer);
        } catch (e) {
            return null;
        }
    } else {
        $_POST(url, params, function(buffer) {
            var json;
            try {
                json =  (buffer === null) ? null : JSON.parse(buffer);
            } catch( e ) {
                json = null;
            }
            callback(json);
        });
        
    }
}

function $_JSON_GET(url, callback, cacheMaxAge) {
    callback = callback || null;
    
    if ( !callback ) {
    
        var buffer = $_GET(url, null, cacheMaxAge);
        
        try {
            return (buffer === null) ? null : JSON.parse(buffer);
        } catch (ex) {
            return null;
        }
    
    } else {
        
        $_GET( url, function( response ) {
            
            try {
                response = JSON.parse( response );
            } catch ( e ) {
                response = null;
            }
            
            callback( response );
            
        }, cacheMaxAge );
        
    }
}

exports.$_GET = $_GET;
exports.$_POST= $_POST;
exports.$_JSON_GET = $_JSON_GET;
exports.$_JSON_POST= $_JSON_POST;