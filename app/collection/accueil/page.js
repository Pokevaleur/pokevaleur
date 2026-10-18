import { redirect } from 'next/navigation'

// Keep old bookmarks and links working after the collection overview is folded into home.
export default function CollectionOverviewRedirect() {
  redirect('/#rubriques-collection')
}
