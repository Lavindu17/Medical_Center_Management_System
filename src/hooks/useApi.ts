'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ApiState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    reload: () => void;
}

/** Loads JSON from an API route and exposes loading, error (with the server's message) and a reload. Pass null to wait. */
export function useApi<T>(url: string | null): ApiState<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(Boolean(url));
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const latest = useRef(0);

    useEffect(() => {
        if (!url) return;
        const mine = ++latest.current;
        setLoading(true);
        setError(null);
        fetch(url, { cache: 'no-store' })
            .then(async (res) => {
                const body = await res.json().catch(() => null);
                if (!res.ok) throw new Error(body?.message || 'Could not load this');
                if (mine === latest.current) setData(body as T);
            })
            .catch((e: Error) => { if (mine === latest.current) setError(e.message); })
            .finally(() => { if (mine === latest.current) setLoading(false); });
    }, [url, tick]);

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
