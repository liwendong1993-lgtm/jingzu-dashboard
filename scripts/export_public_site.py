#!/usr/bin/env python3
"""Export a sanitized, read-only snapshot for the GitHub Pages dashboard."""

from __future__ import annotations

import json
import shutil
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


DASHBOARD_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = DASHBOARD_ROOT.parent
DOCS_ROOT = DASHBOARD_ROOT / "docs"
DATA_ROOT = DOCS_ROOT / "data"
REPORTS_ROOT = DOCS_ROOT / "reports"
PDFS_ROOT = DOCS_ROOT / "pdfs"

sys.path.insert(0, str(PROJECT_ROOT))
import dashboard_server  # noqa: E402


def reset_generated_directory(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def copy_public_files(payload: dict) -> None:
    for report in payload.get("reports", []):
        source = PROJECT_ROOT / "reports" / report["name"]
        if source.is_file():
            shutil.copy2(source, REPORTS_ROOT / source.name)
            report["public_url"] = f"reports/{source.name}"

    for report in payload.get("pdf_reports", []):
        source = PROJECT_ROOT / "output" / "pdf" / report["name"]
        if source.is_file():
            shutil.copy2(source, PDFS_ROOT / source.name)
            report["public_url"] = f"pdfs/{source.name}"


def copy_standalone_reports() -> list[str]:
    """Publish operational reports even when a date has no match row."""
    source_root = PROJECT_ROOT / "reports"
    copied: list[str] = []
    if not source_root.is_dir():
        return copied
    for source in sorted(source_root.glob("*.md")):
        target = REPORTS_ROOT / source.name
        if not target.exists():
            shutil.copy2(source, target)
        copied.append(source.name)
    return copied


def sanitize(payload: dict) -> dict:
    # Execution history and writable endpoints are intentionally local-only.
    payload.pop("jobs", None)
    payload["reports"] = [
        report
        for report in payload.get("reports", [])
        if not report.get("local_shadow")
    ]
    for key in ("betting_plan", "placed_bet"):
        if isinstance(payload.get(key), dict):
            payload[key].pop("football_shadow_metrics", None)
    payload["public_mode"] = True
    payload["generated_at"] = datetime.now(ZoneInfo("Asia/Shanghai")).isoformat(timespec="seconds")
    for match in payload.get("matches", []):
        match.pop("football_shadow_preview", None)
        for key in (
            "league_id",
            "home_team_id",
            "away_team_id",
            "first_seen_at",
            "last_seen_at",
        ):
            match.pop(key, None)
    return payload


def main() -> None:
    if not dashboard_server.DB_PATH.is_file():
        raise SystemExit(f"找不到本地数据库：{dashboard_server.DB_PATH}")

    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    reset_generated_directory(REPORTS_ROOT)
    reset_generated_directory(PDFS_ROOT)

    latest = dashboard_server.query_dashboard(None)
    dates = latest.get("dates", [])
    if not dates:
        raise SystemExit("数据库中暂无可发布的比赛日期")

    exported_dates: list[str] = []
    for date_value in dates:
        payload = sanitize(dashboard_server.query_dashboard(date_value))
        copy_public_files(payload)
        output = DATA_ROOT / f"{date_value}.json"
        output.write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        exported_dates.append(date_value)

    standalone_reports = copy_standalone_reports()

    index_payload = {
        "default_date": exported_dates[0],
        "dates": exported_dates,
        "reports": standalone_reports,
        "generated_at": datetime.now(ZoneInfo("Asia/Shanghai")).isoformat(timespec="seconds"),
    }
    (DATA_ROOT / "index.json").write_text(
        json.dumps(index_payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    (DOCS_ROOT / ".nojekyll").touch()
    print(f"公开站点数据已导出：{len(exported_dates)} 个比赛日，位置 {DOCS_ROOT}")


if __name__ == "__main__":
    main()
