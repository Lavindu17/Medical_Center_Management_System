"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { HeartPulse, ShieldCheck, Clock, UserCheck, ArrowRight, CheckCircle2, Activity, Stethoscope, Microscope, ChevronRight, Menu, X } from 'lucide-react';
import { asDoctor, initialOf } from '@/lib/names';

interface Doctor {
  name: string;
  specialization: string;
}

interface HomePageUIProps {
  doctors: Doctor[];
  /** The doctors query failed (as opposed to there being none yet) */
  doctorsUnavailable?: boolean;
  /** Where a signed-in visitor's dashboard lives; null when nobody is signed in */
  dashboardHref?: string | null;
}

const NAV_LINKS = [
  { href: '#services', label: 'Services' },
  { href: '#doctors', label: 'Specialists' },
  { href: '#about', label: 'About Us' },
];

export function HomePageUI({ doctors, doctorsUnavailable = false, dashboardHref = null }: HomePageUIProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] font-sans selection:bg-emerald-200 selection:text-emerald-950 overflow-x-hidden">
      {/* Navbar with Glassmorphism */}
      <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-[0_4px_30px_rgba(0,0,0,0.03)] transition-all duration-300">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="h-10 w-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 group-hover:scale-105 transition-all duration-300">
              <HeartPulse className="h-6 w-6" />
            </div>
            <span className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-900 to-emerald-600 tracking-tight">
              Sethro Medical
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-neutral-600" aria-label="Main">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-emerald-600 transition-colors">{l.label}</Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {dashboardHref ? (
              <Link href={dashboardHref}>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all duration-300 rounded-full px-6 font-medium h-10">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden sm:block text-neutral-600 hover:text-emerald-700 font-semibold transition-colors">
                  Sign In
                </Link>
                <Link href="/register">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all duration-300 rounded-full px-6 font-medium h-10">
                    Book Appointment
                  </Button>
                </Link>
              </>
            )}
            <button
              type="button"
              className="md:hidden h-10 w-10 rounded-full flex items-center justify-center text-neutral-600 hover:bg-neutral-100"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav id="mobile-menu" aria-label="Mobile" className="md:hidden border-t border-neutral-100 bg-white px-6 py-4 flex flex-col gap-1 text-neutral-700 font-semibold">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="py-2.5 hover:text-emerald-600">{l.label}</Link>
            ))}
            {!dashboardHref && (
              <Link href="/login" onClick={() => setMenuOpen(false)} className="py-2.5 hover:text-emerald-600">Sign In</Link>
            )}
          </nav>
        )}
      </header>

      <main className="flex-1 pt-20">
        {/* Modern Split Hero Section */}
        <section className="relative overflow-hidden bg-white pt-16 pb-32 lg:pb-48">
          {/* Background Decor */}
          <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[800px] h-[800px] bg-emerald-100/40 rounded-full blur-[120px] -z-10" />
          <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[600px] h-[600px] bg-teal-50/40 rounded-full blur-[100px] -z-10" />
          
          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="space-y-8"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50/80 border border-emerald-100/50 backdrop-blur-sm shadow-sm text-emerald-700 text-sm font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Accepting New Patients
                </div>

                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-neutral-900 leading-[1.1]">
                  Future of <br />
                  <span className="text-emerald-600 relative inline-block mt-2">
                    Healthcare
                    <svg className="absolute w-full h-3 -bottom-2 left-0 text-emerald-200/60 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                      <path d="M0 5 Q 50 10 100 5 t 100 0" stroke="currentColor" strokeWidth="8" strokeLinecap="round" fill="none" />
                    </svg>
                  </span>
                </h1>

                <p className="text-xl text-neutral-600 max-w-lg leading-relaxed font-medium">
                  Book appointments, follow your queue, and keep your prescriptions and lab results together. One platform for patients, doctors, the lab and the pharmacy.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Link href={dashboardHref ? '/patient/book' : '/register'} className="w-full sm:w-auto">
                    <Button size="lg" className="h-14 px-8 text-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all duration-300 rounded-2xl w-full">
                      {dashboardHref ? 'Book an Appointment' : 'Get Started'}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href={dashboardHref ?? '/login'} className="w-full sm:w-auto">
                    <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 rounded-2xl w-full transition-all duration-300 bg-white shadow-sm">
                      {dashboardHref ? 'Go to Dashboard' : 'Sign In'}
                    </Button>
                  </Link>
                </div>

                <div className="flex flex-wrap items-center gap-x-8 gap-y-4 pt-6 text-sm text-neutral-500 font-semibold">
                  {['Online booking', 'Qualified doctors', 'Private, secure records'].map((feature, i) => (
                    <motion.div 
                      key={feature}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + (i * 0.1) }}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      {feature}
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                className="relative lg:h-[650px] flex items-center justify-center"
              >
                {/* Abstract Shapes behind image */}
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-100 to-transparent rounded-[3rem] rotate-3 scale-[0.98] transition-transform hover:rotate-6 duration-700" />
                <div className="absolute inset-0 bg-white/40 backdrop-blur-xl rounded-[3rem] -rotate-3 border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-transform hover:-rotate-6 duration-700" />

                <div className="relative w-full h-[500px] lg:h-full rounded-[2.5rem] overflow-hidden shadow-2xl border-[6px] border-white/80 group">
                  <Image
                    src="/hero-doctors.png"
                    alt="Sethro Medical Team"
                    fill
                    className="object-cover object-top transition-transform duration-1000 group-hover:scale-105"
                    priority
                  />
                  
                  {/* Subtle overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />


                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Bento Box Services Section */}
        <section id="services" className="py-24 bg-neutral-50 relative scroll-mt-20">
          <div className="container mx-auto px-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="text-center max-w-2xl mx-auto mb-16"
            >
              <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-2">Our Capabilities</h2>
              <h3 className="text-4xl font-extrabold text-neutral-900 mb-4">Comprehensive Care</h3>
              <p className="text-neutral-600 text-lg">Integrated healthcare solutions designed for your complete wellbeing.</p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <BentoCard
                icon={Activity}
                title="Advanced Diagnostics"
                description="State-of-the-art laboratory services for accurate, rapid results."
                className="md:col-span-2 bg-white"
                color="emerald"
                delay={0}
              />
              <BentoCard
                icon={Stethoscope}
                title="Specialist Care"
                description="Expert medical consultations with leading healthcare professionals."
                className="bg-white"
                color="blue"
                delay={0.1}
              />
              <BentoCard
                icon={ShieldCheck}
                title="Digital Records"
                description="Secure, accessible health history."
                className="bg-white"
                color="purple"
                delay={0.2}
              />
              <BentoCard
                icon={Activity}
                title="Integrated Pharmacy"
                description="Direct prescription routing and medication management."
                className="md:col-span-2 bg-neutral-900 text-white"
                color="dark"
                delay={0.3}
              />
            </div>
          </div>
        </section>

        {/* Our Doctors Section */}
        <section id="doctors" className="py-32 bg-white relative overflow-hidden scroll-mt-20">
          {/* Subtle grid background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
          
          <div className="container mx-auto px-6 relative z-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6"
            >
              <div className="max-w-2xl">
                <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-2">Medical Team</h2>
                <h3 className="text-4xl font-extrabold text-neutral-900 mb-4">Meet Our Specialists</h3>
                <p className="text-neutral-600 text-lg">Experienced healthcare professionals dedicated to providing exceptional patient care.</p>
              </div>
              <Link href="/patient/book">
                <Button variant="ghost" className="text-emerald-600 font-semibold hover:text-emerald-700 hover:bg-emerald-50">
                  Book with a Specialist <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {doctors.length > 0 ? (
                doctors.map((doctor, index) => (
                  <DoctorCard key={index} doctor={doctor} index={index} />
                ))
              ) : (
                <div className="md:col-span-3 text-center py-12 bg-neutral-50 rounded-3xl border border-neutral-100">
                  <p className="text-neutral-500 font-medium">
                    {doctorsUnavailable
                      ? 'Our list of specialists is temporarily unavailable. Please check back shortly.'
                      : 'Our specialists will be listed here soon.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Feature Grid Section (the "About Us" anchor) */}
        <section id="about" className="py-24 bg-neutral-50 relative scroll-mt-20">
          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div 
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="space-y-6"
              >
                <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-2">Ecosystem</h2>
                <h3 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 leading-tight">
                  A seamless experience for patients and providers.
                </h3>
                <p className="text-neutral-600 text-lg leading-relaxed">
                  Our unified platform breaks down healthcare silos, connecting you directly with your doctors, lab results, and pharmacy in one secure place.
                </p>
                <ul className="space-y-4 pt-4">
                  {[
                    'Instant appointment scheduling without the wait',
                    'Direct access to lab test results as they arrive',
                    'Seamless prescription renewals and pharmacy pickup'
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="mt-1 h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span className="text-neutral-700 font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
              
              <div className="grid sm:grid-cols-2 gap-6 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-emerald-200/40 via-teal-100/20 to-transparent blur-3xl -z-10 rounded-full" />
                <FeatureMiniCard icon={ShieldCheck} title="Private & Secure" delay={0.1} />
                <FeatureMiniCard icon={Clock} title="Online Queue Numbers" className="sm:mt-12" delay={0.2} />
                <FeatureMiniCard icon={UserCheck} title="Holistic Approach" delay={0.3} />
                <FeatureMiniCard icon={Microscope} title="Lab Results Online" className="sm:mt-12" delay={0.4} />
              </div>
            </div>
          </div>
        </section>

        {/* Modern CTA Section */}
        <section className="py-32 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-emerald-950" />
          <div className="container mx-auto relative z-10">
            <div className="max-w-4xl mx-auto text-center space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 mb-8 shadow-2xl">
                  <HeartPulse className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight mb-6">
                  Ready to manage your <br className="hidden md:block" />
                  <span className="text-emerald-400">healthcare in one place?</span>
                </h2>
                <p className="text-emerald-100/80 text-xl max-w-2xl mx-auto mb-10">
                  Create an account to book appointments, follow your queue number, and see your prescriptions and lab results in one place.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <Link href="/register">
                    <Button size="lg" className="h-14 px-10 text-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 rounded-full font-bold shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:shadow-[0_0_60px_rgba(16,185,129,0.5)] transition-all duration-300 w-full sm:w-auto">
                      Join Us Today
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button size="lg" variant="outline" className="h-14 px-10 text-lg bg-white/5 border-white/20 text-white hover:bg-white/10 rounded-full font-bold backdrop-blur-sm transition-all duration-300 w-full sm:w-auto">
                      Sign In
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-neutral-200 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2.5 font-bold text-xl text-neutral-900">
              <div className="h-8 w-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <HeartPulse className="h-5 w-5 text-emerald-600" />
              </div>
              Sethro Medical
            </div>
            <p className="text-neutral-500 text-sm font-medium">
              © {new Date().getFullYear()} Sethro Medical Center. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm font-medium text-neutral-500">
              <Link href="#services" className="hover:text-emerald-600 transition-colors">Services</Link>
              <Link href="/login" className="hover:text-emerald-600 transition-colors">Sign In</Link>
              <Link href="/register" className="hover:text-emerald-600 transition-colors">Create Account</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Subcomponents

function BentoCard({ icon: Icon, title, description, className, color, delay }: any) {
  const isDark = color === 'dark';
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay, duration: 0.5 }}
      className={`p-8 rounded-3xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden relative group ${isDark ? 'border-neutral-800' : 'border-neutral-200'} ${className}`}
    >
      <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-6 shadow-sm transition-transform duration-300 group-hover:scale-110 
        ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}
      >
        <Icon className="h-7 w-7" />
      </div>
      <h3 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-neutral-900'}`}>{title}</h3>
      <p className={`leading-relaxed font-medium ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>{description}</p>
      
      {/* Decorative gradient corner */}
      {!isDark && (
        <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-gradient-to-tl from-emerald-100/50 to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      )}
    </motion.div>
  );
}

function DoctorCard({ doctor, index }: { doctor: Doctor, index: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="bg-white p-8 rounded-3xl border border-neutral-200 hover:shadow-2xl hover:shadow-emerald-900/5 transition-all duration-500 group"
    >
      <div className="w-24 h-24 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full mb-6 mx-auto flex items-center justify-center text-emerald-800 text-3xl font-extrabold shadow-inner relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {initialOf(doctor.name)}
      </div>
      <h3 className="text-xl font-bold text-neutral-900 text-center mb-1">{asDoctor(doctor.name)}</h3>
      <p className="text-emerald-600 text-center font-semibold text-sm uppercase tracking-wider">{doctor.specialization}</p>
    </motion.div>
  );
}

function FeatureMiniCard({ icon: Icon, title, className, delay }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.4 }}
      className={`bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-lg transition-all ${className}`}
    >
      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center mb-4 border border-emerald-100/50">
        <Icon className="h-6 w-6 text-emerald-600" />
      </div>
      <h4 className="text-lg font-bold text-neutral-900">{title}</h4>
    </motion.div>
  );
}
