import Link from 'next/link';

export default function UnauthorizedPage() {
    return (
        <main className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
            <div className="max-w-md text-center space-y-4">
                <p className="text-sm font-semibold text-emerald-600">403</p>
                <h1 className="text-2xl font-bold text-neutral-900">You don&apos;t have access to this page</h1>
                <p className="text-neutral-500 text-sm">
                    This part of the system is for a different kind of account. Staff use the staff area and patients use the patient portal. Sign in with the right account, or go back to the home page.
                </p>
                <div className="flex justify-center gap-3">
                    <Link href="/login" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">Sign in</Link>
                    <Link href="/" className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">Home</Link>
                </div>
            </div>
        </main>
    );
}
