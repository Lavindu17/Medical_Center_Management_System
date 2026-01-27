import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { HeartPulse, ShieldCheck, Clock, UserCheck, ArrowRight, CheckCircle2, Phone } from 'lucide-react';
import { query } from '@/lib/db';

interface Doctor {
  name: string;
  specialization: string;
}

export default async function Home() {
  // Fetch real doctors from database
  const doctors = await query<Doctor[]>(
    `SELECT u.name, d.specialization 
     FROM users u 
     JOIN doctors d ON u.id = d.user_id 
     WHERE u.role = 'DOCTOR'
     LIMIT 3`
  ).catch(() => []);
  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Navbar with Glassmorphism */}
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-emerald-100/50 supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5 group cursor-pointer">
            <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 group-hover:shadow-emerald-300 transition-all duration-300">
              <HeartPulse className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-800 to-emerald-600 tracking-tight">
              Sethro Medical
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-600">
            <Link href="#doctors" className="hover:text-emerald-600 transition-colors">Doctors</Link>
            <Link href="#services" className="hover:text-emerald-600 transition-colors">Services</Link>
            <Link href="#about" className="hover:text-emerald-600 transition-colors">About Us</Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden sm:block text-neutral-600 hover:text-emerald-700 font-medium transition-colors">
              Log In
            </Link>
            <Link href="/register">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transition-all duration-300 rounded-full px-6">
                Book Appointment
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-20">
        {/* Modern Split Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/50 to-white pt-16 pb-32">
          {/* Background Decor */}
          <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[800px] h-[800px] bg-emerald-100/40 rounded-full blur-3xl -z-10" />
          <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[600px] h-[600px] bg-blue-50/40 rounded-full blur-3xl -z-10" />

          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-emerald-100 shadow-sm text-emerald-700 text-sm font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Accepting New Patients
                </div>

                <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-neutral-900 leading-[1.1]">
                  Your Health, <br />
                  <span className="text-emerald-600 relative">
                    Our Priority
                    <svg className="absolute w-full h-3 -bottom-1 left-0 text-emerald-200 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                      <path d="M0 5 Q 50 10 100 5 t 100 0" stroke="currentColor" strokeWidth="8" fill="none" />
                    </svg>
                  </span>
                </h1>

                <p className="text-xl text-neutral-600 max-w-lg leading-relaxed">
                  Experience world-class healthcare with our integrated platform. Connect with top specialists, manage prescriptions, and track your health journey.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Link href="/register">
                    <Button size="lg" className="h-14 px-8 text-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-200 hover:shadow-emerald-300 transition-all rounded-2xl w-full sm:w-auto">
                      Get Started
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-2xl w-full sm:w-auto">
                    <Phone className="mr-2 h-5 w-5" />
                    Emergency Call
                  </Button>
                </div>

                <div className="flex items-center gap-8 pt-6 text-sm text-neutral-500 font-medium">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    24/7 Support
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    Expert Doctors
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    Secure Data
                  </div>
                </div>
              </div>

              <div className="relative lg:h-[700px] flex items-center justify-center animate-in fade-in slide-in-from-right-8 duration-1000 delay-200">
                {/* Abstract Shapes behind image */}
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-100 to-transparent rounded-[3rem] rotate-3 scale-95" />
                <div className="absolute inset-0 bg-white/50 backdrop-blur-sm rounded-[3rem] -rotate-3 border border-white/50 shadow-2xl" />

                <div className="relative w-full h-full rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white">
                  <Image
                    src="/hero-doctors.png"
                    alt="Sethro Medical Team"
                    fill
                    className="object-cover object-top hover:scale-105 transition-transform duration-700"
                    priority
                  />

                  {/* Floating Badge */}
                  <div className="absolute bottom-8 left-8 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-emerald-50 max-w-xs animate-in slide-in-from-bottom-4 delay-500 duration-700">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex -space-x-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-8 w-8 rounded-full border-2 border-white bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">
                            {String.fromCharCode(64 + i)}
                          </div>
                        ))}
                      </div>
                      <div className="text-sm font-bold text-neutral-900">1000+ Patients</div>
                    </div>
                    <p className="text-xs text-neutral-500">Trusted by hundreds of families for their daily healthcare needs.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section id="services" className="py-24 bg-white">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-4xl font-bold text-neutral-900 mb-4">Our Services</h2>
              <p className="text-neutral-600">Comprehensive healthcare solutions tailored to your needs</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <ServiceCard
                icon="💊"
                title="Pharmacy"
                description="Access to a wide range of medications with expert pharmaceutical care"
                color="emerald"
              />
              <ServiceCard
                icon="👨‍⚕️"
                title="Consultation"
                description="Expert medical consultations with experienced healthcare professionals"
                color="blue"
              />
              <ServiceCard
                icon="🔬"
                title="Lab Tests"
                description="State-of-the-art laboratory services for accurate diagnostics"
                color="purple"
              />
            </div>
          </div>
        </section>

        {/* Our Doctors Section */}
        <section id="doctors" className="py-24 bg-gradient-to-b from-emerald-50/30 to-white">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-4xl font-bold text-neutral-900 mb-4">Meet Our Doctors</h2>
              <p className="text-neutral-600">Experienced healthcare professionals dedicated to your wellbeing</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {doctors.length > 0 ? (
                doctors.map((doctor, index) => (
                  <DoctorCard key={index} name={doctor.name} specialization={doctor.specialization} />
                ))
              ) : (
                <div className="col-span-3 text-center text-neutral-500">
                  <p>No doctors available at the moment.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* About Us Section */}
        <section id="about" className="py-24 bg-gradient-to-br from-emerald-900 to-emerald-800 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />

          <div className="container mx-auto px-6 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-4xl font-bold mb-6">About Sethro Medical Center</h2>
                <p className="text-emerald-100 text-lg leading-relaxed mb-6">
                  We are committed to providing exceptional healthcare services with a patient-first approach.
                  Our state-of-the-art facilities and experienced medical professionals ensure you receive
                  the best possible care.
                </p>
                <p className="text-emerald-100 text-lg leading-relaxed">
                  With years of experience and thousands of satisfied patients, we continue to set the
                  standard for quality healthcare in our community.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <StatCard number="15+" label="Years of Service" />
                <StatCard number="50+" label="Expert Doctors" />
                <StatCard number="1000+" label="Happy Patients" />
                <StatCard number="365Day" label="Emergency Care" />
              </div>
            </div>
          </div>
        </section>

        {/* Feature Cards Section */}
        <section className="py-24 bg-white relative">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold text-neutral-900 mb-4">Comprehensive Care Ecosystem</h2>
              <p className="text-neutral-600">Our platform integrates every aspect of healthcare to provide a seamless experience for patients and providers.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard
                icon={ShieldCheck}
                title="Secure Health Records"
                description="Bank-grade encryption for all your medical history. Access your data anytime, anywhere with complete peace of mind."
                className="bg-emerald-50/50 border-emerald-100"
                iconColor="text-emerald-600"
              />
              <FeatureCard
                icon={Clock}
                title="Real-time Scheduling"
                description="Smart appointment management system that reduces wait times and optimizes doctor availability."
                className="bg-blue-50/50 border-blue-100"
                iconColor="text-blue-600"
              />
              <FeatureCard
                icon={UserCheck}
                title="Collaborative Care"
                description="Seamless communication between doctors, pharmacists, and lab technicians for holistic treatment."
                className="bg-purple-50/50 border-purple-100"
                iconColor="text-purple-600"
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-6">
          <div className="container mx-auto">
            <div className="bg-emerald-900 rounded-[3rem] overflow-hidden relative p-12 md:p-24 text-center">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />

              <div className="relative z-10 max-w-3xl mx-auto space-y-8">
                <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
                  Ready to transform your healthcare experience?
                </h2>
                <p className="text-emerald-100 text-lg md:text-xl">
                  Join thousands of satisfied patients who have made Sethro Medical their trusted healthcare partner.
                </p>
                <Link href="/register" className="inline-block">
                  <Button size="lg" className="h-14 px-10 text-lg bg-white text-emerald-900 hover:bg-emerald-50 rounded-full font-bold shadow-2xl transition-transform hover:scale-105">
                    Join Us Today
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-neutral-50 border-t border-neutral-200 py-12">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 font-bold text-xl text-emerald-800">
            <HeartPulse className="h-6 w-6 text-emerald-600" />
            Sethro Medical
          </div>
          <p className="text-neutral-500 text-sm">
            © 2026 Sethro Medical Center. All rights reserved.
          </p>
          <div className="flex gap-6 text-neutral-400">
            <a href="#" className="hover:text-emerald-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, className, iconColor }: any) {
  return (
    <div className={`p-8 rounded-3xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${className}`}>
      <div className={`h-14 w-14 rounded-2xl bg-white flex items-center justify-center mb-6 shadow-sm ${iconColor}`}>
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-xl font-bold text-neutral-900 mb-3">{title}</h3>
      <p className="text-neutral-600 leading-relaxed">{description}</p>
    </div>
  )
}

function ServiceCard({ icon, title, description, color }: { icon: string; title: string; description: string; color: string }) {
  const colorClasses = {
    emerald: 'bg-emerald-50 border-emerald-200 hover:border-emerald-300',
    blue: 'bg-blue-50 border-blue-200 hover:border-blue-300',
    purple: 'bg-purple-50 border-purple-200 hover:border-purple-300',
    red: 'bg-red-50 border-red-200 hover:border-red-300'
  };

  return (
    <div className={`p-6 rounded-2xl border-2 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-neutral-900 mb-2">{title}</h3>
      <p className="text-neutral-600 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function DoctorCard({ name, specialization }: { name: string; specialization: string }) {
  return (
    <div className="bg-white p-8 rounded-2xl border border-neutral-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-3xl font-bold">
        {name.split(' ')[1]?.[0] || 'D'}
      </div>
      <h3 className="text-xl font-bold text-neutral-900 text-center mb-2">{name}</h3>
      <p className="text-emerald-600 text-center font-medium">{specialization}</p>
    </div>
  );
}

function StatCard({ number, label }: { number: string; label: string }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20">
      <div className="text-4xl font-bold mb-2">{number}</div>
      <div className="text-emerald-100 text-sm">{label}</div>
    </div>
  );
}

