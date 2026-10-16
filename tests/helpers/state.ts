import { AsyncLocalStorage } from 'async_hooks';

export const state: { token: string | null; /** true: use the real permission lookup (against whatever the mocked database returns) */ realAccess: boolean } = { token: null, realAccess: false };

// Per-request identity for truly parallel calls: the cookie mock prefers this over the shared `state.token`.
export const identity = new AsyncLocalStorage<string | null>();
export const currentToken = () => (identity.getStore() ?? state.token);

// Cookies the code under test tried to set (login, change-password), newest last.
export const setCookies: { name: string; value: string; options: Record<string, unknown> }[] = [];
