const Canvas = (() => {
  const canvas = document.getElementById('anim-canvas');
  const ctx = canvas.getContext('2d');
  let lastFrame = 0;
  let lastScrollProgress = 0;
  let craftingImg = null;
  let digitalImg = null;

  function preloadImages() {
    craftingImg = new Image();
    craftingImg.onload = () => draw(lastFrame, lastScrollProgress);
    craftingImg.src = './docs/txt1_SVG.svg';
    
    digitalImg = new Image();
    digitalImg.onload = () => draw(lastFrame, lastScrollProgress);
    digitalImg.src = './docs/txt2_SVG.svg';
  }

  function drawOverlayImages(frame) {
    if (frame >= 200 && frame < 430) { // Les 200 dernières frames (200-400) + suite jusqu'à 430
      const opacity = frame < 400 ? (frame - 200) / 200 : Math.max(0, 1 - (frame - 400) / 30); // Fade in progressif puis fade out
      ctx.globalAlpha = opacity;
      
      // Les SVG sont placés indépendamment du format de la fenêtre, sans
      // étirer leur typographie. Les proportions reprennent les visuels d'origine.
      const drawText = (image, left, width) => {
        if (!image || !image.complete || !image.naturalWidth) return;
        const drawWidth = canvas.width * width;
        const drawHeight = drawWidth * image.naturalHeight / image.naturalWidth;
        ctx.drawImage(image, canvas.width * left, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
      };

      drawText(craftingImg, 273 / 3841, 957 / 3841);
      drawText(digitalImg, 2669 / 3841, 794 / 3841);

      ctx.globalAlpha = 1;
    }
  }

  function drawBlurGradient(scrollProgress) {
    // Après frame 500, ajouter un flou progressif en bas
    // Frame 500 est atteint à environ 83% du scroll (500/600)
    const blurStartProgress = 0.83;
    
    if (scrollProgress >= blurStartProgress) {
      const blurProgress = Math.min((scrollProgress - blurStartProgress) / (1 - blurStartProgress), 1);
      
      // Gradient de flou plus naturel du bas vers le haut
      const gradient = ctx.createLinearGradient(0, canvas.height * 0.5, 0, canvas.height);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(0.5, `rgba(255, 255, 255, ${blurProgress * 0.3})`);
      gradient.addColorStop(1, `rgba(255, 255, 255, ${blurProgress})`);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function draw(index, scrollProgress = 0) {
    lastFrame = index;
    lastScrollProgress = scrollProgress;
    Loader.request(index);
    const img = Loader.get(index);
    if (!img || !img.complete || !img.naturalWidth) return;

    resizeCanvasIfNeeded();

    const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const x = (canvas.width - img.naturalWidth * scale) / 2;
    const y = (canvas.height - img.naturalHeight * scale) / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, x, y, img.naturalWidth * scale, img.naturalHeight * scale);
    
    drawOverlayImages(index);
    drawBlurGradient(scrollProgress);
  }

  function resizeCanvasIfNeeded() {
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  window.addEventListener('resize', () => draw(lastFrame, lastScrollProgress));
  
  preloadImages();

  return { draw };
})();
