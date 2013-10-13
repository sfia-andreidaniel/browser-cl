#!/bin/sh
nodejs main.js \
    -module storage \
    -api-address localhost:8080 \
    -port 10000 \
    -data-dir /srv/www/websites/transcoder/htdocs/.storage \
    -www "http://storage01/"
