'use client';

import { useMemo, useState } from 'react';
import { Clock, CornerDownLeft, Copy, Star, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { medicineForm } from '@/lib/medicine-form';
import { parseRxLine } from '@/lib/rx-parse';
import { describeLine, frequencyLabel, hasSlots, quantityFor } from '@/lib/prescription-calc';
import { draftFromPreset, type LineDraft, type Medicine, type PresetLine } from './rx-types';

interface Props {
    medicines: Medicine[];
    favourites: PresetLine[];
    recent: PresetLine[];
    /** How many medicines the last visit's prescription would add (0 hides the button) */
    repeatCount: number;
    onRepeat: () => void;
    /** A complete line: add it */
    onCommit: (draft: LineDraft) => void;
    /** An incomplete line: fill the detailed form with what was understood so far */
    onPrefill: (draft: LineDraft) => void;
}

const defaultDose = (m: Medicine) => { const f = medicineForm(m); return f === 'Syrup' ? '5ml' : f === 'Cream' ? 'Apply' : '1'; };

/** The fast way to add a medicine: type a line such as "amox 500 tds 5d", or tap a favourite, a recent one or "repeat last visit". */
export function RxQuickAdd({ medicines, favourites, recent, repeatCount, onRepeat, onCommit, onPrefill }: Props) {
    const [text, setText] = useState('');
    const [pick, setPick] = useState(0);

    const parsed = useMemo(() => (text.trim() ? parseRxLine(text, medicines) : null), [text, medicines]);
    const chosen = parsed?.matches[Math.min(pick, Math.max(0, parsed.matches.length - 1))] as Medicine | undefined;

    // What the typed line would become, worked out the way it will be saved
    const draft: LineDraft | null = useMemo(() => {
        if (!parsed || !chosen) return null;
        const dose = parsed.dose ?? defaultDose(chosen);
        return {
            med: chosen, dose, times: (parsed.times ? parsed.times(dose) : ['0', '0', '0', '0']) as LineDraft['times'],
            duration: parsed.duration ?? '', asNeeded: parsed.asNeeded, foodTiming: parsed.foodTiming, instructions: '',
        };
    }, [parsed, chosen]);
    const complete = Boolean(draft && hasSlots(draft.times) && draft.duration);
    const preview = draft && complete
        ? (() => {
            const form = medicineForm(draft.med);
            const quantity = quantityFor({ form, times: draft.times, duration: draft.duration, unit: draft.med.unit });
            return describeLine({ form, times: draft.times, duration: draft.duration, quantity, asNeeded: draft.asNeeded, foodTiming: draft.foodTiming });
        })()
        : null;

    const submit = () => {
        if (!draft) return;
        if (complete) onCommit(draft); else onPrefill({ ...draft, duration: draft.duration || '5 days' });
        setText(''); setPick(0);
    };

    const byId = (id: number) => medicines.find((m) => m.id === id);
    const chip = (kind: 'fav' | 'recent', p: PresetLine) => {
        const med = byId(p.medicineId);
        if (!med) return null;
        const label = `${frequencyLabel(p.frequency.split('-'))} ${p.duration}`;
        return (
            <button
                key={`${kind}-${p.medicineId}`}
                type="button"
                onClick={() => onCommit(draftFromPreset(med, p))}
                className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs hover:border-emerald-400 hover:bg-emerald-50"
                title={`Add ${med.name}: ${label}`}
            >
                {kind === 'fav' ? <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-500" aria-hidden /> : <Clock className="h-3 w-3 shrink-0 text-neutral-500" aria-hidden />}
                <span className="truncate font-medium">{med.name}</span>
                <span className="shrink-0 text-neutral-600">{label}</span>
            </button>
        );
    };

    const favIds = new Set(favourites.map((f) => f.medicineId));
    const recentOnly = recent.filter((r) => !favIds.has(r.medicineId)).slice(0, 6);

    return (
        <section aria-label="Quick add" className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
            <div className="space-y-1">
                <Label htmlFor="rx-smart" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-900"><Zap className="h-3.5 w-3.5" aria-hidden /> Quick add</Label>
                <div className="flex gap-2">
                    <Input
                        id="rx-smart"
                        value={text}
                        onChange={(e) => { setText(e.target.value); setPick(0); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                        placeholder="amox 500 tds 5d    para 1 qds prn    sal 5ml tds 1w"
                        autoComplete="off"
                        aria-describedby="rx-smart-help"
                        className="bg-white"
                    />
                    <Button type="button" size="sm" className="h-10 shrink-0" onClick={submit} disabled={!draft}><CornerDownLeft className="mr-1 h-4 w-4" aria-hidden /> {complete ? 'Add' : 'Open'}</Button>
                </div>
                <p id="rx-smart-help" className="text-[11px] text-neutral-600">Medicine, then how often (od, bd, tds, qds, nocte, or 1-0-0-1), a dose if not 1, a duration (5d, 2w), and prn / ac / pc. Press Enter.</p>
            </div>

            {parsed && (
                <div role="status" aria-live="polite" className="space-y-2 text-sm">
                    {parsed.matches.length === 0 ? (
                        <p className="text-neutral-700">No medicine matches &ldquo;{parsed.words.join(' ') || text.trim()}&rdquo;.</p>
                    ) : (
                        <>
                            {parsed.matches.length > 1 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {parsed.matches.map((m, i) => (
                                        <button key={m.id} type="button" onClick={() => setPick(i)} aria-pressed={i === pick}
                                            className={`min-h-8 rounded-md border px-2 text-xs ${i === pick ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-neutral-300 bg-white hover:bg-neutral-50'}`}>{m.name}</button>
                                    ))}
                                </div>
                            )}
                            <p className="rounded-md bg-white p-2 text-neutral-800">
                                <span className="font-semibold">{chosen?.name}</span>
                                {preview ? <> &mdash; {preview}</> : <span className="text-neutral-600"> &mdash; add how often and for how long to add it in one step, or press Enter to finish it in the form below.</span>}
                            </p>
                        </>
                    )}
                </div>
            )}

            {(favourites.length > 0 || recentOnly.length > 0 || repeatCount > 0) && (
                <div className="space-y-2">
                    {repeatCount > 0 && (
                        <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 border-emerald-300 bg-white" onClick={onRepeat}>
                            <Copy className="h-3.5 w-3.5" aria-hidden /> Repeat last visit ({repeatCount} medicine{repeatCount === 1 ? '' : 's'})
                        </Button>
                    )}
                    {favourites.length > 0 && <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">Favourites</p><div className="flex flex-wrap gap-1.5">{favourites.map((f) => chip('fav', f))}</div></div>}
                    {recentOnly.length > 0 && <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">Often prescribed</p><div className="flex flex-wrap gap-1.5">{recentOnly.map((r) => chip('recent', r))}</div></div>}
                </div>
            )}
        </section>
    );
}
