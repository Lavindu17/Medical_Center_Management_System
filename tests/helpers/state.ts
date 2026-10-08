import { AsyncLocalStorage } from 'async_hooks';

export const state: { token: string | null } = { token: null };

// Per-request identity for truly parallel calls: the cookie mock prefers this over the shared `state.token`.
export const identity = new AsyncLocalStorage<string | null>();
export const currentToken = () => (identity.getStore() ?? state.token);
