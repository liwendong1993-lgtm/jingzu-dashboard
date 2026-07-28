# 竞足指挥台

这个仓库包含两个界面：

- `app/`：本地完整看板，可调用本地 API 执行刷新、预测、结算和复盘。
- `docs/`：GitHub Pages 公开只读版，只展示已导出的比赛、赔率、预测、赛果和报告。

公开站点不会上传 SQLite 数据库、任务日志、本地配置，也没有任何写入或执行接口。

## 本地使用

在项目根目录双击 `启动竞足看板.command`，使用完整本地看板。

## 更新公开网站

从本地 Kanban 成功生成初版、终版、复盘或 PDF 后，系统会自动导出脱敏快照、提交并推送，GitHub Actions 随后自动发布 GitHub Pages。

如果需要单独重试网站同步，也可以双击：

`一键同步网站.command`

脚本会重新生成 `docs/` 中的脱敏快照，只提交公开站点文件，然后推送当前分支。

也可以只在本地重新导出：

```bash
python3 scripts/export_public_site.py
```

## 发布流程

`.github/workflows/pages.yml` 在 `main` 分支的 `docs/` 发生变化时发布网站，也支持在 GitHub Actions 页面手动触发。

预测为概率判断，不代表确定赛果，不构成收益承诺。
