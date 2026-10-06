import { describe, expect, it } from 'vitest';
import { buildCsvUrl, extractGid, extractSheetId } from '../src/sheets';

describe('extractSheetId', () => {
	it.each([
		'https://docs.google.com/spreadsheets/d/1a-B_c/edit#gid=0',
		'https://docs.google.com/spreadsheets/d/1a-B_c/edit?usp=sharing',
		'https://docs.google.com/spreadsheets/d/1a-B_c',
		'https://docs.google.com/spreadsheets/u/1/d/1a-B_c/edit',
	])('extracts the ID from %s', (url) => {
		expect(extractSheetId(url)).toBe('1a-B_c');
	});

	it('rejects URLs without a sheet ID', () => {
		expect(() => extractSheetId('https://example.com/sheet')).toThrow(/not a Google Sheets URL/);
	});

	it('rejects "Publish to web" links', () => {
		expect(() => extractSheetId('https://docs.google.com/spreadsheets/d/e/2PACX-1vQ/pubhtml')).toThrow(/Publish to web/);
	});
});

describe('extractGid', () => {
	it.each([
		['https://docs.google.com/spreadsheets/d/x/edit#gid=123', '123'],
		['https://docs.google.com/spreadsheets/d/x/edit?gid=456#gid=456', '456'],
		['https://docs.google.com/spreadsheets/d/x/edit', null],
	])('reads the gid from %s', (url, gid) => {
		expect(extractGid(url)).toBe(gid);
	});
});

describe('buildCsvUrl', () => {
	const base = 'https://docs.google.com/spreadsheets/d/abc';

	it('uses the CSV export, by gid when known', () => {
		expect(buildCsvUrl('abc', '7', undefined)).toBe(`${base}/export?format=csv&gid=7`);
		expect(buildCsvUrl('abc', null, undefined)).toBe(`${base}/export?format=csv`);
	});

	it('selects a tab by name through the Visualization API', () => {
		expect(buildCsvUrl('abc', '7', 'My Tab & Co')).toBe(`${base}/gviz/tq?tqx=out:csv&headers=1&sheet=My%20Tab%20%26%20Co`);
	});
});
