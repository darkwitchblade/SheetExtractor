# Google Sheets Segment Extractor Worker

A fast, serverless Google Sheets extractor built for automation (Albato, Make, Zapier).

## Features

- No Google API key required
- Public sheets only ("Anyone with the link can view")
- Column or row extraction
- CSV-based (fast & reliable)
- Explicit, safe selectors
- Automation-friendly JSON output

## Endpoint

`POST /` with a JSON body.

| Field              | Required | Description                                                             |
| ------------------ | -------- | ----------------------------------------------------------------------- |
| `google_sheet_url` | yes      | The sheet's share or edit URL. A `gid` in the URL selects the tab.      |
| `cell_selector`    | yes      | Which cells to read (see below).                                        |
| `sheet_name`       | no       | Tab name. Overrides the URL's `gid`. Empty string or `null` is ignored. |

If the URL has no `gid` and no `sheet_name` is given, the first tab is used.

## Selectors

Rows start at 1. Empty cells are skipped and values are trimmed.

| Selector  | Reads                                                  |
| --------- | ------------------------------------------------------ |
| `B`       | Column B from row 1, until two consecutive empty cells |
| `B2`      | Column B from row 2, until two consecutive empty cells |
| `B2:B6`   | Every non-empty cell in B2–B6 (`B2:6` also works)      |
| `ROW:2`   | Every non-empty cell in row 2, left to right           |
| `ROW:2:6` | Every non-empty cell in rows 2–6, row by row           |

Ranges must stay in one column: `B2:C6` is rejected.

## Examples

Column extraction:

```bash
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{
    "google_sheet_url": "https://docs.google.com/spreadsheets/d/XXX/edit#gid=0",
    "cell_selector": "B2"
  }'
```

Row extraction from a named tab:

```bash
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{
    "google_sheet_url": "https://docs.google.com/spreadsheets/d/XXX/edit",
    "cell_selector": "ROW:2:6",
    "sheet_name": "Posts"
  }'
```

## Response

```json
{
	"status": "ok",
	"segment_count": 3,
	"segments": [{ "segment": "Text 1" }, { "segment": "Text 2" }, { "segment": "Text 3" }],
	"warnings": []
}
```

Possible warnings:

- `No gid found in URL and no sheet_name given, defaulting to first sheet`
- `No segments found for given selector`

Errors return a non-2xx status with `{ "error": "..." }`:

| Status | Cause                                                                     |
| ------ | ------------------------------------------------------------------------- |
| 400    | Invalid body, URL or selector; sheet not found; sheet not shared publicly |
| 405    | Method other than `POST`                                                  |
| 500    | Unexpected error                                                          |
| 502    | Google Sheets could not be reached                                        |

### Selecting a tab: `gid` vs `sheet_name`

Prefer a URL with a `gid` (open the tab, copy the URL). It uses Google's CSV export and returns cells exactly as displayed.

`sheet_name` uses Google's Visualization API instead, as the CSV export can't select tabs by name. That endpoint has two quirks:

- In a column mixing numbers and text, the less common type comes back empty.
- An unknown tab name silently returns the first tab.

## Development

```bash
npm install
npm run dev        # local server on http://localhost:8787
npm test           # unit + integration tests (run in the Workers runtime)
npm run typecheck
npm run deploy
```

## Version

v1.0.0
