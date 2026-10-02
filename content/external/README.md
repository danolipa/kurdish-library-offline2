# External public data pipeline

This directory stages public datasets that can enrich Kurdish Library.

## Current sources

- SQuALITY v1.3: 127 Gutenberg stories with multi-reference summaries.
  - Source: https://huggingface.co/datasets/pszemraj/SQuALITY-v1.3
  - License: CC BY 4.0 as documented by the original SQuALITY project.
- Project Gutenberg/Gutendex metadata: public/free-ebook metadata, subject to the applicable rights notice.

Third-party data is imported only when its license is identified. Underlying book rights are checked separately.

## Workflow

1. npm run external:squality
2. npm run external:translate (requires GROQ_API_KEY in GitHub Actions Secrets)
3. Validate and merge the Kurdish records into the offline summary pack.
4. Preserve source URL, license, rights note and timestamps.