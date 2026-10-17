# Trombones Universels

Version moderne de Universal Paperclips : jeu web en Vite + TypeScript + Canvas 2D, interface en français.

## Commits et pull requests

- Ne jamais ajouter de ligne `Co-Authored-By:` ni de lien de session (`Claude-Session:`, URL claude.ai) dans les
  messages de commit.
- Pas de lien de session ni de mention « Generated with Claude Code » dans les descriptions de pull request.
- Messages de commit en français.

## Commandes

```bash
npm run dev        # serveur de développement
npm test           # Vitest
npm run typecheck  # TypeScript strict
npm run build      # version statique dans dist/
```

## À respecter

- **Les parties classiques déjà commencées ne doivent jamais changer.** Toute nouvelle règle passe par
  `GameState.rules` / `scenario` / `perks` (absents en partie classique) et doit être neutre sans eux.
  `tests/scenarios.test.ts` rejoue des sauvegardes de la v1.0 (`tests/fixtures/`) et exige exactement les mêmes
  valeurs : ne pas régénérer ces fixtures pour faire passer un test.
- La sauvegarde classique garde sa clé `trombones-universels:save` ; les scénarios et l'héritage ont leurs propres clés.
- `tests/balance.test.ts` vérifie la durée de chaque phase : un changement d'équilibrage doit le garder vert.
- `src/game/` reste sans dépendance au DOM (simulation testable sous Node).
