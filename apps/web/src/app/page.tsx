import dynamic from 'next/dynamic';

const AppClient = dynamic(() => import('./AppClient'), { ssr: false });

export default function Home() {
  return <AppClient />;
}
