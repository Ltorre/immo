import { Callout, Card } from '../ui/fields'
import { MARKET_SNAPSHOT_DATE } from '../engine/defaults'
import { useApp } from '../state'

const SOURCES = [
  ['Pretto — taux immobilier novembre 2026', 'https://www.pretto.fr/taux-immobilier/historique-taux-immobilier/2026/analyse-taux-immobilier-novembre-2026/'],
  ['La Finance pour tous — fiscalité du PEA', 'https://www.lafinancepourtous.com/pratique/placements/pea/la-fiscalite-applicable-au-pea'],
  ['La Finance pour tous — taux du Livret A', 'https://www.lafinancepourtous.com/2026/01/15/le-taux-du-livret-a-passe-de-17-a-15-au-premier-fevrier-2026/'],
  ['Pretto — règles du HCSF', 'https://www.pretto.fr/pret-immobilier/hcsf/'],
  ['Notaires de France — frais d’acquisition', 'https://www.notaires.fr/fr/immobilier-fiscalite/financement/les-frais-dacquisition'],
] as const

export default function About() {
  const { state, fmt } = useApp()
  return (
    <div className="stack prose">
      {state.lang === 'fr' ? <Fr /> : <En />}
      <Card title={state.lang === 'fr' ? 'Sources des valeurs par défaut' : 'Sources of the default values'}>
        <ul className="plain">
          {SOURCES.map(([label, url]) => (
            <li key={url}><a href={url} target="_blank" rel="noreferrer noopener">{label}</a></li>
          ))}
        </ul>
        <p className="muted small">
          {state.lang === 'fr'
            ? `Valeurs de marché relevées en ${fmt.month(MARKET_SNAPSHOT_DATE)}. Elles évoluent : toutes sont modifiables dans l’onglet Hypothèses.`
            : `Market values collected in ${fmt.month(MARKET_SNAPSHOT_DATE)}. They move: all of them can be edited in the Assumptions tab.`}
        </p>
      </Card>
    </div>
  )
}

