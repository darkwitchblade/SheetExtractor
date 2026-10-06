import { describe, expect, it } from 'vitest';
import { extractSegments, parseSelector } from '../src/extract';

const segments = (...values: string[]) => values.map((segment) => ({ segment }));

describe('parseSelector', () => {
	it.each([
		['B', { kind: 'column', column: 1, startRow: 1, endRow: null }],
		['b2', { kind: 'column', column: 1, startRow: 2, endRow: null }],
		['B2:', { kind: 'column', column: 1, startRow: 2, endRow: null }],
		['B2:B6', { kind: 'column', column: 1, startRow: 2, endRow: 6 }],
		['B2:6', { kind: 'column', column: 1, startRow: 2, endRow: 6 }],
		['AA3', { kind: 'column', column: 26, startRow: 3, endRow: null }],
		[' C1 ', { kind: 'column', column: 2, startRow: 1, endRow: null }],
		['ROW:2', { kind: 'rows', startRow: 2, endRow: 2 }],
		['row:2:6', { kind: 'rows', startRow: 2, endRow: 6 }],
	])('parses %j', (input, expected) => {
		expect(parseSelector(input)).toEqual(expected);
	});

	it.each(['', 'B2-B6', '2B', 'ROW:', 'ROW:A', 'ROW:2:3:4'])('rejects malformed selector %j', (input) => {
		expect(() => parseSelector(input)).toThrow(/Invalid/);
	});

	it('rejects ranges spanning several columns', () => {
		expect(() => parseSelector('B2:C6')).toThrow(/single column/);
	});

	it('rejects row 0 and reversed ranges', () => {
		expect(() => parseSelector('B0')).toThrow(/rows start at 1/);
		expect(() => parseSelector('ROW:0')).toThrow(/rows start at 1/);
		expect(() => parseSelector('B6:B2')).toThrow(/before start row/);
		expect(() => parseSelector('ROW:6:2')).toThrow(/before start row/);
	});
});

describe('extractSegments', () => {
	const rows = [
		['Header A', 'Header B', 'Header C'],
		['a2', ' b2 ', 'c2'],
		['a3', '', 'c3'],
		['a4', 'b4', ''],
		['a5', '', ''],
		['a6', '', ''],
		['a7', 'b7', 'c7'],
	];
	const extract = (selector: string) => extractSegments(rows, parseSelector(selector));

	it('reads an open-ended column until two consecutive empty cells', () => {
		expect(extract('B2')).toEqual(segments('b2', 'b4'));
		expect(extract('B')).toEqual(segments('Header B', 'b2', 'b4'));
	});

	it('reads every non-empty cell of an explicit column range', () => {
		expect(extract('B2:B7')).toEqual(segments('b2', 'b4', 'b7'));
		expect(extract('B4:B4')).toEqual(segments('b4'));
	});

	it('stops at the end of the sheet', () => {
		expect(extract('A5:A100')).toEqual(segments('a5', 'a6', 'a7'));
		expect(extract('A100')).toEqual([]);
		expect(extract('Z1')).toEqual([]);
	});

	it('reads non-empty cells of a row or row range', () => {
		expect(extract('ROW:3')).toEqual(segments('a3', 'c3'));
		expect(extract('ROW:3:4')).toEqual(segments('a3', 'c3', 'a4', 'b4'));
		expect(extract('ROW:100')).toEqual([]);
	});
});
