// Once database rows reference a file, a later error must not remove that file.
export async function saveUploadedPhotoBatch({ paths, link, setPrimary, remove }) {
  let linked = false
  try {
    await link(paths)
    linked = true
    await setPrimary(paths[0])
  } catch (cause) {
    if (!linked && paths.length) await remove(paths).catch(() => {})
    const error = new Error(cause?.message || 'Impossible d’enregistrer les photos.')
    error.photosLinked = linked
    throw error
  }
}
