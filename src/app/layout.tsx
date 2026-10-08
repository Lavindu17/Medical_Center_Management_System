import type { Metadata, Viewport } from "next";
import { Figtree, Noto_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";

// Figtree for headings and Noto Sans for text: the pairing the project's design system specifies for a
// medical, trustworthy, accessible feel. Self-hosted by next/font, so no render-blocking font stylesheet.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

const notoSans = Noto_Sans({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Sethro Medical Center",
    template: "%s | Sethro Medical Center",
  },
  description: "Appointments, prescriptions, lab results and billing in one place for patients and the care team.",
};

export const viewport: Viewport = {
  themeColor: "#047857",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${figtree.variable} ${notoSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {/* Keyboard users can jump straight past the navigation */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-emerald-700 focus:shadow-lg focus:ring-2 focus:ring-emerald-600"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <ConfirmProvider>
            {children}
          </ConfirmProvider>
        </AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: 'var(--font-noto), system-ui, sans-serif',
              fontSize: '0.875rem',
            },
            classNames: {
              success: 'border-l-4 border-emerald-600',
              error:   'border-l-4 border-red-600',
              warning: 'border-l-4 border-amber-500',
              info:    'border-l-4 border-sky-600',
            },
          }}
          richColors
          closeButton
        />
      </body>
    </html>
  );
}
