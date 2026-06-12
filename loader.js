const Loader = (() => {
  const images = new Array(CONFIG.totalFrames);
  let loadedCount = 0;
  const loaderEl = document.getElementById('loader');
  const loaderText = document.getElementById('loader-text');

  function load(onComplete) {
    for (let i = 0; i < CONFIG.totalFrames; i++) {
      const img = new Image();
      img.src = CONFIG.framePath(i);
      img.onload = img.onerror = () => {
        loadedCount++;
        loaderText.textContent = `Loading — ${Math.round(loadedCount / CONFIG.totalFrames * 100)}%`;
        if (loadedCount === CONFIG.totalFrames) {
          loaderEl.classList.add('hidden');
          onComplete();
        }
      };
      images[i] = img;
    }
  }

  function get(i) { return images[i] || null; }

  return { load, get };
})();
