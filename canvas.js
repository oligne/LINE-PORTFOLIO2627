const Canvas = (() => {
  const canvas = document.getElementById('anim-canvas');
  const ctx = canvas.getContext('2d');
  let lastFrame = 0;
  let craftingImg = null;
  let digitalImg = null;

  function preloadImages() {
    craftingImg = new Image();
    craftingImg.src = './docs/txt1.png';
    
    digitalImg = new Image();
    digitalImg.src = './docs/txt2.png';
  }

  function drawOverlayImages(frame) {
    if (frame >= 200 && frame < 430) { // Les 200 dernières frames (200-400) + suite jusqu'à 430
      const opacity = frame < 400 ? (frame - 200) / 200 : Math.max(0, 1 - (frame - 400) / 30); // Fade in progressif puis fade out
      ctx.globalAlpha = opacity;
      
      // Crafting à gauche - même taille que le canvas
      if (craftingImg && craftingImg.complete) {
        ctx.drawImage(craftingImg, 0, 0, canvas.width, canvas.height);
      }
      
      // Through digital à droite - même taille que le canvas
      if (digitalImg && digitalImg.complete) {
        ctx.drawImage(digitalImg, 0, 0, canvas.width, canvas.height);
      }
      
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
    const img = Loader.get(index);
    if (!img || !img.complete || !img.naturalWidth) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const x = (canvas.width - img.naturalWidth * scale) / 2;
    const y = (canvas.height - img.naturalHeight * scale) / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, x, y, img.naturalWidth * scale, img.naturalHeight * scale);
    
    drawOverlayImages(index);
    drawBlurGradient(scrollProgress);
  }

  window.addEventListener('resize', () => draw(lastFrame));
  
  preloadImages();

  return { draw };
})();
