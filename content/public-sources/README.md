# Public-source data pipeline

This app can combine rights-cleared public metadata with the Gutenberg summary pipeline.

## Sources currently approved for metadata enrichment

- **Project Gutenberg catalog/texts**: use only individual works whose applicable rights permit redistribution. Gutenberg itself notes that copyright status can differ by territory. See its license/policy.
- **Open Library**: bibliographic catalog data is openly reusable; individual covers/media can have separate rights, so the pipeline records the source and does not assume every image is unrestricted.
- **Wikidata**: structured data is CC0. It can be used later to enrich authors, identifiers, dates, languages and categories.

## Sources deliberately not imported automatically

Public GitHub repositories containing book summaries are not automatically safe to copy merely because the repository is public. For example, some datasets are derived from websites or books whose redistribution rights are not clearly granted. Such sources can be used for research/audit only until their dataset license and underlying-content rights are verified.

## Output

`scripts/gutenberg-build-library.mjs` creates:

- `src/data/library.json` — up to 10,000 Gutenberg book metadata records
- `content/public-sources/openlibrary-enrichment.json` — cached Open Library enrichment

The Android app can then use the metadata offline. Full book files are downloaded/cached only when explicitly made available through the app's import/download pipeline.
