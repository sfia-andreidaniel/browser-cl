var nodemailer = require( 'nodemailer' ),
    Async = require( __dirname + '/async.js' ).Async,
    which = require( __dirname + '/osutils.js' ).which,
    fs = require( 'fs' ),
    mailFrom = null,
    cloudWatchers = null;

try {
    mailFrom = fs.readFileSync( __dirname + '/../conf/mail.cloudadmin.conf' ) + '';
} catch (err) {
    
}

try {
    cloudWatchers = fs.readFileSync( __dirname + '/../conf/mail.cloudwatchers.conf' ) + '';
} catch ( err ) {
    cloudWatchers = null;
}

mailFrom = mailFrom || 'cloud@localhost.localdomain';

function text_mail( mailTo, mailSubject, mailBody, callback ) {
    
    var tasker   = new Async(),
        sendmailbin = null,
        transport = null;
    
    tasker.sync( function() {
        
        ( function( task ) {
        
            which( 'sendmail', function( err, path ) {
                
                if ( err )
                    task.on( 'error', "sendmail not found: " + err );
                else {
                    task.on( 'success' );
                    sendmailbin = path;
                }
                
            } );
        
        })( this );
        
    } );
    
    tasker.sync( function() {
        
        ( function( task ) {
            
            transport = nodemailer.createTransport("sendmail", {
                path: sendmailbin,
                args: ["-t", "-f", mailFrom]
            });
            
            mailOptions = {
                "from": mailFrom,
                "to": mailTo,
                "subject": mailSubject,
                "text": mailBody
            };
            
            transport.sendMail( mailOptions, function( err, response ) {
                
                if ( err )
                    task.on( "error", err );
                else
                    task.on( 'success' );
                
            });
            
            transport.close();
            
        } )(this);
        
    } );
    
    tasker.run(
        function() {
            callback( false );
        }, function(reason) {
            callback( reason );
        }
    );
    
}

function html_mail( mailTo, mailSubject, mailBody, callback ) {
    
    var tasker   = new Async(),
        sendmailbin = null,
        transport = null;
    
    tasker.sync( function() {
        
        ( function( task ) {
        
            which( 'sendmail', function( err, path ) {
                
                if ( err )
                    task.on( 'error', "sendmail not found: " + err );
                else {
                    task.on( 'success' );
                    sendmailbin = path;
                }
                
            } );
        
        })( this );
        
    } );
    
    tasker.sync( function() {
        
        ( function( task ) {
            
            transport = nodemailer.createTransport("sendmail", {
                path: sendmailbin,
                args: ["-t", "-f", mailFrom]
            });
            
            mailOptions = {
                "from": mailFrom,
                "to": mailTo,
                "subject": mailSubject,
                "html": mailBody
            };
            
            transport.sendMail( mailOptions, function( err, response ) {
                
                if ( err )
                    task.on( "error", err );
                else
                    task.on( 'success' );
                
            });
            
            transport.close();
            
        } )(this);
        
    } );
    
    tasker.run(
        function() {
            callback( false );
        }, function(reason) {
            callback( reason );
        }
    );
    
}

/* mail( 'sfia.andreidaniel@gmail.com', "Node js mail test", "This is the mail message", function( err ) {
    
    console.log( err || "Mail sent successfully" );
    
} );
*/

exports.textMail = text_mail;
exports.htmlMail = html_mail;
exports.cloudAdmin = mailFrom + '';
exports.cloudWatchers = cloudWatchers || '';