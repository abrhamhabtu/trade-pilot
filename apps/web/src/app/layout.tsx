import type { Metadata } from 'next';
import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
