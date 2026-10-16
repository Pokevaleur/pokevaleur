# Messagerie interne

Accès : `/messagerie`, par l’enveloppe du menu ou du bandeau mobile de Ma collection.

- La première ouverture demande de confirmer avoir au moins 18 ans et être le titulaire du compte.
- Les profils de collection enfants ne sont pas des destinataires. Les comptes identifiés comme mineurs dans le consentement social sont refusés par la base.
- Les titulaires déjà inscrits peuvent recevoir un message avant leur première ouverture ; la lecture et l’envoi nécessitent leur confirmation de majorité.
- Les destinataires sont sélectionnés par pseudo. Aucune adresse mail n’est exposée dans l’annuaire.
- Membre à membre : une conversation privée par paire, historique conservé.
- Membre à l’équipe : une conversation avec Lukulu — l’équipe PokéValeur. Tous les administrateurs peuvent la traiter.
- Administrateur à un membre : message privé ou réponse au nom de l’équipe.
- Annonce générale : aperçu avec nombre de comptes destinataires et confirmation avant envoi. La liste des destinataires reste privée ; une réponse ouvre un échange privé avec l’équipe.
- Archives individuelles, blocage/déblocage, refus des messages de membres et signalement d’un message à l’équipe.
- Texte seul, 4 000 caractères maximum. Pas d’envoi de courriel ni de pièce jointe dans cette version.
- L’enveloppe actualise les non-lus toutes les 30 secondes lorsque la page est visible, et immédiatement après une action locale ou le retour sur la page. Les conversations sont actualisées toutes les 12 secondes.

## Accès aux données

Six nouvelles tables `inbox_*`, avec RLS et accès direct en lecture uniquement pour les lignes autorisées. Les mutations passent par `public.messaging`, une fonction SECURITY INVOKER qui appelle une implémentation privée avec contrôles explicites. Les rôles sont vérifiés dans `profiles.is_admin`, jamais dans des métadonnées utilisateur modifiables.

Un administrateur ne peut pas consulter les échanges privés entre d’autres membres. Un signalement ne lui transmet que le message signalé et son motif. Les messages officiels portent un badge calculé côté serveur. Les annonces ne permettent aucune réponse collective.

Les envois sont idempotents grâce à un identifiant de requête et limités à 15/minute, 200/jour par expéditeur ; les annonces générales sont limitées à cinq par jour. L’archivage d’un destinataire n’affecte pas les autres. Les marqueurs de lecture sont monotones et limités à des messages effectivement demandés.

## Vérifications

`supabase/tests/internal-messaging.sql` s’exécute dans une transaction annulée : comptes fictifs, messages privés, réponse équipe, annonce, lecture, archivage, idempotence, blocage, signalements et refus des accès anonyme, enfant, tiers et administrateur non participant. Aucun message de test n’est conservé.

Avant une mise en ligne : compilation Next.js, test SQL dans le projet isolé, contrôle des conseillers de sécurité et comparaison du diff avec la dernière branche principale. Un test de parcours React vérifie aussi l’activation, les formulaires d’envoi, l’aperçu d’annonce et la mise à jour de l’enveloppe.

Pour tester à deux comptes réels : activer chacun sa messagerie, envoyer un message privé, vérifier la pastille non lue sur le second compte, ouvrir et répondre. Tester ensuite un contact équipe. L’annonce générale est à tester seulement lorsqu’on souhaite réellement envoyer un message à tous les comptes adultes destinataires.
