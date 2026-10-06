import { parseCSV } from './csv';
import { extractSegments, parseSelector, type Selector } from './extract';
import { buildCsvUrl, extractGid, extractSheetId } from './sheets';

export default {
	async fetch(request): Promise<Response> {
		try {
			return await handle(request);
		} catch (err) {
			console.error(err);
			return json({ error: 'Internal error' }, 500);
		}
	},
} satisfies ExportedHandler;

async function handle(request: Request): Promise<Response> {
	if (request.method !== 'POST') {
		return json({ error: 'POST only' }, 405);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, 400);
	}
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return json({ error: 'JSON body must be an object' }, 400);
	}

	const { google_sheet_url, cell_selector, sheet_name } = body as Record<string, unknown>;

	if (typeof google_sheet_url !== 'string' || typeof cell_selector !== 'string' || !google_sheet_url || !cell_selector) {
		return json({ error: 'google_sheet_url and cell_selector are required strings' }, 400);
	}
	// Automation tools often send unmapped optional fields as "" or null.
	if (sheet_name != null && typeof sheet_name !== 'string') {
		return json({ error: 'sheet_name must be a string' }, 400);
	}
	const sheetName = sheet_name?.trim() || undefined;

	let sheetId: string;
	let selector: Selector;
	try {
		sheetId = extractSheetId(google_sheet_url);
		selector = parseSelector(cell_selector);
	} catch (err) {
		return json({ error: (err as Error).message }, 400);
	}

	const warnings: string[] = [];

	const gid = extractGid(google_sheet_url);
	if (!gid && !sheetName) {
		warnings.push('No gid found in URL and no sheet_name given, defaulting to first sheet');
	}

	let csvRes: Response;
	try {
		csvRes = await fetch(buildCsvUrl(sheetId, gid, sheetName));
	} catch {
		return json({ error: 'Could not reach Google Sheets' }, 502);
	}

	if (!csvRes.ok) {
		return json({ error: `Failed to fetch sheet (HTTP ${csvRes.status}); check the URL, gid and sheet_name` }, 400);
	}
	// Sheets that aren't shared publicly redirect to a Google sign-in page rather than failing.
	if (csvRes.headers.get('Content-Type')?.includes('text/html')) {
		return json({ error: 'Sheet is not public; share it as "Anyone with the link can view"' }, 400);
	}

	const rows = parseCSV(await csvRes.text());
	const segments = extractSegments(rows, selector);

	if (segments.length === 0) {
		warnings.push('No segments found for given selector');
	}

	return json({
		status: 'ok',
		segment_count: segments.length,
		segments,
		warnings,
	});
}

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data, null, 2), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}
