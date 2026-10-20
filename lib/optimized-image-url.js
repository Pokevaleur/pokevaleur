export function getOptimizedImageUrl(src, width = 384, quality = 70) {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return src
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`
}
