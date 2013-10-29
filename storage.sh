#!/bin/sh
node main.js \
    -module storage \
    -api-address localhost:8080 \
    -port 10000 \
    -data-dir /jsplatform/classes/transcoder/transcoder/htdocs/.storage \
    -www "http://storage01/"
