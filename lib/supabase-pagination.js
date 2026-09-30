export async function fetchAllRows(buildQuery, pageSize = 500) {
  const rows = []

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await buildQuery().range(offset, offset + pageSize - 1)
    if (error) return { data: null, error }

    const page = data || []
    rows.push(...page)
    if (page.length < pageSize) break
  }

  return { data: rows, error: null }
}
