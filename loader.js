const Loader = (() => {
  const images = new Map();
  const pending = new Set();
  const failed = new Set();
  // Couvrir toute la séquence dès le départ, avec plus de détail au début.
  const initialFrames = Array.from({ length: CONFIG.totalFrames }, (_, i) => i)
    .filter(i => i < 30 || i % 5 === 0 || i === CONFIG.totalFrames - 1);
  const initialSet = new Set(initialFrames);
  const initialTotal = initialFrames.length;
  const maxConcurrent = 6;
  const cacheLimit = CONFIG.totalFrames;
  let started = false;
  let initialDone = 0;
  let initialPhase = true;
  let active = 0;
  let target = 0;
  let overlay;
  let indicator;
  let safetyTimer;
  let complete;
  let previousOverflow;

  function finish() {
    if (!initialPhase) return;
    initialPhase = false;
    clearTimeout(safetyTimer);
    indicator?.destroy();
    overlay?.remove();
    document.body.style.overflow = previousOverflow;
    complete();
    pump();
  }

  function load(onComplete) {
    if (started) return;
    started = true;
    complete = onComplete;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    try {
      overlay = document.createElement('div');
      overlay.id = 'loader';
      document.body.append(overlay);
      indicator = createTraitLoader({ container: overlay });
    } catch (error) {
      overlay?.remove();
      console.warn('Loader indisponible :', error);
    }
    // Libérer la page si une requête ou le navigateur reste bloqué.
    safetyTimer = setTimeout(finish, 15000);
    pump();
  }

  function nextIndex() {
    if (initialPhase) {
      for (const i of initialFrames) {
        if (!images.has(i) && !pending.has(i) && !failed.has(i)) return i;
      }
      return null;
    }
    // Priorité à la position courante, puis aux images voisines.
    for (let distance = 0; distance <= 50; distance++) {
      for (const i of distance ? [target + distance, target - distance] : [target]) {
        if (i >= 0 && i < CONFIG.totalFrames && !images.has(i) && !pending.has(i) && !failed.has(i)) return i;
      }
    }
    // Remplir progressivement le reste de la séquence en arrière-plan.
    for (let i = 0; i < CONFIG.totalFrames; i++) {
      if (!images.has(i) && !pending.has(i) && !failed.has(i)) return i;
    }
    return null;
  }

  function pump() {
    while (active < maxConcurrent) {
      const index = nextIndex();
      if (index === null) break;
      active++;
      pending.add(index);
      const img = new Image();
      img.decoding = 'async';
      img.onload = img.onerror = () => {
        active--;
        pending.delete(index);
        if (img.naturalWidth) images.set(index, img);
        else failed.add(index);
        if (initialPhase && initialSet.has(index)) {
          initialDone++;
          indicator?.setProgress(initialDone / initialTotal * 100);
          if (initialDone === initialTotal) {
            clearTimeout(safetyTimer);
            safetyTimer = setTimeout(finish, 180);
          }
        }
        trimCache();
        if (!initialPhase && Math.abs(index - target) <= 2 && typeof Scroll !== 'undefined') Scroll.requestDraw();
        pump();
      };
      img.src = CONFIG.framePath(index);
    }
  }

  function trimCache() {
    if (initialPhase || images.size <= cacheLimit) return;
    const indexes = [...images.keys()].sort((a, b) => Math.abs(b - target) - Math.abs(a - target));
    while (images.size > cacheLimit) images.delete(indexes.shift());
  }

  function request(index) {
    target = Math.max(0, Math.min(CONFIG.totalFrames - 1, index));
    if (!initialPhase) { trimCache(); pump(); }
  }

  function get(index) {
    if (images.has(index)) return images.get(index);
    let closest = null;
    for (const [i, image] of images) {
      if (closest === null || Math.abs(i - index) < Math.abs(closest[0] - index)) closest = [i, image];
    }
    return closest?.[1] || null;
  }

  return { load, get, request };
})();
window.Loader = Loader;
