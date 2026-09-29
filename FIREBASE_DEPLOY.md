# G10 Transport Scolaire — Firebase Spark (phase test)

Architecture pilote alignée sur G10 Interurbain :

- GitHub Pages pour l'interface.
- Firebase Authentication anonyme.
- Firebase Realtime Database pour la synchronisation entre appareils.
- PIN applicatifs hachés (SHA-256) pour les rôles, chauffeurs et parents.
- Aucun Cloud Function n'est nécessaire pour cette phase.
- Aucun passage au forfait Blaze n'est nécessaire pour ce pilote.

## À faire dans la console Firebase

### 1. Authentication
Dans Authentication > Méthode de connexion :
- activer **Anonyme** ;
- Adresse e-mail / mot de passe peut rester activée, mais n'est pas utilisée par le pilote.

### 2. Realtime Database
Créer **Realtime Database** dans une région européenne.

Après création, vérifier que l'URL est :
`https://g10-transport-scolaire-default-rtdb.europe-west1.firebasedatabase.app`

Si Firebase affiche une URL différente, mettre cette URL exacte dans :
`public/firebase-config.js`

### 3. Règles Realtime Database
Les règles du dépôt sont dans :
`firebase/database.rules.json`

Elles autorisent la lecture/écriture uniquement à une session Firebase authentifiée (le pilote utilise l'authentification anonyme).

### 4. Test sur deux appareils
- Téléphone A : connexion Administration / Exploitation / Chauffeur.
- Téléphone B : Direction.
- Modifier une donnée sur A.
- Vérifier la remontée automatique sur B.
- Tester suspension chauffeur, changement PIN et déconnexion forcée.
- Réinitialiser l'activité du jour avant la présentation officielle.

## Gestion des accès pendant le pilote

Les rôles de gestion utilisent un accès commun par rôle :
- Administration
- Chef d'exploitation
- Gardien / Clés
- Direction

La Direction peut :
- changer le PIN d'un rôle ;
- forcer la déconnexion de toutes les sessions de ce rôle ;
- suspendre/réactiver Administration, Exploitation et Gardien.

Les chauffeurs gardent des accès individuels :
- PIN propre au chauffeur ;
- suspension individuelle ;
- changement de PIN ;
- déconnexion forcée.

### Limite assumée de la phase test

Ce système est un **verrou applicatif**. Il convient au pilote et à la démonstration, mais il n'offre pas la même protection serveur que des comptes individuels avec autorisation backend.

Après validation commerciale, la prochaine étape sera :
- comptes nominatifs par employé ;
- désactivation individuelle au départ d'un salarié ;
- backend sécurisé / règles par rôle ;
- éventuellement application mobile distribuée ;
- dépôt GitHub privé pour le code non destiné à être public.
