# Comparaison visuelle du scanner

Le scanner calcule une empreinte perceptuelle dans le navigateur, puis la compare à un fichier compact pré-calculé à partir des images publiques du catalogue. La photo n’est pas envoyée au serveur et aucun service d’IA n’est utilisé.

## Génération de l’index

Le workflow GitHub Actions `.github/workflows/build-card-visual-index.yml` génère automatiquement `public/card-visual-index.json` après une mise à jour du générateur. Il lit uniquement les cartes des séries publiques et utilise la clé publishable Supabase, qui est une clé cliente publique; aucune clé secrète ni service_role n’est nécessaire. Le workflow ajoute le fichier d’index à la branche de test, puis Vercel redéploie l’aperçu.

Si GitHub désactive les Actions sur le dépôt ou si une image publique échoue au téléchargement, le workflow affichera le détail dans ses journaux. Il faut aussi éviter d’ajouter un secret Supabase à la configuration de ce workflow.
