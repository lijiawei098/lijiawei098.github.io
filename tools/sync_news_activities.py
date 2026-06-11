#!/usr/bin/env python3
"""Split contents/news.md into recent (<=6 months) and archived (>6 months) entries.

Usage:
  python3 tools/sync_news_activities.py
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path

NEWS_PATH = Path('contents/news.md')
ACTIVITIES_PATH = Path('contents/activities.md')

ENTRY_RE = re.compile(r'(?ms)^-\s.*?(?=\n\n-\s|\Z)')
DATE_RE = re.compile(r'<strong>([^<]+)</strong>')
YEAR_RE = re.compile(r'\b(19|20)\d{2}\b')


def split_entries(markdown: str) -> list[str]:
    return [m.group(0).strip() for m in ENTRY_RE.finditer(markdown.strip())]


def parse_entry_date(entry: str) -> datetime | None:
    m = DATE_RE.search(entry)
    if not m:
        return None

    raw = m.group(1).strip().replace('–', '-').replace('—', '-')
    year_match = YEAR_RE.search(raw)
    year = year_match.group(0) if year_match else None

    candidate = raw.split('-', 1)[0].strip() if '-' in raw else raw
    if year and not YEAR_RE.search(candidate):
        candidate = f'{candidate}, {year}'

    for fmt in ('%B %d, %Y', '%b %d, %Y'):
        try:
            return datetime.strptime(candidate, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def partition(entries: list[str], cutoff: datetime) -> tuple[list[str], list[str]]:
    recent: list[str] = []
    archived: list[str] = []

    for entry in entries:
        entry_date = parse_entry_date(entry)
        if entry_date is None:
            recent.append(entry)
            continue

        if entry_date >= cutoff:
            recent.append(entry)
        else:
            archived.append(entry)

    return recent, archived


def deduplicate_entries(entries: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for entry in entries:
        if entry in seen:
            continue
        seen.add(entry)
        unique.append(entry)
    return unique


def write_markdown(path: Path, entries: list[str], empty_message: str) -> None:
    if entries:
        content = '\n\n'.join(entries) + '\n'
    else:
        content = empty_message + '\n'
    path.write_text(content, encoding='utf-8')


def main() -> None:
    news_source = NEWS_PATH.read_text(encoding='utf-8')
    activity_source = ACTIVITIES_PATH.read_text(encoding='utf-8') if ACTIVITIES_PATH.exists() else ''
    entries = split_entries(news_source)
    existing_activities = split_entries(activity_source)

    now = datetime.now(timezone.utc)
    cutoff_month = now.month - 6
    cutoff_year = now.year
    while cutoff_month <= 0:
        cutoff_month += 12
        cutoff_year -= 1
    day = min(now.day, 28)
    cutoff = datetime(cutoff_year, cutoff_month, day, tzinfo=timezone.utc)

    recent, newly_archived = partition(entries, cutoff)
    archived = deduplicate_entries([*newly_archived, *existing_activities])

    write_markdown(NEWS_PATH, recent, '- _No recent news in the past six months._')
    write_markdown(ACTIVITIES_PATH, archived, '- _No archived activities yet._')

    print(f'Cutoff date (UTC): {cutoff.date().isoformat()}')
    print(f'Recent entries: {len(recent)}')
    print(f'Newly archived entries: {len(newly_archived)}')
    print(f'Archived entries: {len(archived)}')


if __name__ == '__main__':
    main()
