import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/api-auth';
import { HomePageUI } from '@/components/home/HomePageUI';
import type { Role } from '@/types';

interface Doctor {
  name: string;
  specialization: string;
}

const DASHBOARD: Record<Role, string> = {
  PATIENT: '/patient',
  DOCTOR: '/doctor',
  PHARMACIST: '/pharmacist',
  LAB_ASSISTANT: '/lab-assistant',
  RECEPTIONIST: '/receptionist',
  ADMIN: '/admin',
};

// Reads the visitor's session cookie, so this page is rendered per request (never frozen at build time with
// whatever doctors existed then, or with an empty list if the database was down during the build).
export default async function Home() {
  let doctors: Doctor[] = [];
  let doctorsUnavailable = false;
  try {
    doctors = await query<Doctor[]>(
      `SELECT u.name, d.specialization
       FROM users u
       JOIN doctors d ON u.id = d.user_id
       WHERE u.role = 'DOCTOR'
       ORDER BY u.name ASC
       LIMIT 3`
    );
  } catch (error) {
    console.error('Home: could not load doctors:', error);
    doctorsUnavailable = true;
  }

  // Signed-in visitors get a way back to their own dashboard instead of "Sign in" / "Register"
  const user = await getSessionUser().catch(() => null);

  return (
    <HomePageUI
      doctors={doctors}
      doctorsUnavailable={doctorsUnavailable}
      dashboardHref={user ? DASHBOARD[user.role] : null}
    />
  );
}
