# کتێبخانەی کوردی — Kurdish Library Offline

Offline-first Android e-reader for a large Kurdish Sorani collection.

## Product goals
- RTL Sorani interface (ckb, RTL)
- Offline library/catalog and reading
- EPUB, PDF and common ebook/document formats through appropriate viewers
- Text-to-speech and reading controls
- OCR pipeline for scanned books
- Book metadata, covers, summaries and Kurdish translations
- Search, bookmarks, notes, reading progress, themes and accessibility
- Scalable import pipeline for thousands of books

## Architecture note
The 5,000 source books should not be committed directly to GitHub source control. Large binary books should be packaged as release assets or imported into the app's local storage during a controlled build/import process. The app is designed to work offline after installation.

## Supplied source
Four Google Drive folders were supplied by the project owner. Their contents must be accessible to the import/build environment before the final 5,000-book bundle can be generated.

## Target
Android 7+ where practical, with emphasis on low-memory phones.