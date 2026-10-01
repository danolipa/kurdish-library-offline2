# Project Gutenberg 10,000-book summary pipeline

Project Gutenberg currently publishes a large free ebook collection and provides machine-readable catalog data for building derivative catalogs. Its official offline-catalog page recommends using the catalog feeds rather than crawling individual pages.

This project targets **10,000 books**, with a **minimum 1,500-word Central Kurdish (Sorani) summary per book**.

## Pipeline

1. `node scripts/gutenberg-build-queue.mjs`
   - downloads the official Gutenberg CSV catalog
   - creates `content/gutenberg/summary-queue.json`
   - records title, author, language, subjects, source URL and processing status

2. `node scripts/gutenberg-summary-batches.mjs`
   - prepares manageable batches for an LLM summarization worker
   - default batch size: 25

3. A summarization worker fills `summaryKu` and marks each item complete.

4. Completed summaries are converted into the app's offline `src/data/summaries.json` format.

## Important

"Free on Project Gutenberg" does not mean that every territorial copyright question is identical everywhere. Before redistributing a particular ebook outside the United States, check the applicable rights information for that title.

Do not commit the complete Gutenberg text collection into the Android repository. Keep source texts in temporary/CI storage and commit compact metadata and completed summaries instead.
