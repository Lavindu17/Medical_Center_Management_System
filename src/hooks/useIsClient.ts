import { useSyncExternalStore } from 'react';

const subscribeNothing = () => () => {};

/**
 * false while rendering on the server and during hydration, true afterwards in the browser.
 *
 * Radix components (Popover, Sheet, Dialog...) generate element ids that differ between the server render and
 * hydration in this setup, which logs a hydration mismatch on every page. Rendering them only in the browser avoids it.
 */
export function useIsClient(): boolean {
    return useSyncExternalStore(subscribeNothing, () => true, () => false);
}
