export const AVATARS = {
  otter: { label: 'Loutre', cell: [0, 0] },
  owl: { label: 'Chouette', cell: [1, 0] },
  moth: { label: 'Papillon de nuit', cell: [2, 0] },
  red_panda: { label: 'Panda roux', cell: [3, 0] },
  raccoon: { label: 'Raton laveur', cell: [0, 1] },
  hedgehog: { label: 'Hérisson', cell: [1, 1] },
  seal: { label: 'Phoque', cell: [2, 1] },
  dragon: { label: 'Dragon', cell: [3, 1] },
  alpaca: { label: 'Alpaga', cell: [0, 2] },
  fox: { label: 'Renard', cell: [1, 2] },
  cloud: { label: 'Nuage', cell: [2, 2] },
  black_cat: { label: 'Chat noir', cell: [3, 2] },
  badger: { label: 'Blaireau', cell: [0, 3] },
  fennec: { label: 'Fennec', cell: [1, 3] },
  puffin: { label: 'Macareux', cell: [2, 3] },
  sprout: { label: 'Petite pousse', cell: [3, 3] },
  star: { emoji: '⭐', label: 'Étoile' },
  fire: { emoji: '🔥', label: 'Feu' },
  water: { emoji: '💧', label: 'Eau' },
  leaf: { emoji: '🍃', label: 'Feuille' },
  spark: { emoji: '⚡', label: 'Éclair' },
  crystal: { emoji: '💎', label: 'Cristal' },
}

export function ProfileAvatar({ avatarKey, className = '', ...props }) {
  const avatar = AVATARS[avatarKey] || AVATARS.star
  if (avatar.cell) {
    const [column, row] = avatar.cell
    const position = `${(column / 3) * 100}% ${(row / 3) * 100}%`
    return (
      <span
        {...props}
        className={`${className} profileAvatarIllustrated`.trim()}
        style={{
          ...props.style,
          backgroundImage: "url('/accueil/avatars-originals.webp')",
          backgroundPosition: position,
        }}
      />
    )
  }
  return <span {...props} className={className} aria-label={props['aria-label'] || avatar.label}>{avatar.emoji}</span>
}