function Fr() {
  return (
    <>
      <Card title="Le principe : deux vies parallèles, un seul budget">
        <p>
          Le simulateur fait vivre le même foyer deux fois, mois par mois : une fois en <strong>achetant</strong> la résidence principale,
          une fois en <strong>restant locataire</strong>. Les revenus, les dépenses courantes, les crédits en cours et l’épargne de départ
          sont identiques. Seul le logement change.
        </p>
        <ul className="plain">
          <li><strong>Acheteur</strong> : l’apport et les frais partent à la signature ; chaque mois il paie mensualité, assurance, taxe foncière, charges, entretien…</li>
          <li><strong>Locataire</strong> : il garde son capital investi dans le PEA et paie un loyer qui progresse chaque année.</li>
          <li><strong>Ce qu’il reste</strong> chaque mois (revenu − dépenses − logement) est investi dans les deux cas : PEA d’abord (plafond de versements), puis CTO ou livret.
            C’est ce qui rend la comparaison équitable : si acheter coûte plus cher que louer, l’acheteur investit moins ; si c’est moins cher, il investit plus.</li>
          <li><strong>Résultat</strong> : le patrimoine net « si tout était liquidé » à la date choisie, après frais de revente, remboursement anticipé et impôts.</li>
        </ul>
      </Card>

      <Card title="Ce qui est pris en compte">
        <ul className="plain">
          <li>Frais de notaire (ancien ≈ 7,5 %, neuf ≈ 2,5 %), frais d’agence éventuels, travaux, déménagement et mobilier, frais de dossier et de courtage, garantie (caution ou hypothèque, avec restitution partielle de la caution).</li>
          <li>Prêt amortissable à taux fixe avec assurance emprunteur ; prêts complémentaires (PTZ, Action Logement…) avec différé ; remboursements anticipés mensuels ; indemnités de remboursement anticipé à la revente (plafonnées à 3 % du capital ou 6 mois d’intérêts).</li>
          <li>Charges de copropriété, taxe foncière (avec années d’exonération), assurance propriétaire, énergie, entretien en % de la valeur du bien, gros travaux ponctuels.</li>
          <li>Côté location : loyer, indexation, assurance, énergie.</li>
          <li>PEA : plafond de versements de 150 000 €, frais annuels du support, fiscalité (après 5 ans, uniquement les prélèvements sociaux sur les gains ; avant 5 ans, flat tax) ; au-delà du plafond, CTO (flat tax) ou livret.</li>
          <li>Crédits en cours (mensualité et durée restante), PEA existant (vendu en partie pour l’apport si besoin, impôt compris), épargne de précaution jamais investie.</li>
          <li>Évolution des revenus, inflation (vue en euros constants), évolution des charges.</li>
          <li>Plus-value sur la résidence principale : exonérée d’impôt. Taxe d’habitation : supprimée sur la résidence principale.</li>
        </ul>
      </Card>

      <Card title="Les analyses proposées">
        <ul className="plain">
          <li><strong>Points morts</strong> : à partir de quelle année acheter devient gagnant, quelle hausse annuelle du bien est nécessaire, à partir de quel loyer, et en dessous de quel rendement du PEA.</li>
          <li><strong>Comparer</strong> : plusieurs biens candidats face à la location, plusieurs régimes de marché, durée du prêt × durée de détention, niveaux d’apport, grille plus-value immobilière × rendement du PEA.</li>
          <li><strong>Risques</strong> : simulation de Monte-Carlo (rendements boursiers et prix de l’immobilier aléatoires) : probabilité que l’achat gagne et éventail des résultats.</li>
          <li><strong>Faisabilité</strong> : taux d’endettement (règle HCSF de 35 %), reste à vivre, apport minimal, capacité d’emprunt et prix maximal.</li>
        </ul>
      </Card>

      <Card title="Limites : à lire avant de décider">
        <ul className="plain">
          <li>C’est un modèle, pas une prédiction. Les résultats dépendent surtout de deux paramètres incertains : la hausse des prix du bien et le rendement des actions. Regardez les points morts et les grilles, pas seulement le chiffre central.</li>
          <li>Les actions ne sont pas garanties : le rendement du PEA est une espérance, et une baisse importante juste avant la date de comparaison est possible (voir l’onglet Risques).</li>
          <li>Les aspects non financiers ne sont pas modélisés : stabilité, liberté de déménager, plaisir d’être chez soi, effort de gestion, risque de vacance de travaux. Ils comptent souvent plus que l’écart chiffré.</li>
          <li>Hypothèses simplificatrices : taux fixe sans renégociation, revenus et dépenses lissés, investissement systématique de l’excédent, pas d’impôt sur le revenu supplémentaire, pas de succession, pas de variation de la fiscalité future.</li>
          <li>Le taux de votre prêt, les frais de notaire, la taxe foncière et les charges dépendent de votre dossier et de la commune : remplacez les valeurs d’exemple par celles de vos devis.</li>
          <li>Ceci n’est pas un conseil en investissement ou en financement. Pour une décision engageante, voyez un courtier, un notaire ou un conseiller en gestion de patrimoine.</li>
        </ul>
      </Card>

      <Card title="Vos données restent chez vous">
        <p>
          Tout le calcul se fait dans votre navigateur. Aucune donnée n’est envoyée à un serveur, il n’y a ni compte, ni cookie, ni outil de mesure d’audience.
          Vos saisies sont mémorisées localement (stockage du navigateur) ; le bouton « Partager » crée un lien qui contient vos hypothèses dans l’adresse elle-même : ne le diffusez que si vous êtes à l’aise avec cela.
        </p>
        <Callout kind="info">Le code est ouvert : github.com/Ltorre/immo</Callout>
      </Card>
    </>
  )
}

