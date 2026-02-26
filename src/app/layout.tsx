import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MetCon KYC Onboarding',
  description: 'FICA-compliant KYC onboarding for Metal Concentrators SA — powered by AI',
  icons: {
    icon: '/mc-logo.jpg',
    apple: '/mc-logo.jpg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
