// Carte « Comparer deux sites » (T-14, INTERFACE § 9) : choix du site B, tableau A / B / écart (B − A), lectures au même instant.
// État dans l'URL (`b=`). Pas de classement ni de « meilleur site » : le choix scientifique reste à l'utilisateur.
import { candidatesForB, instantRows, kpiRows, sameWindow } from '../compare.js';
import { formatNumber, getLang, t } from '../i18n.js';

const $ = (id) => document.getElementById(id);
const STATUS_ICON = { hidden: '○', partial: '◐', visible: '●' };

const nameOf = (entry) => entry.name[getLang()] ?? entry.name.en;
const signed = (v, digits) => `${v < 0 ? '−' : '+'}${formatNumber(Math.abs(v), digits)}`;

/** Crée la carte ; `setIndex(sites)` remplit la liste ; `render(...)` affiche. */
export function createComparePanel(store) {
  let entries = [];

  function fillSelect(siteIdA, selected) {
    const select = $('compare-select');
    const none = document.createElement('option');
    none.value = '';
    none.textContent = t('compare.none');
    select.replaceChildren(none, ...candidatesForB(entries, siteIdA).map((entry) => {
      const opt = document.createElement('option');
      opt.value = entry.id;
      opt.textContent = entry.synthetic ? t('site.option', { name: nameOf(entry) }) : nameOf(entry);
      return opt;
    }));
    select.value = selected ?? '';
  }

  function row(cells, header = false) {
    const tr = document.createElement('tr');
    cells.forEach((text, i) => {
      const cell = document.createElement(i === 0 || header ? 'th' : 'td');
      if (i === 0 && !header) cell.scope = 'row';
      if (header) cell.scope = 'col';
      if (text instanceof Node) cell.append(text); else cell.textContent = text;
      tr.append(cell);
    });
    return tr;
  }

  /** `siteA`, `siteB` : fichiers chargés (siteB null si aucun) ; `state` : état commun. */
  function render(siteA, siteB, state) {
    if (!siteA) return;
    const selected = siteB && state.compare ? state.siteIdB : '';
    fillSelect(siteA.id, selected);
    $('compare-body').hidden = !siteB;
    $('compare-hint').hidden = Boolean(siteB);
    if (!siteB) return;
    const entryA = entries.find((e) => e.id === siteA.id);
    const nameA = entryA ? nameOf(entryA) : (siteA.name[getLang()] ?? siteA.name.en); // point libre : absent de l'index
    const nameB = nameOf(entries.find((e) => e.id === siteB.id));
    $('compare-warning').hidden = sameWindow(siteA, siteB);
    $('compare-legend').textContent = t('compare.legend', { a: nameA, b: nameB });
    const fmt = (kind, v) => (kind === 'pct' ? `${formatNumber(v, 1)} %` : `${formatNumber(v, 0)} h`);
    const fmtDelta = (kind, v) => (kind === 'pct' ? `${signed(v, 1)} ${t('compare.points')}` : `${signed(v, 0)} h`);
    $('compare-kpis').replaceChildren(
      row([t('compare.indicator'), 'A', 'B', t('compare.delta')], true),
      ...kpiRows(siteA, siteB, state.threshold).map((r) => row([t(`compare.kpi.${r.key}`), fmt(r.kind, r.a), fmt(r.kind, r.b), fmtDelta(r.kind, r.delta)])),
    );
    const status = (r) => {
      const span = document.createElement('span');
      const icon = document.createElement('span');
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = STATUS_ICON[r.status];
      const word = document.createElement('span');
      word.className = 'visually-hidden';
      word.textContent = `${t(`status.${r.status}`)} `;
      span.append(icon, word, ` ${signed(r.marginDeg, 2)}°`);
      return span;
    };
    $('compare-now').replaceChildren(
      row([t('reading.body'), 'A', 'B', t('compare.marginDelta')], true),
      ...instantRows(siteA, siteB, state.tMs, state.threshold).map((r) => row([t(`body.${r.body}`), status(r.a), status(r.b), `${signed(r.marginDelta, 2)}°`])),
    );
  }

  $('compare-select').addEventListener('change', (e) => {
    const id = e.target.value;
    store.set(id ? { siteIdB: id, compare: true } : { siteIdB: null, compare: false });
  });

  return { setIndex(sites) { entries = sites; }, render };
}
