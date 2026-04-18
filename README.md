# Site maintenance helpers

## Keep News within the latest 6 months

When you update `contents/news.md`, run:

```bash
python3 tools/sync_news_activities.py
```

This command automatically:
- Keeps only the most recent 6 months of entries in `contents/news.md`.
- Moves older entries into `contents/activities.md` for the Activities page.
