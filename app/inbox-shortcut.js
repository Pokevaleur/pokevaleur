'use client'

import { useInboxStatus } from '../lib/messaging-status'
import styles from './inbox-shortcut.module.css'

export default function InboxShortcut() {
  const status = useInboxStatus()
  if (!status?.eligible) return null
  const messageCount = status.unread || 0
  const catalogueCount = status.catalogue_pending || 0
  const count = messageCount + catalogueCount
  return <a className={styles.shortcut} href="/messagerie" aria-label={`Messagerie${messageCount ? `, ${messageCount} message${messageCount > 1 ? 's' : ''} non lu${messageCount > 1 ? 's' : ''}` : ''}${catalogueCount ? `, ${catalogueCount} proposition${catalogueCount > 1 ? 's' : ''} catalogue à traiter` : ''}`} title="Ma messagerie">
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg>
    {count > 0 && <span className={styles.count}>{count > 99 ? '99+' : count}</span>}
  </a>
}
