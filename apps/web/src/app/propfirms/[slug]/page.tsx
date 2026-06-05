import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PropFirmDetail } from '@/components/propfirms';
import { getBrandBySlug, getLiveBrands } from '@/lib/propfirms';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getLiveBrands().map((brand) => ({ slug: brand.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);

  if (!brand || brand.status !== 'live') {
    return { title: 'Prop Firm | TradePilot' };
  }

  return {
    title: `${brand.name} Trading Journal — Rules, Drawdown & Consistency | TradePilot`,
    description: `${brand.tagline} ${brand.summary}`,
  };
}

export default async function PropFirmDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);

  if (!brand || brand.status !== 'live') {
    notFound();
  }

  return <PropFirmDetail brand={brand} />;
}
