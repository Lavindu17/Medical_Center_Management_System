import { StaffShell } from '@/components/StaffShell';

export const dynamic = 'force-dynamic';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
    return <StaffShell>{children}</StaffShell>;
}
