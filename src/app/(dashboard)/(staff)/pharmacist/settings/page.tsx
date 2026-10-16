import { redirect } from 'next/navigation';

// Settings moved to the Account page, which is the same for every role.
export default function SettingsRedirect() {
    redirect('/pharmacist/account');
}
