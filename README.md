# Trombones Universels

Une version moderne de **Universal Paperclips** (Frank Lantz, 2017) : on y retrouve la boucle
d'origine (prix, demande, fil, confiance, opérations, créativité, projets, puis la Terre et
l'univers), mais la production se **construit** sur une grille, tuile par tuile, comme dans
un jeu d'automatisation à la *Alchemy Factory* : distributeurs, plieuses, convoyeurs et
répartiteurs, avec les objets qui circulent sous vos yeux.

## Jouer

```bash
npm install
npm run dev      # http://localhost:5173
```

`npm run build` produit une version statique dans `dist/` (fonctionne depuis n'importe quel
sous-dossier). Le workflow `.github/workflows/deploy.yml` la publie sur GitHub Pages à chaque
push sur `main` : il suffit d'activer *Settings → Pages → Source : GitHub Actions*.

## Déroulé

| Phase | Ce qu'on fait |
| --- | --- |
| **1 · Entreprise** | Plier à la main, poser une plieuse entre le distributeur et le Siège, régler le prix, acheter du fil. À 2 000 trombones, la confiance débloque processeurs et mémoire, donc les projets : plieuses plus rapides, méga-plieuses 2×2, extensions de l'usine, marketing… jusqu'aux HypnoDrones. |
| **2 · Terre** | Plus de marché : toute la carte s'ouvre. Foreuses sur les gisements → tréfileries → usines à trombones 3×3, alimentées par des fermes solaires. Les projets de nanotechnologie multiplient la production par 10. |
| **3 · Univers** | Sondes de von Neumann : on répartit leur confiance (vitesse, exploration, réplication, conversion, blindage, combat) pendant qu'elles colonisent la galaxie… et que certaines dérivent. |

Durée indicative : ~1 h pour la phase 1, ~30 min pour la Terre, ~10 min pour l'univers.

## Commandes

| Touche | Action |
| --- | --- |
| `1`…`0` | Choisir un bâtiment |
| Clic / glisser | Construire, tracer un convoyeur |
| `R` / `Maj+R` | Tourner (aussi la machine survolée) |
| Clic droit (glisser) | Démolir — remboursé intégralement |
| `Q` | Copier le bâtiment survolé |
| `X`, `Échap` | Outil démolition, annuler |
| `ZQSD`/`WASD`/flèches, glisser | Déplacer la vue |
| Molette, pincement | Zoom |
| `Espace`, clic sur le Siège | Plier un trombone à la main |
| `F`, `H` | Recentrer, aide |

## Règles de l'usine

- Une machine **reçoit** par n'importe quelle face sauf l'avant et **sort** par l'avant (petite flèche).
- Le **répartiteur** reçoit de n'importe quel côté et redistribue à tour de rôle vers les trois autres :
  une rangée de répartiteurs alimente une rangée de plieuses.
- Les objets voyagent en **lots** : quand un tapis est chargé, une insertion latérale fait grossir le lot
  voisin plutôt que d'affamer les machines en aval.
- Sauvegarde automatique (navigateur) toutes les 15 s, export/import depuis le menu ⚙, et jusqu'à
  10 minutes de production rattrapées hors ligne.

## Code

```
src/game/    simulation pure (aucune dépendance au DOM) : grille, tapis, machines, économie, projets, espace
src/render/  rendu Canvas 2D : usine, objets animés, galaxie
src/ui/      HUD (panneaux, projets, barre de construction), contrôles souris/clavier/tactile
tests/       Vitest : mécanique de l'usine, économie, phases, sauvegarde + un joueur-robot d'équilibrage
```

```bash
npm test          # tests
npm run typecheck # TypeScript strict
```

Les constantes d'équilibrage sont dans `src/game/constants.ts`, `src/game/rules.ts` et
`src/game/projects.ts`. `tests/balance.test.ts` fait jouer un robot simplifié et échoue si une phase
devient trop courte ou trop longue.

---

Hommage non officiel à *Universal Paperclips*. Aucun code ni ressource de l'original n'est réutilisé.
