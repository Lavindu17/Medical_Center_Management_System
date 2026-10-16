'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Plus, RotateCcw, Save, Search, Trash2, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state-views';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { PermissionMatrix } from '@/components/access/PermissionMatrix';
import { useApi, sendJson } from '@/hooks/useApi';
import { RESOURCES, RESOURCE_LIST, levelsOf, type ResourceKey } from '@/lib/access/registry';
import { mergeGrants, type GrantMap } from '@/lib/access/defaults';
import { conflictsIn } from '@/lib/access/conflicts';
import { ROLE_LABEL } from '@/lib/hr-format';

interface StaffUser { id: number; name: string; email: string; role: string; profiles: string[] }
interface Detail { user: StaffUser; role: GrantMap; assigned: { id: number; name: string }[]; personal: GrantMap; effective: GrantMap; warnings: string[] }
interface RoleProfile { role: string; grants: GrantMap; customised: boolean; stored: boolean; people: number }
interface CustomProfile { id: number; name: string; description: string | null; people: number; grants: GrantMap }
interface Profiles { roles: RoleProfile[]; custom: CustomProfile[]; ready: boolean }

const count = (g: GrantMap) => Object.values(g).reduce((n, x) => n + Object.keys(x ?? {}).length, 0);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export default function AccessControlPage() {
    const [tab, setTab] = useState('people');
    const profiles = useApi<Profiles>('/api/admin/access/profiles');

    return (
        <div className="space-y-6">
            <PageHeader title="Access control" description="Choose what each person can see and do. Tick View, Add, Change or Approve for each screen. Changes apply on the person's next click." />
            {profiles.data && !profiles.data.ready && (
                <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> The permission tables are missing (22_access_control.sql). Until they exist nobody on staff can open anything except what an administrator is given here.
                </p>
            )}
            <SegmentedTabs label="Access control sections" value={tab} onChange={setTab} items={[{ value: 'people', label: 'People' }, { value: 'profiles', label: 'Profiles and roles' }, { value: 'screens', label: 'Who can use a screen' }]} />
            {tab === 'people' && <PeopleTab profiles={profiles.data?.custom ?? []} />}
            {tab === 'profiles' && (profiles.loading && !profiles.data ? <LoadingState /> : profiles.error && !profiles.data ? <ErrorState title="Could not load profiles" description={profiles.error} onRetry={profiles.reload} /> : <ProfilesTab data={profiles.data!} reload={profiles.reload} />)}
            {tab === 'screens' && <ScreensTab />}
        </div>
    );
}

/* ---------------------------------------------------------------- People */

