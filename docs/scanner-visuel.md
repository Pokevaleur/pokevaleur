# Comparaison visuelle du scanner

Le scanner lit le texte avec Tesseract dans le navigateur et compare une empreinte de la photo aux visuels publics du catalogue. La photo reste dans le navigateur et n’est transmise à aucun service externe. L’utilisateur doit confirmer la carte proposée avant l’ajout.

## Génération de l’index

Le workflow GitHub Actions `.github/workflows/build-card-visual-index.yml` génère automatiquement `public/card-visual-index.json` après une mise à jour du générateur. Il lit uniquement les cartes des séries publiques et utilise la clé publishable Supabase, qui est une clé cliente publique; aucune clé secrète ni service_role n’est nécessaire. Le workflow ajoute le fichier d’index à la branche de test, puis Vercel redéploie l’aperçu.

Si GitHub désactive les Actions sur le dépôt ou si une image publique échoue au téléchargement, le workflow affichera le détail dans ses journaux. Il faut aussi éviter d’ajouter un secret Supabase à la configuration de ce workflow.
