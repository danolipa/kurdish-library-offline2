# Kurdish Library content packs

This project is designed around a small metadata index plus large offline book files.

## Book library
Place lawful, distributable PDF/EPUB/TXT/HTML files under:
`public/library/books/`

Then build the manifest:
`node scripts/build-library-index.mjs public/library/books src/data/library.json`

For large collections, keep the book binaries outside Git when appropriate and distribute them as versioned offline packs. The manifest stays small and lets the app discover thousands of books.

## Kurdish summaries and metadata
Put records in:
- `content/summaries.json`
- `content/quotes.json`
- `content/authors.json`

Then run:
`npm run content:index`

The app also accepts a JSON data pack from the **داتاپاک** button. A pack can contain:
`books`, `summaries`, `quotes`, and `authors` arrays.

Use public-domain, licensed, user-provided, or original material. Do not bulk-copy proprietary quote/summarization databases.

## Recommended summary record
Each summary should use a stable `bookId`, a clear Kurdish title, a detailed Sorani `textKu`, word count, source, and rights metadata. This makes later batch ingestion, deduplication, search, and offline updates reliable.
