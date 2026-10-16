'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { LEVELS, MODULES, RESOURCE_LIST, RESOURCES, levelsOf, type Level, type ResourceKey } from '@/lib/access/registry';
import { normalise, type GrantMap } from '@/lib/access/defaults';
import { cn } from '@/lib/utils';

const LEVEL_TITLE: Record<Level, string> = { view: 'View', add: 'Add', change: 'Change', approve: 'Approve' };

interface Props {
    /** The ticks being edited */
    value: GrantMap;
    onChange?: (next: GrantMap) => void;
    /** Ticks already given by something else (the role, a profile): shown ticked and locked, with the source in the tooltip */
    inherited?: GrantMap;
    inheritedLabel?: string;
    readOnly?: boolean;
}

/**
 * The tick grid: a row per screen, a column per level. Searchable. Ticking add, change or approve ticks view as well, and
 * unticking view clears the rest, so a screen can never be left in a state that does not make sense.
 */
export function PermissionMatrix({ value, onChange, inherited = {}, inheritedLabel = 'Already given', readOnly }: Props) {
    const [search, setSearch] = useState('');
    const needle = search.trim().toLowerCase();

    const rows = useMemo(() => RESOURCE_LIST.filter((r) => !needle || `${r.label} ${r.description} ${r.module}`.toLowerCase().includes(needle)), [needle]);

    const toggle = (key: ResourceKey, level: Level, on: boolean) => {
        if (!onChange) return;
        const next = { ...(value[key] ?? {}) };
        if (on) { next[level] = true; if (level !== 'view') next.view = true; }
        else { delete next[level]; if (level === 'view') for (const l of LEVELS) delete next[l]; }
        const cleaned = normalise(key, next);
        const out = { ...value };
        if (Object.keys(cleaned).length === 0) delete out[key]; else out[key] = cleaned;
        onChange(out);
    };

    return (
        <div className="space-y-3">
            <div className="relative max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-neutral-500" aria-hidden />
                <Input aria-label="Search screens" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search for a screen or module…" className="pl-9" />
            </div>

            {rows.length === 0 && <p className="text-sm text-neutral-600">No screen matches “{search}”.</p>}

            {MODULES.map((module) => {
                const inModule = rows.filter((r) => r.module === module);
                if (inModule.length === 0) return null;
                return (
                    <section key={module} aria-label={module} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                        <h3 className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-700">{module}</h3>
                        <ul className="divide-y divide-neutral-100">
                            {inModule.map((r) => {
                                const offered = levelsOf(r.key);
                                return (
                                    <li key={r.key} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                                        <div className="min-w-0">
                                            <p className="font-medium text-neutral-900">{r.label}</p>
                                            <p className="text-xs text-neutral-600">{r.description}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 md:justify-end">
                                            {LEVELS.map((level) => {
                                                if (!offered.includes(level)) return <span key={level} className="hidden w-28 md:block" aria-hidden />;
                                                const given = Boolean(inherited[r.key]?.[level]);
                                                const own = Boolean(value[r.key]?.[level]);
                                                const checked = given || own;
                                                const id = `perm-${r.key}-${level}`;
                                                return (
                                                    <label
                                                        key={level}
                                                        htmlFor={id}
                                                        title={given ? `${inheritedLabel}: ${RESOURCES[r.key].levels[level]}` : RESOURCES[r.key].levels[level]}
                                                        className={cn(
                                                            'flex min-h-11 w-full cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs sm:w-[calc(50%-0.25rem)] md:w-28',
                                                            checked ? (given ? 'border-neutral-300 bg-neutral-100 text-neutral-700' : 'border-emerald-300 bg-emerald-50 text-emerald-900') : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
                                                            (readOnly || given) && 'cursor-default',
                                                        )}
                                                    >
                                                        <input
                                                            id={id}
                                                            type="checkbox"
                                                            checked={checked}
                                                            disabled={readOnly || given}
                                                            onChange={(e) => toggle(r.key, level, e.target.checked)}
                                                            className="mt-0.5 h-4 w-4 shrink-0"
                                                            aria-label={`${r.label}: ${RESOURCES[r.key].levels[level]}`}
                                                        />
                                                        <span className="min-w-0">
                                                            <span className="block font-semibold">{LEVEL_TITLE[level]}</span>
                                                            <span className="block leading-tight text-neutral-600">{RESOURCES[r.key].levels[level]}</span>
                                                            {given && <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-neutral-600">{inheritedLabel}</span>}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                );
            })}
        </div>
    );
}
