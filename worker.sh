#!/bin/sh
node main.js \
    -module worker \
    -api-address localhost:8080 \
    -port 9000 \
    -data-dir /srv/jsplatform/classes/transcoder/transcoder/htdocs/.worker