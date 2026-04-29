import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sethro Medical Center",
  description: "Comprehensive medical center management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.875rem',
            },
            classNames: {
              success: 'border-l-4 border-emerald-500',
              error:   'border-l-4 border-red-500',
              warning: 'border-l-4 border-amber-500',
              info:    'border-l-4 border-teal-500',
            },
          }}
          richColors
          closeButton
        />
      </body>
    </html>
  );
}

