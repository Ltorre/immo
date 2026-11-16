# immo — Acheter ou louer ? / Buy or rent?

**🇫🇷 Simulateur gratuit : acheter sa résidence principale ou rester locataire et placer la différence dans un PEA.**
**🇬🇧 Free simulator for French residents: buy your main home, or keep renting and invest the difference in a PEA.**

Site : <https://immo.lucien.corsica> · Code : <https://github.com/Ltorre/immo>

---

## Français

### Ce que fait l'outil

Le foyer est simulé **deux fois, mois par mois**, avec les mêmes revenus, les mêmes dépenses, les mêmes crédits en cours et la même épargne de départ.
Seul le logement change :

- **Acheter** : apport et frais à la signature, puis mensualité, assurance, taxe foncière, charges, entretien…
- **Louer** : le capital reste investi dans un **PEA** (puis CTO ou livret au-delà du plafond de 150 000 €), le loyer augmente chaque année.

Ce qu'il reste chaque mois est investi dans les deux cas : la comparaison est donc équitable. Le résultat est le **patrimoine net si tout était liquidé**
à la date choisie (frais de revente, indemnités de remboursement anticipé et impôts déduits), en euros d'aujourd'hui ou en euros courants.

### Fonctionnalités

| | |
|---|---|
| **Profil** | revenus, prélèvement à la source, dépenses, épargne, épargne de précaution, PEA existant, **crédits en cours** |
| **Le bien** | plusieurs biens candidats ; notaire (ancien/neuf), agence, travaux, garantie, frais de dossier, prêt principal + **prêts complémentaires** (PTZ…) avec différé, remboursements anticipés, copropriété, taxe foncière (avec exonération), assurance, énergie, entretien, **gros travaux ponctuels**, frais de revente |
| **Hypothèses** | loyer et indexation, rendement et frais du PEA, plus-value immobilière, inflation, **taux de crédit par durée (modifiables)**, fiscalité du PEA (18,6 % de prélèvements sociaux, flat tax 31,4 %), plafond, scénarios de marché |
| **Résultats** | verdict, **points morts** (année, hausse du bien, loyer et rendement d'équilibre), courbes de patrimoine, budget mensuel, où part l'argent |
| **Comparer** | biens candidats vs location, 7 scénarios de marché, **durée du prêt × durée de détention**, niveaux d'apport, grille immobilier × PEA |
| **Risques** | simulation de **Monte-Carlo** (probabilité que l'achat gagne, éventail des résultats) |
| **Faisabilité** | taux d'endettement (règle HCSF 35 %), reste à vivre, apport minimal, capacité d'emprunt et prix maximal |

Bilingue (FR/EN), thème clair/sombre, lien de partage, impression. **Aucune donnée n'est envoyée** : tout est calculé dans le navigateur
(stockage local uniquement, ni compte, ni cookie, ni mesure d'audience).

### Valeurs par défaut

Relevées en **novembre 2026** (modifiables dans l'interface) : taux de crédit des courtiers (3,4 % à 10 ans → 3,85 % à 25 ans),
prélèvements sociaux 18,6 % depuis le 1er janvier 2026, flat tax 31,4 %, Livret A 1,5 %, règle HCSF (35 % / 25 ans), notaire 7,5 % (ancien) / 2,5 % (neuf).
Sources dans l'onglet « Méthode & limites ».

> Simulation indicative, pas un conseil en investissement ni en financement. Les résultats dépendent surtout de deux paramètres incertains :
> la hausse des prix de l'immobilier et le rendement des actions.

---

## English

### What it does

The household is simulated **twice, month by month**, with the same income, spending, existing credits and starting savings. Only housing differs:

- **Buy**: down payment and fees at signing, then instalment, insurance, property tax, charges, upkeep…
- **Rent**: capital stays invested in a **PEA** (then a taxable account or savings above the €150,000 ceiling), rent grows every year.

Whatever is left each month gets invested in both cases, so the comparison is fair. The result is **net worth if everything were liquidated** at the chosen date
(selling costs, early-repayment penalty and taxes deducted), in today's euros or current euros.

### Features

Profile (income, savings, existing PEA, **existing credits**) · several candidate homes with all French ownership costs (notary, agency, guarantee, **extra loans such as the PTZ**,
property tax, co-ownership, upkeep, big works, resale costs) · editable market assumptions and **mortgage rates by term** · **break-evens** · comparison of homes, market regimes,
**loan term × holding period**, down payments and a property × PEA return grid · **Monte Carlo** · feasibility (35 % debt ratio, borrowing capacity).
Bilingual, light/dark, share link. **Nothing leaves your browser.**

---

## Development

```bash
nvm use 22            # Node 20+ required
npm install
npm run dev           # http://localhost:5173
npm test              # engine tests (vitest)
npm run build         # type-check + production build into dist/
```

```
src/engine/    pure TypeScript model (no UI): loan.ts, simulate.ts, analysis.ts, montecarlo.ts, defaults.ts
src/pages/     one file per tab
src/ui/        form fields and SVG charts (no chart library)
src/i18n/      fr.ts (source of truth for the keys), en.ts (type-checked against fr.ts)
deploy/        Dockerfile helpers, nginx config, VPS deployment notes
```

The model is covered by tests that balance the books (conservation of money with zero returns), check the PEA ceiling and tax rules,
and verify that break-even solvers and the Monte Carlo (with zero volatility) agree with the deterministic run.

### Deployment

See [`deploy/README.md`](deploy/README.md): a static site served by a non-root nginx container behind the shared `nginx-proxy` of the VPS.

### Origin

Successor of a Google Sheets draft (rent + PEA vs purchase with a few scenarios), rebuilt as a full simulator.

## Licence

Personal project, shared as is. No warranty.
