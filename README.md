# Site maintenance helpers

## Keep News within the latest 6 months

When you update `contents/news.md`, run:

```bash
python3 tools/sync_news_activities.py
```

This command automatically:
- Keeps only the most recent 6 months of entries in `contents/news.md`.
- Moves older entries into `contents/activities.md` for the Activities page.

## Search engine visibility

The Pages workflow runs `node tools/build_seo.cjs` before Jekyll. This embeds the
existing Markdown in the seven main HTML pages, preserves their individual titles,
and generates `robots.txt` and `sitemap.xml`. Visitors and crawlers receive the same
content even without JavaScript. Continue editing `contents/*.md` as before; to
refresh the committed HTML for local previews, run the same command and commit the
generated files. Do not edit content between `prerender` markers manually.

After deployment, complete the account-side setup:

1. In [Google Search Console](https://search.google.com/search-console/), add the
   **URL-prefix** property `https://lijiawei098.github.io/`. Use an HTML verification
   file in the repository root or the supplied verification meta tag in the
   homepage `<head>`. Keep it in place after verification. GitHub controls the
   `github.io` DNS, so use URL-prefix rather than DNS verification.
2. Submit `https://lijiawei098.github.io/sitemap.xml`. Inspect the homepage URL,
   test its live version, and request indexing. Inspect CV and Publications too.
3. Add the same site to [Bing Webmaster Tools](https://www.bing.com/webmasters/),
   either by importing the verified Search Console property or by adding Bing's
   HTML verification file/tag. Submit the sitemap and inspect the homepage URL.
4. Link the homepage from your institutional profile, ORCID and Google Scholar
   profile where you control these. Relevant external links help discovery.

Do not invent verification tokens. They must come from the owner's webmaster
account. A sitemap and a successful live test do not guarantee indexing or ranking;
use each engine's URL inspection report to diagnose the actual indexing status.
