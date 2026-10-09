'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase-browser'
import { describeProductComponent, sortProductComponents } from '../../../lib/product-content-display.mjs'

async function loadProductContents(supabase, productId) {
  const current = await supabase
    .from('product_contents')
    .select('id,component_type,item_name,set_name,quantity,is_random,sort_order,source_note')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })

  if (!current.error) return current.data || []

  // Production may still have the older content_role/content_type schema.
  const legacy = await supabase
    .from('product_contents')
    .select('id,content_type,item_name,quantity,source_label,source_url,confidence,content_role')
    .eq('product_id', productId)
    .order('content_type')
    .order('item_name', { ascending: true })

  return legacy.data || current.data || []
}

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

export default function ProductDetailPage() {
  const params = useParams()
  const supabase = useMemo(() => createClient(), [])
  const [product, setProduct] = useState(null)
  const [history, setHistory] = useState([])
  const [con¶»§q«^