#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
REPO_DIR="${SCRIPT_DIR:h}"

cd "$REPO_DIR"

python3 scripts/export_public_site.py

if ! git remote get-url origin >/dev/null 2>&1; then
  print "尚未连接 GitHub 仓库。请先完成首次发布。"
  exit 2
fi

git add -- docs

if git diff --cached --quiet; then
  print "公开数据没有变化，无需同步。"
  exit 0
fi

SYNC_TIME="$(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M')"
git commit -m "更新竞足看板 ${SYNC_TIME}"
git push origin "$(git branch --show-current)"

print "同步完成。GitHub Pages 正在自动更新，通常一两分钟后可访问。"
