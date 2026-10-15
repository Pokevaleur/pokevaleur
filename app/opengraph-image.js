import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'PokéValeur, organise ta collection Pokémon'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '76px 86px',
      background: 'linear-gradient(135deg, #e8f4ff 0%, #f8fbff 55%, #fff2ca 100%)',
      color: '#17283b',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 32, fontWeight: 700, color: '#9b7011' }}>
        <span style={{ marginRight: 14, fontSize: 40 }}>✦</span> COLLECTION POKÉMON
      </div>
      <div style={{ display: 'flex', marginTop: 28, fontSize: 86, lineHeight: 1.05, fontWeight: 800, letterSpacing: -3 }}>
        PokéValeur
      </div>
      <div style={{ display: 'flex', marginTop: 24, maxWidth: 880, fontSize: 36, lineHeight: 1.35, color: '#42566c' }}>
        Organise tes cartes, tes produits scellés et tes master sets.
      </div>
      <div style={{ display: 'flex', marginTop: 52, fontSize: 25, fontWeight: 600, color: '#1976ed' }}>
        pokevaleur.fr
      </div>
    </div>,
    size
  )
}
