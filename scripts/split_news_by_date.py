#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import pathlib
import re
from typing import Optional

ITEM_RE = re.compile(r"(?ms)^- <strong>.*?(?=^\- <strong>|\Z)")


def extract_items(text: str):
    return [m.strip() for m in ITEM_RE.findall(text)]


def parse_item_date(item: str) -> Optional[dt.date]:
    strong_match = re.match(r"- <strong>(.*?)</strong>", item, flags=re.S)
    if not strong_match:
        return None

    raw = strong_match.group(1)
    text = re.sub(r"<.*?>", "", raw).strip()

    year_match = re.search(r"(20\d{2})", text)
    if not year_match:
        return None
    year = int(year_match.group(1))

    md_match = re.search(r"([A-Za-z]+)\s+(\d{1,2})", text)
    if not md_match:
        return None

    month_str, day_str = md_match.groups()
    try:
        month = dt.datetime.strptime(month_str, "%B").month
        day = int(day_str)
        return dt.date(year, month, day)
    except ValueError:
        return None


def split_news(items, cutoff_date: dt.date):
    recent, archived = [], []

    for item in items:
        item_date = parse_item_date(item)
        if item_date is None or item_date >= cutoff_date:
            recent.append(item)
        else:
            archived.append(item)

    return recent, archived


def main() -> None:
    parser = argparse.ArgumentParser(description="Split news.md into recent (<6 months) and archive activities.md")
    parser.add_argument("--news", default="contents/news.md", help="Path to news markdown file")
    parser.add_argument("--activities", default="contents/activities.md", help="Path to activities markdown file")
    parser.add_argument("--days", type=int, default=183, help="Lookback days to keep in news (default: 183)")
    parser.add_argument("--today", default=None, help="Override today's date (YYYY-MM-DD)")
    args = parser.parse_args()

    news_path = pathlib.Path(args.news)
    activities_path = pathlib.Path(args.activities)

    today = dt.date.fromisoformat(args.today) if args.today else dt.date.today()
    cutoff = today - dt.timedelta(days=args.days)

    news_text = news_path.read_text(encoding="utf-8")
    news_items = extract_items(news_text)
    recent_items, archived_from_news = split_news(news_items, cutoff)

    existing_activities_items = []
    if activities_path.exists():
        existing_activities_items = extract_items(activities_path.read_text(encoding="utf-8"))

    # Merge old archive with newly archived items and de-duplicate while preserving order.
    merged_archived = []
    seen = set()
    for item in existing_activities_items + archived_from_news:
        if item not in seen:
            merged_archived.append(item)
            seen.add(item)

    recent_text = "\n\n".join(recent_items).strip() + "\n"

    archive_header = (
        "## Activities | 历史动态\n\n"
        f"以下内容为 {cutoff.isoformat()} 之前的动态归档（自动生成）。\n\n"
        "---\n\n"
    )
    archive_body = "\n\n".join(merged_archived).strip()
    if not archive_body:
        archive_body = "暂无半年以前的动态。"
    archive_text = archive_header + archive_body + "\n"

    news_path.write_text(recent_text, encoding="utf-8")
    activities_path.write_text(archive_text, encoding="utf-8")

    print(f"Updated {news_path} with {len(recent_items)} recent items (cutoff: {cutoff}).")
    print(f"Updated {activities_path} with {len(merged_archived)} archived items (merged).")


if __name__ == "__main__":
    main()
