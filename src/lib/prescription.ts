/** Item-level states a prescription line can be in. */
export type ItemStatus = 'PENDING' | 'PARTIALLY_COMPLETED' | 'DISPENSED' | 'REJECTED';

/** A prescription is COMPLETED once every item is finished (dispensed or rejected). */
export function prescriptionStatus(items: { status: string }[]) {
    if (items.length === 0) return 'PENDING';
    if (items.every(i => i.status === 'DISPENSED' || i.status === 'REJECTED')) return 'COMPLETED';
    if (items.some(i => i.status !== 'PENDING')) return 'PARTIALLY_COMPLETED';
    return 'PENDING';
}

/** Item status implied by how much has been dispensed (rejections are sticky). */
export function itemStatus(current: string, quantity: number, dispensed: number): ItemStatus {
    if (current === 'REJECTED') return 'REJECTED';
    if (dispensed > 0 && dispensed >= quantity) return 'DISPENSED';
    if (dispensed > 0) return 'PARTIALLY_COMPLETED';
    return 'PENDING';
}
