import type { Metadata } from 'next';
import './globals.css';
import { PALETTE_BOOT_SCRIPT } from '@/lib/palette';

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
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PALETTE_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
