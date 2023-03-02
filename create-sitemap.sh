#!/bin/bash

RELATIVE_DIR=`dirname "$0"`
cd $RELATIVE_DIR
SHELL_PATH=`pwd -P`

rm -rf /var/www/html/static/*

node $SHELL_PATH/build/index.js -sitemap-out /var/www/html/static/sitemap.xml -static-out /var/www/html/static