function PeopleTab({ profiles }: { profiles: CustomProfile[] }) {
    const [q, setQ] = useState('');
    const [term, setTerm] = useState('');
    const [selected, setSelected] = useState<number | null>(null);
    useEffect(() => { const t = setTimeout(() => setTerm(q), 250); return () => clearTimeout(t); }, [q]);

    const list = useApi<StaffUser[]>(`/api/admin/access/users?q=${encodeURIComponent(term)}`);

    return (
        <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <section aria-label="Staff" className="space-y-3">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-neutral-500" aria-hidden />
                    <Input aria-label="Search people" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email…" className="pl-9" />
                </div>
                {list.loading && !list.data ? <LoadingState label="Loading staff…" /> : list.error && !list.data ? <ErrorState title="Could not load staff" description={list.error} onRetry={list.reload} /> : (
                    <ul className="max-h-[70vh] divide-y divide-neutral-100 overflow-y-auto rounded-xl border border-neutral-200 bg-white">
                        {(list.data ?? []).length === 0 && <li className="p-4 text-sm text-neutral-600">Nobody matches.</li>}
                        {(list.data ?? []).map((u) => (
                            <li key={u.id}>
                                <button type="button" onClick={() => setSelected(u.id)} aria-pressed={selected === u.id}
                                    className={`flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left ${selected === u.id ? 'bg-emerald-50' : 'hover:bg-neutral-50'}`}>
                                    <UserRound className="h-5 w-5 shrink-0 text-neutral-500" aria-hidden />
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold text-neutral-900">{u.name}</span>
                                        <span className="block truncate text-xs text-neutral-600">{ROLE_LABEL[u.role] ?? u.role}{u.profiles.length ? ` + ${u.profiles.join(', ')}` : ''}</span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section aria-label="Their access">
                {selected === null ? <EmptyState icon={UserRound} title="Pick a person" description="Search for someone on the left to see and change what they can do." /> : <PersonEditor key={selected} id={selected} profiles={profiles} onSaved={list.reload} />}
            </section>
        </div>
    );
}

function PersonEditor({ id, profiles, onSaved }: { id: number; profiles: CustomProfile[]; onSaved: () => void }) {
    const detail = useApi<Detail>(`/api/admin/access/users/${id}`);
    const [profileIds, setProfileIds] = useState<number[]>([]);
    const [personal, setPersonal] = useState<GrantMap>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!detail.data) return;
        setProfileIds(detail.data.assigned.map((p) => p.id));
        setPersonal(detail.data.personal);
    }, [detail.data]);

    const d = detail.data;
    const given = useMemo(() => {
        if (!d) return {};
        return profiles.filter((p) => profileIds.includes(p.id)).reduce((acc, p) => mergeGrants(acc, p.grants), d.role);
    }, [d, profiles, profileIds]);
    const total = useMemo(() => mergeGrants(given, personal), [given, personal]);
    const warnings = useMemo(() => conflictsIn(total), [total]);
    const dirty = d ? !same([...profileIds].sort(), d.assigned.map((p) => p.id).sort()) || !same(personal, d.personal) : false;

    if (detail.loading && !d) return <LoadingState label="Loading access…" />;
    if (detail.error && !d) return <ErrorState title="Could not load this person" description={detail.error} onRetry={detail.reload} />;
    if (!d) return null;

    const save = async () => {
        setSaving(true);
        try {
            await sendJson(`/api/admin/access/users/${id}`, 'PUT', { profileIds, personal });
            toast.success('Saved. It applies on their next click.');
            detail.reload(); onSaved();
        } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
                <div>
                    <h2 className="text-lg font-bold text-neutral-900">{d.user.name}</h2>
                    <p className="text-sm text-neutral-600">{d.user.email} · starts from the <strong>{ROLE_LABEL[d.user.role] ?? d.user.role}</strong> role · {count(total)} permissions in all</p>
                </div>
                <div className="flex items-center gap-3">
                    {dirty && <span className="text-sm font-medium text-amber-800">Unsaved changes</span>}
                    <Button onClick={save} disabled={saving || !dirty} className="bg-emerald-600 hover:bg-emerald-700"><Save className="mr-2 h-4 w-4" aria-hidden /> {saving ? 'Saving…' : 'Save'}</Button>
                </div>
            </div>

            {warnings.length > 0 && (
                <div role="status" className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" aria-hidden /> Worth a second look (allowed, but check it is intended)</p>
                    <ul className="list-disc pl-6">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                </div>
            )}

            <fieldset className="rounded-xl border border-neutral-200 bg-white p-4">
                <legend className="px-1 text-sm font-semibold text-neutral-900">Profiles given to this person</legend>
                {profiles.length === 0 ? <p className="text-sm text-neutral-600">No profiles yet. Create one on the “Profiles and roles” tab, for example “Pharmacist with billing”.</p> : (
                    <div className="flex flex-wrap gap-2">
                        {profiles.map((p) => (
                            <label key={p.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 px-3 text-sm hover:bg-neutral-50">
                                <input type="checkbox" checked={profileIds.includes(p.id)} onChange={(e) => setProfileIds((ids) => (e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id)))} className="h-4 w-4" />
                                {p.name}
                            </label>
                        ))}
                    </div>
                )}
            </fieldset>

            <div>
                <h3 className="mb-1 text-sm font-semibold text-neutral-900">This person&apos;s own permissions</h3>
                <p className="mb-3 text-sm text-neutral-600">Grey ticks come from their role or a profile and are changed there. Tick anything else this person needs on top.</p>
                <PermissionMatrix value={personal} onChange={setPersonal} inherited={given} inheritedLabel="From role or profile" />
            </div>
        </div>
    );
}

/* -------------------------------------------------------------- Profiles */

function ProfilesTab({ data, reload }: { data: Profiles; reload: () => void }) {
    const [pick, setPick] = useState<{ kind: 'role'; role: string } | { kind: 'custom'; id: number } | { kind: 'new' } | null>(null);
    return (
        <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <section aria-label="Profiles" className="space-y-4">
                <div>
                    <h2 className="mb-1 text-sm font-semibold text-neutral-900">Roles (what each job has)</h2>
                    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                        {data.roles.map((r) => (
                            <li key={r.role}>
                                <button type="button" onClick={() => setPick({ kind: 'role', role: r.role })} aria-pressed={pick?.kind === 'role' && pick.role === r.role}
                                    className={`flex min-h-12 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${pick?.kind === 'role' && pick.role === r.role ? 'bg-emerald-50' : 'hover:bg-neutral-50'}`}>
                                    <span><span className="font-semibold">{ROLE_LABEL[r.role] ?? r.role}</span><span className="block text-xs text-neutral-600">{r.people} {r.people === 1 ? 'person' : 'people'}</span></span>
                                    {!r.stored ? <Badge variant="outline" className="border-amber-400 text-amber-800">Nothing stored</Badge> : r.customised ? <Badge variant="outline">Customised</Badge> : null}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <div className="mb-1 flex items-center justify-between"><h2 className="text-sm font-semibold text-neutral-900">Your profiles</h2>
                        <Button size="sm" variant="outline" onClick={() => setPick({ kind: 'new' })}><Plus className="mr-1 h-4 w-4" aria-hidden /> New</Button></div>
                    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                        {data.custom.length === 0 && <li className="p-3 text-sm text-neutral-600">None yet.</li>}
                        {data.custom.map((p) => (
                            <li key={p.id}>
                                <button type="button" onClick={() => setPick({ kind: 'custom', id: p.id })} aria-pressed={pick?.kind === 'custom' && pick.id === p.id}
                                    className={`flex min-h-12 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${pick?.kind === 'custom' && pick.id === p.id ? 'bg-emerald-50' : 'hover:bg-neutral-50'}`}>
                                    <span className="min-w-0"><span className="block truncate font-semibold">{p.name}</span><span className="text-xs text-neutral-600">{p.people} {p.people === 1 ? 'person' : 'people'}</span></span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <section aria-label="Editor">
                {!pick ? <EmptyState icon={UserRound} title="Pick a role or a profile" description="Roles are what each job starts with at this site. Profiles are extra sets you can give to people, such as “Pharmacist with billing”." />
                    : pick.kind === 'role' ? <RoleEditor key={pick.role} role={data.roles.find((r) => r.role === pick.role)!} reload={reload} />
                    : pick.kind === 'custom' ? <ProfileEditor key={pick.id} profile={data.custom.find((p) => p.id === pick.id)!} reload={() => { reload(); }} onGone={() => setPick(null)} />
                    : <ProfileEditor key="new" profile={null} reload={reload} onGone={() => setPick(null)} onCreated={(id) => setPick({ kind: 'custom', id })} />}
            </section>
        </div>
    );
}

function RoleEditor({ role, reload }: { role: RoleProfile; reload: () => void }) {
    const confirm = useConfirm();
    const [grants, setGrants] = useState<GrantMap>(role.grants);
    const [saving, setSaving] = useState(false);
    const dirty = !same(grants, role.grants);
    const warnings = useMemo(() => conflictsIn(grants), [grants]);

    const save = async () => {
        setSaving(true);
        try { await sendJson(`/api/admin/access/roles/${role.role}`, 'PUT', { grants }); toast.success(`Saved. Everyone with the ${ROLE_LABEL[role.role] ?? role.role} role is affected on their next click.`); reload(); }
        catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
    };
    const reset = async () => {
        if (role.stored && !await confirm({ title: `Reset ${ROLE_LABEL[role.role] ?? role.role} to its starting point?`, description: 'Everyone with this role goes back to the standard access for the job.', confirmLabel: 'Reset', cancelLabel: 'Keep my changes' })) return;
        try { await sendJson(`/api/admin/access/roles/${role.role}`, 'DELETE'); toast.success(role.stored ? 'Back to the starting point' : 'Starting permissions written'); reload(); } catch (e: any) { toast.error(e.message); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
                <div><h2 className="text-lg font-bold text-neutral-900">{ROLE_LABEL[role.role] ?? role.role}</h2>
                    <p className="text-sm text-neutral-600">What everyone with this job starts with. {role.people} {role.people === 1 ? 'person has' : 'people have'} it. {role.role === 'ADMIN' && 'Administrators can always change access, so nobody gets locked out.'}</p></div>
                <div className="flex items-center gap-2">
                    {(role.customised || !role.stored) && <Button variant="outline" onClick={reset}><RotateCcw className="mr-2 h-4 w-4" aria-hidden /> {role.stored ? 'Reset to starting point' : 'Write the starting permissions'}</Button>}
                    <Button onClick={save} disabled={saving || !dirty} className="bg-emerald-600 hover:bg-emerald-700"><Save className="mr-2 h-4 w-4" aria-hidden /> {saving ? 'Saving…' : 'Save'}</Button>
                </div>
            </div>
            {!role.stored && <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Nothing is stored for this role, so {role.people === 1 ? 'the person with it cannot' : 'people with it cannot'} open anything yet. Tick what the job needs and save, or write the starting permissions.</p>}
            {warnings.length > 0 && <ul role="status" className="list-disc space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 pl-8 text-sm text-amber-900">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
            <PermissionMatrix value={grants} onChange={setGrants} />
        </div>
    );
}

function ProfileEditor({ profile, reload, onGone, onCreated }: { profile: CustomProfile | null; reload: () => void; onGone: () => void; onCreated?: (id: number) => void }) {
    const confirm = useConfirm();
    const [name, setName] = useState(profile?.name ?? '');
    const [description, setDescription] = useState(profile?.description ?? '');
    const [grants, setGrants] = useState<GrantMap>(profile?.grants ?? {});
    const [saving, setSaving] = useState(false);
    const dirty = !profile || name !== profile.name || description !== (profile.description ?? '') || !same(grants, profile.grants);
    const warnings = useMemo(() => conflictsIn(grants), [grants]);

    const save = async () => {
        setSaving(true);
        try {
            if (profile) { await sendJson(`/api/admin/access/profiles/${profile.id}`, 'PUT', { name, description, grants }); toast.success('Saved'); reload(); }
            else { const res = await sendJson<{ id: number }>('/api/admin/access/profiles', 'POST', { name, description, grants }); toast.success('Profile created'); reload(); onCreated?.(res.id); }
        } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
    };
    const remove = async () => {
        if (!profile || !await confirm({ title: `Delete “${profile.name}”?`, description: profile.people > 0 ? `${profile.people} ${profile.people === 1 ? 'person loses' : 'people lose'} what it gave them.` : 'Nobody has it.', confirmLabel: 'Delete', cancelLabel: 'Keep it', destructive: true })) return;
        try { await sendJson(`/api/admin/access/profiles/${profile.id}`, 'DELETE'); toast.success('Deleted'); reload(); onGone(); } catch (e: any) { toast.error(e.message); }
    };

    return (
        <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-2">
                <div className="space-y-1"><Label htmlFor="p-name">Name</Label><Input id="p-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Pharmacist with billing" /></div>
                <div className="space-y-1"><Label htmlFor="p-desc">Description (optional)</Label><Input id="p-desc" value={description} maxLength={255} onChange={(e) => setDescription(e.target.value)} placeholder="Handles payments at the pharmacy counter" /></div>
                <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                    <Button onClick={save} disabled={saving || !dirty || name.trim().length < 2} className="bg-emerald-600 hover:bg-emerald-700"><Save className="mr-2 h-4 w-4" aria-hidden /> {saving ? 'Saving…' : profile ? 'Save' : 'Create profile'}</Button>
                    {profile && <Button variant="outline" onClick={remove} className="text-red-700"><Trash2 className="mr-2 h-4 w-4" aria-hidden /> Delete</Button>}
                    {profile && <span className="text-sm text-neutral-600">{profile.people} {profile.people === 1 ? 'person has' : 'people have'} this profile</span>}
                </div>
            </div>
            {warnings.length > 0 && <ul role="status" className="list-disc space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 pl-8 text-sm text-amber-900">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
            <PermissionMatrix value={grants} onChange={setGrants} />
        </div>
    );
}

/* --------------------------------------------------------------- Screens */

function ScreensTab() {
    const [key, setKey] = useState<ResourceKey>(RESOURCE_LIST[0].key);
    const [search, setSearch] = useState('');
    const matches = RESOURCE_LIST.filter((r) => !search.trim() || `${r.label} ${r.module}`.toLowerCase().includes(search.trim().toLowerCase()));
    const who = useApi<{ people: { id: number; name: string; email: string; role: string; levels: string[] }[] }>(`/api/admin/access/screens/${encodeURIComponent(key)}`);

    return (
        <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <section aria-label="Screens" className="space-y-3">
                <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-neutral-500" aria-hidden />
                    <Input aria-label="Search screens" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search for a screen…" className="pl-9" /></div>
                <ul className="max-h-[70vh] divide-y divide-neutral-100 overflow-y-auto rounded-xl border border-neutral-200 bg-white">
                    {matches.map((r) => (
                        <li key={r.key}><button type="button" onClick={() => setKey(r.key)} aria-pressed={key === r.key}
                            className={`min-h-12 w-full px-3 py-2 text-left text-sm ${key === r.key ? 'bg-emerald-50' : 'hover:bg-neutral-50'}`}>
                            <span className="block font-semibold">{r.label}</span><span className="text-xs text-neutral-600">{r.module}</span></button></li>
                    ))}
                </ul>
            </section>
            <section aria-label="Who has it">
                <div className="mb-3 rounded-xl border border-neutral-200 bg-white p-4"><h2 className="text-lg font-bold text-neutral-900">{RESOURCES[key].label}</h2><p className="text-sm text-neutral-600">{RESOURCES[key].description}</p></div>
                {who.loading && !who.data ? <LoadingState /> : who.error ? <ErrorState title="Could not load" description={who.error} onRetry={who.reload} /> : (
                    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                        {who.data!.people.length === 0 && <li className="p-4 text-sm text-neutral-600">Nobody can use this screen.</li>}
                        {who.data!.people.map((p) => (
                            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                                <span><span className="block font-semibold text-neutral-900">{p.name}</span><span className="text-xs text-neutral-600">{ROLE_LABEL[p.role] ?? p.role}</span></span>
                                <span className="flex flex-wrap gap-1.5">{levelsOf(key).filter((l) => p.levels.includes(l)).map((l) => <Badge key={l} variant="outline">{RESOURCES[key].levels[l]}</Badge>)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
