/** Escapes text before it is placed inside HTML (emails, for example) so names cannot inject markup. */
export function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Escapes LIKE wildcards so user input matches literally. */
export function escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (c) => '\\' + c);
}
