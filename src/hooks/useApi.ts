'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ApiState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    reload: () => void;
}

/** Loads JSON from an API route and exposes loading, error (with the server's message) and a reload. Pass null to wait. */
export function useApi<T>(url: string | null, options: { refreshMs?: number } = {}): ApiState<T> {
    const { refreshMs } = options;
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(Boolean(url));
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const latest = useRef(0);
    const silent = useRef(false);   // a background refresh keeps showing the current data instead of a spinner

    useEffect(() => {
        if (!url) return;
        const mine = ++latest.current;
        if (!silent.current) { setLoading(true); setError(null); }
        const quiet = silent.current;
        silent.current = false;
        fetch(url, { cache: 'no-store' })
            .then(async (res) => {
                const body = await res.json().catch(() => null);
                if (!res.ok) throw new Error(body?.message || 'Could not load this');
                if (mine === latest.current) { setData(body as T); setError(null); }
            })
            .catch((e: Error) => { if (mine === latest.current && !quiet) setError(e.message); })
            .finally(() => { if (mine === latest.current) setLoading(false); });
    }, [url, tick]);

    useEffect(() => {
        if (!url || !refreshMs) return;
        const timer = setInterval(() => {
            if (document.visibilityState !== 'visible') return;   // nobody is looking: do not poll
            silent.current = true;
            setTick((t) => t + 1);
        }, refreshMs);
        return () => clearInterval(timer);
    }, [url, refreshMs]);

    const reload = useCallback(() => setTick((t) => t + 1), []);
    return { data, loading, error, reload };
}

/** Sends JSON and returns the parsed body; throws an Error carrying the server's message when the request fails. */
export async function sendJson<T = any>(url: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
    const res = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || 'Something went wrong. Please try again.');
    return data as T;
}
