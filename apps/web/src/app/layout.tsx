import type { Metadata } from 'next';
import { SessionControls } from '@/components/SessionControls';
import './globals.css';

export const metadata: Metadata = {
  title: 'Recon',
  description: 'Exception management for e-commerce operations',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionControls />
        {children}
      </body>
    </html>
  );
}
