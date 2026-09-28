# Migration Firebase — G10 Transport Scolaire

Branche de travail : `firebase-migration`

## État
- Firebase Web configuré pour le projet `g10-transport-scolaire`.
- Firestore créé en production dans `eur3`.
- Authentication e-mail / mot de passe activée.
- Les règles Firestore doivent rester fermées tant que la migration n'est pas terminée.
- Les chemins des scripts ont été rendus compatibles avec GitHub Pages.
- La version `main` reste inchangée pendant les travaux.

## À terminer avant bascule
1. Remplacer les appels backend Hatchable par Firestore.
2. Migrer/synchroniser les collections G10 Scolaire.
3. Mettre en place les rôles et règles Firestore.
4. Tester Administration, Exploitation, Chauffeur, Direction et Parent.
5. Remise à zéro de la journée de démonstration.
6. Test distant sur deux appareils.
7. Fusion vers `main`, puis activation GitHub Pages.
