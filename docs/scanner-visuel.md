# Comparaison visuelle du scanner

Le scanner lit d’abord le texte dans le navigateur et compare une empreinte de la photo aux visuels publics du catalogue. Il envoie aussi la photo au serveur PokéValeur, qui la transmet à OpenAI pour lire le nom imprimé en haut de la carte, le numéro et, si possible, la série. La réponse sert à chercher les correspondances dans le catalogue ; l’utilisateur doit confirmer la carte avant l’ajout.

## Génération de l’index

Le workflow GitHub Actions `.github/workflows/build-card-visual-index.yml` génère automatiquement `public/card-visual-index.json` après une mise à jour du générateur. Il lit uniquement les cartes des séries publiques et utilise la clé publishable Supabase, qui est une clé cliente publique; aucune clé secrète ni service_role n’est nécessaire. Le workflow ajoute le fichier d’index à la branche de test, puis Vercel redéploie l’aperçu.

Si GitHub désactive les Actions sur le dépôt ou si une image publique échoue au téléchargement, le workflow affichera le détail dans ses journaux. Il faut aussi éviter d’ajouter un secret Supabase à la configuration de ce workflow.
