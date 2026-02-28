import type { Metadata } from 'next';
import './globals.css';
import RootShell from './RootShell';

export const metadata: Metadata = {
  title: 'TradePilot',
  description: 'Trading analytics dashboard for prop firm traders'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <RootShell>{children}</RootShell>
      </body>
    </html>
  );
}
