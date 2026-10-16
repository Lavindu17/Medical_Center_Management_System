'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Search, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state-views';
import { useApi } from '@/hooks/useApi';
import { ROLE_LABEL } from '@/lib/hr-format';

interface Employee {
    id: number; name: string; email: string; role: string; employeeNo: string | null; department: string | null; designation: string | null; joinDate: string | null; status: string;
    today: { status: string } | null;
}

export default function EmployeesPage() {
    const [q, setQ] = useState('');
    const [role, setRole] = useState('');
    const [inactive, setInactive] = useState(false);
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (role) params.set('role', role);
    if (inactive) params.set('inactive', '1');
    const { data, loading, error, reload } = useApi<{ employees: Employee[] }>(`/api/hr/employees?${params}`);

    return (
        <div className="space-y-5">
            <PageHeader title="Employees" description="Everyone on staff, with their HR details. Open a person for their profile, leave balances and history." />
            <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden />
                    <Input aria-label="Search employees" type="search" placeholder="Search by name, email, number or department" className="h-11 pl-10 text-base md:text-sm" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <select aria-label="Filter by role" className="h-11 rounded-md border border-input bg-white px-3 text-base md:text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="">All roles</option>
                    {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm text-neutral-700"><input type="checkbox" className="h-4 w-4" checked={inactive} onChange={(e) => setInactive(e.target.checked)} /> Include inactive employees</label>

            {loading && !data ? <LoadingState label="Loading employees…" /> : error || !data ? <ErrorState title="Could not load employees" description={error ?? undefined} onRetry={reload} /> : data.employees.length === 0 ? (
                <EmptyState icon={Users} title="No employees found" description="Staff accounts are created under Admin, User Management." />
            ) : (
                <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[var(--shadow-card)]">
                    {data.employees.map((e) => (
                        <li key={e.id}>
                            <Link href={`/hr/employees/${e.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-neutral-50">
                                <div className="min-w-0">
                                    <p className="font-semibold text-neutral-900">{e.name} {e.status === 'INACTIVE' && <span className="ml-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700">inactive</span>}</p>
                                    <p className="text-xs text-neutral-600">{ROLE_LABEL[e.role] ?? e.role}{e.designation ? ` · ${e.designation}` : ''}{e.department ? ` · ${e.department}` : ''}{e.employeeNo ? ` · #${e.employeeNo}` : ''}</p>
                                </div>
                                {e.today && e.status === 'ACTIVE' && <StatusBadge status={e.today.status} kind="attendance" size="sm" />}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
