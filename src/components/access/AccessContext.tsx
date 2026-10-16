'use client';

import { createContext, useContext } from 'react';
import type { Level, ResourceKey } from '@/lib/access/registry';
import type { GrantMap } from '@/lib/access/defaults';

/** undefined: not inside the staff app (nothing is hidden: the server decides). null / a map: the person's permissions. */
const AccessContext = createContext<GrantMap | null | undefined>(undefined);

/** Makes the signed-in person's permissions available to every screen inside the staff app. */
export const AccessProvider = AccessContext.Provider;

/**
 * Whether the signed-in person may do something on a screen, so a screen can leave out the buttons they cannot use instead of
 * showing them and failing with "forbidden". (The server checks every request as well: this is only for a tidy screen.)
 */
export function useCan(resource: ResourceKey, level: Level): boolean {
    const grants = useContext(AccessContext);
    if (grants === undefined) return true;
    return Boolean(grants?.[resource]?.[level]);
}
