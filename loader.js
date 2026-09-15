const Loader = (() => {
  const images = new Array(CONFIG.totalFrames);
  let loadedCount = 0;
  let nextIndexToLoad = 0;
  const loaderEl = document.getElementById('loader');
  const loaderText = document.getElementById('loader-text');
  const maxConcurrentLoads = Math.max(4, Math.min(12, navigator.hardwareConcurrency || 8));

  function load(onComplete) {
    if (!CONFIG.totalFrames) {
      loaderEl.classList.add('hidden');
      onComplete();
      return;
    }

    const initialLoads = Math.min(CONFIG.totalFrames, maxConcurrentLoads);
    for (let i = 0; i < initialLoads; i += 1) {
      loadNext(onComplete);
    }
  }

  function loadNext(onComplete) {
    if (nextIndexToLoad >= CONFIG.totalFrames) return;

    const index = nextIndexToLoad;
    nextIndexToLoad += 1;

    const img = new Image();
    img.decoding = 'async';
    img.src = CONFIG.framePath(index);
    img.onload = img.onerror = () => {
      loadedCount += 1;
      const label = window.PortfolioI18n?.t('loaderTextSuffix') || 'Loading';
      loaderText.textContent = `${label} — ${Math.round(loadedCount / CONFIG.totalFrames * 100)}%`;

      if (loadedCount === CONFIG.totalFrames) {
        loaderEl.classList.add('hidden');
        if (loaderText) loaderText.textContent = window.PortfolioI18n?.t('loaderTextDone') || 'Loading complete';
        onComplete();
        return;
      }

      loadNext(onComplete);
    };

    images[index] = img;
  }

  function get(i) { return images[i] || null; }

  function refreshLanguage() {
    if (!loaderText) return;
    if (loadedCount === CONFIG.totalFrames) {
      loaderText.textContent = window.PortfolioI18n?.t('loaderTextDone') || 'Loading complete';
      return;
    }

    const label = window.PortfolioI18n?.t('loaderTextSuffix') || 'Loading';
    loaderText.textContent = `${label} — ${Math.round(loadedCount / CONFIG.totalFrames * 100)}%`;
  }

  return { load, get, refreshLanguage };
})();

window.Loader = Loader;
