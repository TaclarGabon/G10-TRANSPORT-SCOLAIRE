# Migration Firebase — G10 Transport Scolaire

Branche de travail : `firebase-migration`

## Architecture pilote retenue
- GitHub Pages
- Firebase Spark
- Authentication anonyme
- Realtime Database
- synchronisation temps réel
- PIN applicatifs hachés
- aucune Cloud Function nécessaire

Cette architecture suit le même principe que G10 Interurbain pour la phase de démonstration et de test.

## Accès pendant le pilote
- Administration, Chef d'exploitation, Gardien / Clés et Direction utilisent un accès par rôle.
- La Direction peut changer un PIN de rôle et forcer la déconnexion des sessions correspondantes.
- Les chauffeurs ont un PIN individuel avec suspension et déconnexion forcée.
- Une version d'accès permet d'invalider les anciennes sessions dans l'application.

## À terminer avant bascule
1. Activer Authentication > Anonyme.
2. Créer Realtime Database.
3. Vérifier son URL dans `public/firebase-config.js`.
4. Publier les règles de `firebase/database.rules.json`.
5. Tester Administration, Exploitation, Chauffeur, Direction et Parent.
6. Tester la synchronisation entre deux appareils.
7. Réinitialiser la journée de démonstration.
8. Valider puis fusionner dans `main`.
