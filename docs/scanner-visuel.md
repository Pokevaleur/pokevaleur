# Index visuel du scanner

Le rapprochement visuel compare une empreinte perceptuelle calculée dans le navigateur à une empreinte préparée pour chaque image du catalogue. La photo de scan reste dans le navigateur.

## Initialisation

1. Appliquer la migration `supabase/migrations/20261028205834_card_visual_fingerprints.sql` au projet Supabase utilisé par le déploiement.
2. Depuis un environnement autorisé à lire les images du catalogue et à écrire dans Supabase, installer Pillow et lancer le script :

```sh
python3 -m pip install Pillow
export SUPABASE_URL="https://<projet>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<clé service_role du projet>"
python3 scripts/build-card-visual-index.py
```

Ne pas enregistrer la clé service_role dans le dépôt, dans une variable publique `NEXT_PUBLIC_*`, ni dans un journal de commandes partagé. Le script parcourt les cartes publiques avec image, calcule les empreintes et les envoie par lots. Il peut être relancé après une importation d’images; les lignes existantes sont mises à jour.

Tant que la migration et l’index ne sont pas disponibles, le scanner continue à proposer les résultats OCR et la recherche manuelle. Le rapprochement visuel ne valide jamais une carte automatiquement : la personne doit confirmer la proposition avant l’ajout.
