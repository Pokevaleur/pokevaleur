const allowedPrefixes = ['/coffre', '/progression', '/catalogue', '/collection', '/communaute', '/opportunites', '/trades', '/admin']

export function resolvePostLoginPath(origin, requestedPath, savedPath) {
  for (const candidate of [requestedPath, savedPath]) {
    if (!candidate) continue
    try {
      const parsed = new URL(candidate, origin)
      const allowed = allowedPrefixes.some(prefix => parsed.pathname === prefix || parsed.pathname.startsWith(prefix + '/'))
      if (parsed.origin === origin && allowed) return parsed.pathname + parsed.search + parsed.hash
    } catch {}
  }
  return '/collection'
}
