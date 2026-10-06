import { fetchMock, SELF } from 'cloudflare:test';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/abc123/edit';
const CSV = 'Title,Body\r\nFirst,"Hello, world"\r\nSecond,"Line 1\nLine 2"\r\n';

function post(body: unknown) {
	return SELF.fetch('https://worker.test/', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body),
	});
}

function mockSheet(path: string, status: number, body: string, contentType = 'text/csv; charset=utf-8') {
	fetchMock
		.get('https://docs.google.com')
		.intercept({ path: `/spreadsheets/d/abc123${path}` })
		.reply(status, body, { headers: { 'Content-Type': contentType } });
}

beforeAll(() => {
	fetchMock.activate();
	fetchMock.disableNetConnect();
});

afterEach(() => fetchMock.assertNoPendingInterceptors());

describe('request validation', () => {
	it('rejects non-POST requests', async () => {
		const res = await SELF.fetch('https://worker.test/');
		expect(res.status).toBe(405);
	});

	it.each([
		['invalid JSON', '{nope', 'Invalid JSON body'],
		['a null body', 'null', 'JSON body must be an object'],
		['missing fields', {}, 'google_sheet_url and cell_selector are required strings'],
		['a non-string selector', { google_sheet_url: SHEET_URL, cell_selector: 2 }, 'google_sheet_url and cell_selector are required strings'],
		['a non-string sheet_name', { google_sheet_url: SHEET_URL, cell_selector: 'B', sheet_name: 1 }, 'sheet_name must be a string'],
		['a non-Sheets URL', { google_sheet_url: 'https://example.com', cell_selector: 'B' }, 'google_sheet_url is not a Google Sheets URL'],
	])('returns a JSON 400 for %s', async (_, body, error) => {
		const res = await post(body);
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error });
	});

	it('rejects an invalid selector without fetching the sheet', async () => {
		const res = await post({ google_sheet_url: SHEET_URL, cell_selector: 'B2:C6' });
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ error: expect.stringContaining('single column') });
	});
});

describe('extraction', () => {
	it('returns column segments as objects, warning when no tab is specified', async () => {
		mockSheet('/export?format=csv', 200, CSV);

		const res = await post({ google_sheet_url: SHEET_URL, cell_selector: 'B2' });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			status: 'ok',
			segment_count: 2,
			segments: [{ segment: 'Hello, world' }, { segment: 'Line 1\nLine 2' }],
			warnings: ['No gid found in URL and no sheet_name given, defaulting to first sheet'],
		});
	});

	it('returns row segments in the same shape, using the gid from the URL', async () => {
		mockSheet('/export?format=csv&gid=42', 200, CSV);

		const res = await post({ google_sheet_url: `${SHEET_URL}#gid=42`, cell_selector: 'ROW:2' });
		expect(await res.json()).toEqual({
			status: 'ok',
			segment_count: 2,
			segments: [{ segment: 'First' }, { segment: 'Hello, world' }],
			warnings: [],
		});
	});

	it('selects a tab by sheet_name', async () => {
		mockSheet('/gviz/tq?tqx=out:csv&headers=1&sheet=Posts%202', 200, '"Title","Body"\n"First","Hi"\n');

		const res = await post({ google_sheet_url: SHEET_URL, cell_selector: 'B2', sheet_name: 'Posts 2' });
		expect(await res.json()).toMatchObject({ segments: [{ segment: 'Hi' }], warnings: [] });
	});

	it('treats an empty sheet_name as absent', async () => {
		mockSheet('/export?format=csv&gid=0', 200, CSV);

		const res = await post({ google_sheet_url: `${SHEET_URL}#gid=0`, cell_selector: 'A2', sheet_name: '' });
		expect(await res.json()).toMatchObject({ segments: [{ segment: 'First' }, { segment: 'Second' }] });
	});

	it('warns when nothing matches', async () => {
		mockSheet('/export?format=csv&gid=0', 200, CSV);

		const res = await post({ google_sheet_url: `${SHEET_URL}#gid=0`, cell_selector: 'D' });
		expect(await res.json()).toMatchObject({ segment_count: 0, segments: [], warnings: ['No segments found for given selector'] });
	});
});

describe('upstream errors', () => {
	it('reports a failed fetch', async () => {
		mockSheet('/export?format=csv&gid=0', 404, 'Not Found', 'text/plain');

		const res = await post({ google_sheet_url: `${SHEET_URL}#gid=0`, cell_selector: 'B' });
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'Failed to fetch sheet (HTTP 404); check the URL, gid and sheet_name' });
	});

	it('reports a private sheet instead of parsing the sign-in page', async () => {
		mockSheet('/export?format=csv&gid=0', 200, '<!DOCTYPE html><html>Sign in</html>', 'text/html; charset=utf-8');

		const res = await post({ google_sheet_url: `${SHEET_URL}#gid=0`, cell_selector: 'B' });
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'Sheet is not public; share it as "Anyone with the link can view"' });
	});
});
