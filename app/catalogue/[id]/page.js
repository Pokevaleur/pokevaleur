import { cache } from 'react'
import { notFound } from 'next/navigation'
import ProductDetailClient from './product-detail-client'
import { createPublicServerClient } from '../../../lib/supabase-public-server'

export const revalidate = 3600

const siteUrl = 'https://www.pokevaleur.fr'
const productFields = 'id,name,series,category,product_type,release_date,release_period,official_source_url,current_value,price_source,price_source_url,price_updated_at,zero_defect_value,zero_defect_source,zero_defect_updated_at,image_url,image_source_url,image_credit,image_usage_status,case_reference,case_unit_count,case_packaging_note'

const getPublicProduct = cache(async id => {
  const supabase = createPublicServerClient()
  const { data, error } = await supabase
    .from('products')
    .select(productFields)
    .eq('id', id)
    .eq('is_public', true)
    .maybeSingle()

  if (error) throw new Error('Impossible de charger la fiche produit publique.')
  return data
})

function productUrl(id) {
  return `${siteUrl}/catalogue/${encodeURIComponent(id)}`
}

function safeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export async function generateMetadata({ params }) {
  const product = await getPublicProduct(params.id)
  if (!product) return { title: 'Produit introuvable' }

  const description = [
    product.name,
    product.series,
    'Fiche catalogue, contenu et informations de marché sur PokéValeur.'
  ].filter(Boolean).join(' — ').slice(0, 160)
  const image = product.image_url ? [{ url: product.image_url, alt: product.name }] : undefined

  return {
    title: product.name,
    description,
    alternates: { canonical: productUrl(product.id) },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      url: productUrl(product.id),
      title: `${product.name} | PokéValeur`,
      description,
      images: image
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: `${product.name} | PokéValeur`,
      description,
      images: image?.map(item => item.url)
    }
  }
}

export default async function ProductDetailPage({ params }) {
  const product = await getPublicProduct(params.id)
  if (!product) notFound()

  const url = productUrl(product.id)
  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Catalogue', item: `${siteUrl}/catalogue` },
      { '@type': 'ListItem', position: 3, name: product.name, item: url }
    ]
  }
  const productData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: [product.name, product.series, 'Produit du catalogue PokéValeur.'].filter(Boolean).join(' — '),
    category: product.category,
    image: product.image_url || undefined,
    brand: { '@type': 'Brand', name: 'Pokémon' },
    url
  }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd([breadcrumbData, productData]) }} />
    <ProductDetailClient product={product} />
  </>
}
