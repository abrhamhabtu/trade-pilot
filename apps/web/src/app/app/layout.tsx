import RootShell from '@/app/RootShell';

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RootShell>{children}</RootShell>;
}
