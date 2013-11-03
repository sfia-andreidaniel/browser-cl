#!/bin/bash

BASEDIR="$( dirname "${BASH_SOURCE[0]}" )"
ROOTPATH=`realpath "$BASEDIR/../"`

cd $ROOTPATH

echo "Installing project node modules dependencies (in $ROOTPATH)..."

npm install xmlhttprequest
npm install websocket
npm install remove
npm install mysql
npm install mmmagic
npm install mkdirp
npm install gm
npm install base64
npm install nodemailer

echo ""
echo "======================"
echo ""

echo "All node modules have been installed successfully"