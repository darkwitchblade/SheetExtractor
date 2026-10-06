export type Segment = { segment: string };

export type Selector =
	| { kind: 'column'; column: number; startRow: number; endRow: number | null }
	| { kind: 'rows'; startRow: number; endRow: number };

/**
 * Parses a cell selector:
 * - Column: B, B2, B2:B6 (also B2: or B2:6). Without an end row the column is read until two empty cells in a row.
 * - Rows: ROW:2, ROW:2:6
 */
export function parseSelector(input: string): Selector {
	const selector = input.trim();

	if (/^ROW:/i.test(selector)) {
		const match = selector.match(/^ROW:(\d+)(?::(\d+))?$/i);
		if (!match) throw new Error(`Invalid ROW selector "${selector}" (expected e.g. ROW:2 or ROW:2:6)`);

		const startRow = parseRowNumber(match[1]);
		const endRow = match[2] ? parseRowNumber(match[2]) : startRow;
		checkRange(startRow, endRow);
		return { kind: 'rows', startRow, endRow };
	}

	const match = selector.match(/^([A-Z]+)(\d+)?(?::([A-Z]+)?(\d+)?)?$/i);
	if (!match) throw new Error(`Invalid column selector "${selector}" (expected e.g. B, B2 or B2:B6)`);

	const [, column, start, endColumn, end] = match;
	if (endColumn && endColumn.toUpperCase() !== column.toUpperCase()) {
		throw new Error(`Column selector "${selector}" spans several columns; use a single column (e.g. B2:B6) or ROW:n:m`);
	}

	const startRow = start ? parseRowNumber(start) : 1;
	const endRow = end ? parseRowNumber(end) : null;
	if (endRow !== null) checkRange(startRow, endRow);
	return { kind: 'column', column: columnToIndex(column), startRow, endRow };
}

export function extractSegments(rows: string[][], selector: Selector): Segment[] {
	return selector.kind === 'rows' ? extractRows(rows, selector.startRow, selector.endRow) : extractColumn(rows, selector);
}

function extractColumn(rows: string[][], { column, startRow, endRow }: Extract<Selector, { kind: 'column' }>): Segment[] {
	const segments: Segment[] = [];
	const lastRow = Math.min(endRow ?? rows.length, rows.length);
	let emptyStreak = 0;

	for (let i = startRow - 1; i < lastRow; i++) {
		const cell = rows[i][column]?.trim() ?? '';
		if (cell === '') {
			// An open-ended selector reads one block of cells, ending at two consecutive empty cells.
			// An explicit range reads every non-empty cell in it.
			if (endRow === null && ++emptyStreak >= 2) break;
			continue;
		}

		emptyStreak = 0;
		segments.push({ segment: cell });
	}

	return segments;
}

function extractRows(rows: string[][], startRow: number, endRow: number): Segment[] {
	const segments: Segment[] = [];

	for (const row of rows.slice(startRow - 1, endRow)) {
		for (const cell of row) {
			const value = cell.trim();
			if (value !== '') segments.push({ segment: value });
		}
	}

	return segments;
}

function parseRowNumber(value: string): number {
	const row = Number(value);
	if (!Number.isSafeInteger(row) || row < 1) throw new Error(`Invalid row number "${value}" (rows start at 1)`);
	return row;
}

function checkRange(startRow: number, endRow: number): void {
	if (endRow < startRow) throw new Error(`Range end row ${endRow} is before start row ${startRow}`);
}

function columnToIndex(col: string): number {
	let index = 0;
	for (const char of col.toUpperCase()) {
		index = index * 26 + (char.charCodeAt(0) - 64);
	}
	return index - 1;
}
