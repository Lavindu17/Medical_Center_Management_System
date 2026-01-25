import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HeartPulse, ShieldCheck, Clock, UserCheck } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <header className="px-6 h-16 flex items-center justify-between bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2 font-bold text-xl text-neutral-900 dark:text-white">
          <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <HeartPulse className="h-5 w-5" />
          </div>
          Sethro Medical
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost">Sign In</Button>
          </Link>
          <Link href="/register">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-24 px-6 text-center space-y-8 bg-white dark:bg-neutral-950">
          <div className="max-w-3xl mx-auto space-y-4">
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
              Healthcare Management <br />
              <span className="text-blue-600">Reimagined</span>
            </h1>
            <p className="text-xl text-neutral-500 dark:text-neutral-400">
              A centralized platform connecting Patients, Doctors, Pharmacists, and Staff for seamless medical care.
            </p>
          </div>
          <div className="flex justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="h-12 px-8 text-lg bg-blue-600 hover:bg-blue-700">
                Book Appointment
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="h-12 px-8 text-lg">
                Staff Portal
              </Button>
            </Link>
          </div>
        </section>

        <section className="py-20 px-6 bg-neutral-50 dark:bg-neutral-900">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-neutral-950 p-8 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 space-y-4">
              <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">Secure Records</h3>
              <p className="text-neutral-500 dark:text-neutral-400">
                Encrypted medical history and patient data with state-of-the-art security protocols.
              </p>
            </div>
            <div className="bg-white dark:bg-neutral-950 p-8 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 space-y-4">
              <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">Real-time Scheduling</h3>
              <p className="text-neutral-500 dark:text-neutral-400">
                Live appointment tracking and queue management systems to reduce waiting times.
              </p>
            </div>
            <div className="bg-white dark:bg-neutral-950 p-8 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 space-y-4">
              <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400">
                <UserCheck className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">Integrated Care</h3>
              <p className="text-neutral-500 dark:text-neutral-400">
                Seamless connection between Lab, Pharmacy, and Doctors for holistic patient care.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 px-6 bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 text-center text-neutral-500">
        <p>© 2026 Sethro Medical Center. All rights reserved.</p>
      </footer>
    </div>
  );
}
