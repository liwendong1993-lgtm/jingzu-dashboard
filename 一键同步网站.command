#!/bin/zsh
set -e

SCRIPT_DIR="${0:A:h}"
"$SCRIPT_DIR/scripts/publish_pages.sh"

print ""
read "REPLY?按回车键关闭窗口…"
