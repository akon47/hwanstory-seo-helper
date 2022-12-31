#!/bin/bash

RELATIVE_DIR=`dirname "$0"`
cd $RELATIVE_DIR
SHELL_PATH=`pwd -P`

node $SHELL_PATH/build/index.js -sitemap-out /var/www/html/sitemap/sitemap.xml -static-out /var/www/html/static
