export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return json({ error: "POST only" }, 405);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const { google_sheet_url, cell_selector, sheet_name } = body;

    if (!google_sheet_url || !cell_selector) {
      return json(
        { error: "google_sheet_url and cell_selector are required" },
        400
      );
    }

    const warnings: string[] = [];

    const sheetId = extractSheetId(google_sheet_url);
    const gid = extractGid(google_sheet_url);
    if (!gid) {
      warnings.push(
        "No gid found in URL, defaulting to first sheet"
      );
    }

    const csvUrl = buildCsvUrl(sheetId, gid, sheet_name);

    const csvRes = await fetch(csvUrl);
    if (!csvRes.ok) {
      return json(
        { error: "Failed to fetch sheet (check sheet name or permissions)" },
        400
      );
    }

    const csvText = await csvRes.text();
    const rows = parseCSV(csvText);

    let segments: string[] = [];

    try {
      if (cell_selector.toUpperCase().startsWith("ROW:")) {
        segments = extractRows(rows, cell_selector);
      } else {
        segments = extractColumn(rows, cell_selector);
      }
    } catch (err: any) {
      return json({ error: err.message }, 400);
    }

    if (segments.length === 0) {
      warnings.push("No segments found for given selector");
    }

    return json({
      status: "ok",
      segment_count: segments.length,
      segments,
      warnings
    });
  }
};

/* -------------------- EXTRACTION -------------------- */

function extractColumn(rows: string[][], selector: string): string[] {
  const match = selector.match(/^([A-Z]+)(\d+)?(?::([A-Z]+)?(\d+)?)?$/i);
  if (!match) throw new Error("Invalid column selector format");

  const column = match[1].toUpperCase();
  const startRow = match[2] ? Number(match[2]) : 1;
  const endRow = match[4] ? Number(match[4]) : null;

  const colIndex = columnToIndex(column);
  const segments: { segment: string }[] = [];

  let emptyStreak = 0;

  for (let i = startRow - 1; i < rows.length; i++) {
    if (endRow && i + 1 > endRow) break;

    const cell = rows[i]?.[colIndex];
    if (!cell || cell.trim() === "") {
      emptyStreak++;
      if (emptyStreak >= 2) break;
      continue;
    }

    emptyStreak = 0;
    segments.push(cell.trim());
  }

  return segments;
}

function extractRows(rows: string[][], selector: string): string[] {
  const match = selector.match(/^ROW:(\d+)(?::(\d+))?$/i);
  if (!match) throw new Error("Invalid ROW selector format");

  const startRow = Number(match[1]);
  const endRow = match[2] ? Number(match[2]) : startRow;

  const segments: string[] = [];

  for (let i = startRow - 1; i < rows.length; i++) {
    if (i + 1 > endRow) break;

    const row = rows[i] || [];
    for (const cell of row) {
      if (cell && cell.trim() !== "") {
        segments.push({ segment: cell.trim() });
      }
    }
  }

  return segments;
}

/* -------------------- HELPERS -------------------- */

function extractSheetId(url: string): string {
  const id = url.match(/\/d\/([^/]+)/)?.[1];
  if (!id) throw new Error("Invalid Google Sheets URL");
  return id;
}

function extractGid(url: string): string | null {
  return url.match(/gid=(\d+)/)?.[1] || null;
}

function buildCsvUrl(sheetId: string, gid: string | null, sheetName?: string) {
  if (sheetName) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&sheet=${encodeURIComponent(
      sheetName
    )}`;
  }
  if (gid) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  }
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
}

function columnToIndex(col: string): number {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.charCodeAt(i) - 64);
  }
  return index - 1;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
