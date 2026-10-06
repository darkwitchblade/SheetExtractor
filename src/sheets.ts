/**
 * Extracts the spreadsheet ID from a Google Sheets URL, e.g.
 * https://docs.google.com/spreadsheets/d/<id>/edit#gid=0
 */
export function extractSheetId(url: string): string {
	const id = url.match(/\/d\/([\w-]+)/)?.[1];
	if (!id) throw new Error('google_sheet_url is not a Google Sheets URL');
	if (id === 'e') {
		throw new Error('"Publish to web" links (/d/e/...) are not supported; use the sheet\'s share link instead');
	}
	return id;
}

export function extractGid(url: string): string | null {
	return url.match(/[#?&]gid=(\d+)/)?.[1] ?? null;
}

export function buildCsvUrl(sheetId: string, gid: string | null, sheetName?: string): string {
	const base = `https://docs.google.com/spreadsheets/d/${sheetId}`;
	if (sheetName) {
		// The /export endpoint can only select a tab by gid, so tabs selected by name go through the
		// Visualization API. headers=1 stops it guessing (and merging) header rows, which would shift row numbers.
		return `${base}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(sheetName)}`;
	}
	if (gid) {
		return `${base}/export?format=csv&gid=${gid}`;
	}
	return `${base}/export?format=csv`;
}
