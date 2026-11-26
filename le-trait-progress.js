/**
 * Le trait — loader progressif, version 2.
 * Module ES autonome : aucun framework, aucune dépendance ni ressource externe.
 *
 * import { createTraitLoader } from './le-trait-progress.js';
 * const loader = createTraitLoader({ container: '#site-loader' });
 * loader.setProgress(42.5); // Brancher sur un VRAI avancement.
 * loader.destroy();       // Nettoyage au démontage.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
const PATH = 'M127.740148,127.740149V.354331H.354331v127.385818h92.283695c-.035215-2.561126-.070431-5.939525-.070431-6.66876,0-14.176062,1.951135-26.99529,7.085416-30.576962-2.860456-1.088535-4.709955-3.750251-4.623485-6.911083.125868-4.577636,3.33499-7.448377,7.448203-7.448377,4.113561,0,7.455002,2.986847,7.448203,7.448377-.00401,2.915196-1.693471,5.431344-4.131866,6.652024,6.73152,3.028338,8.955486,15.016696,8.955486,30.83602,0,1.541452-.061089,4.340717-.136401,6.66876h13.126999';

function createTraitLoader({
  container,
  size = 80,
  color = '#292a25',
  blur = 0.32,
  smoothing = 180,
  showPercentage = true,
  label = 'Chargement du site',
} = {}) {
  if (typeof document === 'undefined') {
    throw new Error('Initialiser le loader côté navigateur, après le montage du DOM.');
  }
  const host = typeof container === 'string' ? document.querySelector(container) : container;
  if (!host || typeof host.append !== 'function') {
    throw new Error('Le conteneur du loader est introuvable.');
  }
  if (!Number.isFinite(size) || size <= 0 ||
      !Number.isFinite(blur) || blur < 0 ||
      !Number.isFinite(smoothing) || smoothing < 0) {
    throw new TypeError('size doit être positif ; blur et smoothing doivent être positifs ou nuls.');
  }

  function svgNode(tag, attributes) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  }

  const element = document.createElement('div');
  element.setAttribute('role', 'progressbar');
  element.setAttribute('aria-label', label);
  element.setAttribute('aria-valuemin', '1');
  element.setAttribute('aria-valuemax', '100');
  Object.assign(element.style, {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px', color,
  });

  const svg = svgNode('svg', {
    width: size, height: size, viewBox: '-2 -2 132.094479 132.094479', 'aria-hidden': 'true',
  });
  Object.assign(svg.style, {
    display: 'block', width: `${size}px`, height: `${size}px`, overflow: 'visible',
  });
  const path = svgNode('path', { d: PATH, pathLength: 1 });
  Object.assign(path.style, {
    fill: 'none', stroke: 'currentColor', strokeWidth: '1.25',
    strokeLinecap: 'round', strokeLinejoin: 'round',
    strokeDasharray: '1 1', strokeDashoffset: '-1',
    filter: `blur(${blur}px)`, opacity: '0',
  });
  const point = svgNode('circle', { cx: '127.740148', cy: '127.74015', r: '.625' });
  Object.assign(point.style, { fill: 'currentColor', stroke: 'none' });
  svg.append(path, point);
  element.append(svg);

  const percentage = document.createElement('span');
  percentage.setAttribute('aria-hidden', 'true');
  Object.assign(percentage.style, {
    fontFamily: 'inherit', fontSize: '9px', fontWeight: '400',
    letterSpacing: '2px', fontVariantNumeric: 'tabular-nums', opacity: '.55',
  });
  if (showPercentage) element.append(percentage);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function updateMotionPreference() {
    path.style.transition = reducedMotion.matches
      ? 'none'
      : `stroke-dashoffset ${smoothing}ms linear, opacity 120ms linear`;
  }
  updateMotionPreference();
  reducedMotion.addEventListener('change', updateMotionPreference);

  let progress = 1;
  let destroyed = false;
  function setProgress(value) {
    if (destroyed) return;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError('setProgress attend un pourcentage numérique fini.');
    }
    // Ne pas arrondir : les fractions de pourcentage gardent le tracé fluide.
    progress = Math.max(1, Math.min(100, value));
    path.style.strokeDashoffset = String(-1 + (progress - 1) / 99);
    path.style.opacity = progress === 1 ? '0' : '1';
    point.style.display = progress === 1 ? 'block' : 'none';
    percentage.textContent = `${Math.round(progress)} %`;
    element.setAttribute('aria-valuenow', String(progress));
  }
  setProgress(1);
  host.append(element);

  return {
    element,
    setProgress,
    get progress() { return progress; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      reducedMotion.removeEventListener('change', updateMotionPreference);
      element.remove();
    },
  };
}
