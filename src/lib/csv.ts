/** CSV helpers shared by the exports. */

/** A cell that starts with = + - or @ would run as a formula when the CSV is opened in a spreadsheet. */
export function csvCell(value: unknown): string {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvLine(cells: unknown[]): string {
    return cells.map(csvCell).join(',');
}

export function toCsvText(header: string[], rows: unknown[][]): string {
    return [csvLine(header), ...rows.map(csvLine)].join('\r\n') + '\r\n';
}
