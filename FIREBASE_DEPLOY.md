# Déploiement Firebase — G10 Transport Scolaire

Cette branche utilise Firebase de façon sécurisée :

- Firestore = données G10 Scolaire.
- Firebase Authentication = jetons personnalisés créés par les Cloud Functions.
- Cloud Functions = validation des PIN, règles métier, changements de PIN, discipline, reset et accès.
- GitHub Pages = interface Web.
- Aucun PIN de gestion n'est stocké dans le dépôt public.

## Important — forfait Firebase

Le déploiement de Cloud Functions nécessite le forfait Firebase Blaze (paiement à l'usage).
La base et l'application peuvent rester très peu coûteuses, mais Firebase exige un compte de facturation pour déployer les Functions.

Ne pas remplacer cette architecture par des PIN vérifiés uniquement dans le JavaScript du navigateur :
cela exposerait les données des élèves et parents.

## 1. Installer / ouvrir Firebase CLI

Depuis un terminal ou Google Cloud Shell :

```bash
npm install -g firebase-tools
firebase login
firebase use g10-transport-scolaire
```

## 2. Créer les secrets

Entrer les vraies valeurs seulement quand Firebase les demande.
Ne jamais écrire les PIN dans GitHub.

```bash
firebase functions:secrets:set ADMIN_PIN
firebase functions:secrets:set OPERATIONS_PIN
firebase functions:secrets:set GUARD_PIN
firebase functions:secrets:set DIRECTION_PIN
firebase functions:secrets:set DRIVER1_PIN
firebase functions:secrets:set DRIVER2_PIN
```

Les valeurs validées sont :
- Administration : code G10 commun
- Chef d'exploitation : code G10 commun
- Gardien / Clés : code G10 commun
- Direction : code G10 commun
- Chauffeur scolaire 1 : PIN scolaire provisoire
- Chauffeur scolaire 2 : PIN scolaire provisoire

## 3. Déployer Functions + règles Firestore

À la racine du dépôt :

```bash
firebase deploy --only functions,firestore
```

Endpoints attendus en région `europe-west1` :
- `pinAuth`
- `api`

## 4. Vérification

1. Ouvrir l'application GitHub Pages.
2. Tester Administration.
3. Créer / renseigner les chauffeurs et les bus.
4. Tester Chef d'exploitation.
5. Tester Chauffeur 1 puis Chauffeur 2.
6. Tester Parent.
7. Vérifier la Direction sur un deuxième téléphone.
8. Modifier une donnée sur le premier appareil et vérifier sa remontée distante.
9. Tester suspension, changement de PIN et déconnexion forcée.
10. Réinitialiser la journée avant le premier test officiel.

## 5. Règles Firestore

Les clients Web ne lisent directement que `system/sync`, utilisé comme signal temps réel.
Toutes les données métier passent par les Cloud Functions et l'Admin SDK.

C'est volontaire : les informations d'élèves, parents, chauffeurs, recettes et discipline ne sont jamais ouvertes directement au navigateur.
