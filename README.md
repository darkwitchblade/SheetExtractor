# Google Sheets Segment Extractor Worker

A fast, serverless Google Sheets extractor built for automation (Albato, Make, Zapier).

## Features
- No Google API key required
- Public sheets only
- Column or row extraction
- CSV-based (fast & reliable)
- Explicit, safe selectors
- Automation-friendly JSON output

## Endpoint
POST /

## Required fields
- google_sheet_url
- cell_selector

## Column selectors
- B
- B2
- B2:B6

## Row selectors
- ROW:2
- ROW:2:6

## Example: Column extraction
```bash
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{
    "google_sheet_url":"https://docs.google.com/spreadsheets/d/XXX/edit?gid=0",
    "cell_selector":"B2"
  }'

Example: Row extraction

```bash
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{
    "google_sheet_url":"https://docs.google.com/spreadsheets/d/XXX/edit",
    "cell_selector":"ROW:2"
  }'

Response
{
  "status": "ok",
  "segment_count": 3,
  "segments": ["Text 1", "Text 2", "Text 3"],
  "warnings": []
}

Warnings

Missing gid → defaults to first sheet

Empty result set

Version

v1.0.0


---
 Unit-style test curls (copy/paste safe)

### Column infinite
```bash
-d '{"google_sheet_url":"URL","cell_selector":"B"}'

Column range
-d '{"google_sheet_url":"URL","cell_selector":"B2:B6"}'

Row single
-d '{"google_sheet_url":"URL","cell_selector":"ROW:2"}'

Row range
-d '{"google_sheet_url":"URL","cell_selector":"ROW:2:6"}'
