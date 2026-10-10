'use client'

import { useEffect, useState } from 'react'

const styles = {
  panel: { position: 'fixed', zIndex: 100, left: 16, right: 16, bottom: 'max(16px, env(safe-area-inset-bottom))', maxWidth: 560, margin: '0 auto', padding: 18, borderRadius: 18, background: '#fff', color: '#122033', boxShadow: '0 12px 40px rgba(0,0,0,.22)', border: '1px solid #dfe5ec' },
  title: { margin: '0 0 8px', fontSize: 18 },
  copy: { margin: '0 0 14px', color: '#536277', lineHeight: 1.45 },
  actions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  primary: { minHeight: 44, border: 0, borderRadius: 10, padding: '10px 14px', background: '#ffbf1a', color: '#111', font: 'inherit', fontWeight: 800, cursor: 'pointer' },
  secondary: { minHeight: 44, border: '1px solid #ccd5e0', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#22354b', font: 'inherit', fontWeight: 700, cursor: 'pointer' },
}

function isAppleMobile() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false)
  const [help, setHelp] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [appleMobile, setAppleMobile] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    const apple = isAppleMobile()
    setAppleMobile(apple)
    const installed = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true
    if (installed) {
      localStorage.setItem('pokevaleur-install-choice', 'installed')
      localStorage.removeItem('pokevaleur-install-pending')
      return
    }

    const onBeforeInstall = event => {
      event.preventDefault()
      setDeferredPrompt(event)
    }
    const onOpenHelp = () => {
      setHelp(true)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('pokevaleur-open-install-help', onOpenHelp)

    if (localStorage.getItem('pokevaleur-install-pending') === '1') {
      localStorage.removeItem('pokevaleur-install-pending')
      localStorage.setItem('pokevaleur-install-prompted', '1')
      setVisible(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('pokevaleur-open-install-help', onOpenHelp)
    }
  }, [])

  async function install() {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice?.outcome === 'accepted') {
        localStorage.setItem('pokevaleur-install-choice', 'installed')
      } else {
        localStorage.setItem('pokevaleur-install-choice', 'later')
      }
      setDeferredPrompt(null)
      setVisible(false)
      return
    }
    setHelp(true)
  }

  function later() {
    localStorage.setItem('pokevaleur-install-choice', 'later')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside role="dialog" aria-labelledby="install-prompt-title" aria-modal="false" style={styles.panel}>
      <h2 id="install-prompt-title" style={styles.title}>
        {help ? 'Ajouter PokéValeur à ton écran d’accueil' : 'Emporte ta collection avec toi'}
      </h2>
      {help ? (
        <p style={styles.copy}>
          {appleMobile
            ? 'Dans Safari, touche Partager, puis « Ajouter à l’écran d’accueil ».'
            : deferredPrompt
              ? 'Tu peux installer PokéValeur depuis le bouton ci-dessous.'
              : 'Dans le menu de ton navigateur, choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ».'
          }
        </p>
      ) : (
        <p style={styles.copy}>Ajoute une icône PokéValeur sur ton téléphone pour retrouver ta collection comme dans une application. Tu pourras toujours continuer sur le site.</p>
      )}
      <div style={styles.actions}>
        {!help && <button type="button" style={styles.primary} onClick={install}>Ajouter à l’écran d’accueil</button>}
        {help && deferredPrompt && <button type="button" style={styles.primary} onClick={install}>Installer PokéValeur</button>}
        <button type="button" style={styles.secondary} onClick={() => help ? setVisible(false) : later()}>
          {help ? 'Fermer' : 'Plus tard'}
        </button>
      </div>
    </aside>
  )
}
