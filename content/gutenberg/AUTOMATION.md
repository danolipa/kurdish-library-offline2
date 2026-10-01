# Gutenberg AI automation

The repository now contains an automatic GitHub Actions worker that:
1. reads queued Project Gutenberg books;
2. downloads their plain text;
3. sends the source text to the OpenAI Responses API;
4. generates a Central Kurdish (Sorani) summary longer than 1,500 words;
5. retries with an expansion request when the result is too short;
6. stores each completed summary as a separate JSON file;
7. rebuilds `src/data/summaries.json`;
8. commits the new data back to the repository.

## One-time secret

GitHub Actions cannot safely receive an OpenAI API key from this code. Add the key in the repository's encrypted Actions secrets as:

`OPENAI_API_KEY`

Do not put an API key in source files, workflow YAML, JSON, or the Android app.

Optional repository variable:

`OPENAI_MODEL`

Default: `gpt-5.6-luna`.

The workflow runs automatically every six hours and can also be started manually from GitHub Actions.

For a very large 10,000-book collection, the generated summaries are kept as individual JSON files under `content/gutenberg/generated/` so the pipeline does not need to rewrite one giant source file for every book.
