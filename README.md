<h1>Storage events:</h1>

Event            : "disk-stats"
Event.Args       : {}
Response.SUCCESS : { "qouta": <int>, "free": <int>, "space": <int> }
Response.ERROR   : { "error": true, "reason": <string> }

Event            : "disk-stats-add"
Event.Args       : { "size": <int> }
Response.SUCCESS : { "ok": true }
Response.ERROR   : { "error": true, "reason": <string> }