function En() {
  return (
    <>
      <Card title="The principle: two parallel lives, one budget">
        <p>
          The simulator lives the same household twice, month by month: once <strong>buying</strong> the main home, once <strong>staying a tenant</strong>.
          Income, everyday spending, existing credits and starting savings are identical. Only housing differs.
        </p>
        <ul className="plain">
          <li><strong>Buyer</strong>: the down payment and fees go out at signing; every month they pay the instalment, insurance, property tax, charges, upkeep…</li>
          <li><strong>Tenant</strong>: keeps their capital invested in the PEA and pays a rent that grows every year.</li>
          <li><strong>Whatever is left</strong> each month (income − spending − housing) is invested in both cases: PEA first (deposit ceiling), then a taxable brokerage account or a savings account.
            That is what makes the comparison fair: if buying costs more than renting, the buyer invests less; if it costs less, they invest more.</li>
          <li><strong>Result</strong>: net worth “if everything were liquidated” at the chosen date, after selling costs, early-repayment penalty and taxes.</li>
        </ul>
      </Card>

      <Card title="What is included">
        <ul className="plain">
          <li>Notary fees (existing homes ≈ 7.5 %, new builds ≈ 2.5 %), optional agency fee, works, moving and furniture, bank and broker fees, guarantee (surety or mortgage, with partial refund of the surety).</li>
          <li>Fixed-rate amortising loan with borrower insurance; extra loans (zero-rate PTZ, employer loan…) with deferral; monthly extra repayments; early-repayment penalty on resale (capped at 3 % of the balance or 6 months of interest).</li>
          <li>Co-ownership charges, property tax (with exemption years), owner insurance, energy, upkeep as a share of the property value, one-off big works.</li>
          <li>Renting side: rent, indexation, insurance, energy.</li>
          <li>PEA: €150,000 deposit ceiling, yearly fund fees, taxation (after 5 years only social levies on gains; before, the flat tax); above the ceiling money goes to a taxable account (flat tax) or a savings account.</li>
          <li>Existing credits (instalment and remaining term), existing PEA (partly sold for the down payment if needed, tax included), emergency fund that is never invested.</li>
          <li>Income growth, inflation (shown in constant euros), growth of running costs.</li>
          <li>Capital gain on the main residence: tax exempt. Housing tax (taxe d’habitation): abolished on the main residence.</li>
        </ul>
      </Card>

      <Card title="The analyses on offer">
        <ul className="plain">
          <li><strong>Break-evens</strong>: from which year buying wins, which yearly property growth is needed, from which rent, and below which PEA return.</li>
          <li><strong>Compare</strong>: several candidate homes against renting, several market regimes, loan term × holding period, down-payment levels, property growth × PEA return grid.</li>
          <li><strong>Risk</strong>: Monte Carlo simulation (random stock returns and property prices): probability that buying wins and the spread of outcomes.</li>
          <li><strong>Feasibility</strong>: debt ratio (HCSF 35 % rule), money left to live on, minimum down payment, borrowing capacity and maximum price.</li>
        </ul>
      </Card>

      <Card title="Limits: read before you decide">
        <ul className="plain">
          <li>This is a model, not a forecast. Results mostly hinge on two uncertain inputs: property price growth and equity returns. Look at the break-evens and the grids, not only the central figure.</li>
          <li>Equities are not guaranteed: the PEA return is an expectation, and a large fall just before the comparison date is possible (see the Risk tab).</li>
          <li>Non-financial aspects are not modelled: stability, freedom to move, the joy of being at home, management effort, renovation risk. They often matter more than the numeric gap.</li>
          <li>Simplifications: fixed rate with no renegotiation, smoothed income and spending, the surplus is always invested, no extra income tax, no inheritance, no future tax changes.</li>
          <li>Your loan rate, notary fees, property tax and charges depend on your file and on the town: replace the sample values with those from your quotes.</li>
          <li>This is not investment or financing advice. For a binding decision, see a broker, a notary or a wealth adviser.</li>
        </ul>
      </Card>

      <Card title="Your data stays with you">
        <p>
          All calculations run in your browser. Nothing is sent to a server; there is no account, no cookie and no analytics.
          Your inputs are remembered locally (browser storage); the “Share” button builds a link that carries your assumptions in the address itself: only post it if you are comfortable with that.
        </p>
        <Callout kind="info">The code is open: github.com/Ltorre/immo</Callout>
      </Card>
    </>
  )
}
