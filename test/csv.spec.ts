import { describe, expect, it } from 'vitest';
import { parseCSV } from '../src/csv';

describe('parseCSV', () => {
	it('splits rows and cells', () => {
		expect(parseCSV('a,b\nc,d')).toEqual([
			['a', 'b'],
			['c', 'd'],
		]);
	});

	it('handles CRLF line endings without leaving \\r in cells', () => {
		expect(parseCSV('a,b\r\nc,d\r\n')).toEqual([
			['a', 'b'],
			['c', 'd'],
		]);
	});

	it('does not add a row for a trailing line break', () => {
		expect(parseCSV('a\n')).toEqual([['a']]);
		expect(parseCSV('')).toEqual([]);
	});

	it('keeps empty cells', () => {
		expect(parseCSV('a,,c,\n,,,')).toEqual([
			['a', '', 'c', ''],
			['', '', '', ''],
		]);
	});

	it('handles quoted commas and line breaks', () => {
		expect(parseCSV('"a, b","line 1\nline 2"\nc,d')).toEqual([
			['a, b', 'line 1\nline 2'],
			['c', 'd'],
		]);
	});

	it('unescapes doubled quotes only inside quoted cells', () => {
		expect(parseCSV('"say ""hi""",""""')).toEqual([['say "hi"', '"']]);
		expect(parseCSV('a,"",b')).toEqual([['a', '', 'b']]);
	});
});
