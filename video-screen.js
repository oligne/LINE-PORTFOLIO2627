const VideoScreen = (() => {
  let trackingData = null;
  let videoElement = null;
  let isReady = false;
  let videoStarted = false;
  let videoStartFrame = 480;
  let currentFrame = 0;
  let autoSwitchInterval = null;
  let currentStateIndex = 0;
  let videoFadeAlpha = 1; // Pour le fade de la vidéo

  // Définition des 3 états avec leurs ressources
  const states = [
    {
      name: 'state1',
      videoSrc: './docs/vid01HP.mov',
      title: 'I see digital tools as',
      description: 'a way to reshape our sensibility'
    },
    {
      name: 'state2',
      videoSrc: './docs/vid02HP.mp4',
      title: 'I transform digital into a way to rediscover',
      description: 'mouvement, sensation and emotions'
    },
    {
      name: 'state3',
      videoSrc: './docs/vid03HP.mp4',
      title: 'I explore links between',
      description: 'screen, space and mind.'
    }
  ];

  // Charger les données de tracking
  async function loadTrackingData() {
    try {
      const response = await fetch('./screentrackingdata.json');
      trackingData = await response.json();
      console.log('✅ Tracking data chargée:', Object.keys(trackingData.frames).length, 'frames');
    } catch (error) {
      console.error('❌ Erreur chargement tracking:', error);
    }
  }

  // Créer video element
  function initVideo() {
    videoElement = document.createElement('video');
    videoElement.src = states[currentStateIndex].videoSrc;
    videoElement.loop = true;
    videoElement.muted = true;
    videoElement.crossOrigin = 'anonymous';
    videoElement.style.display = 'none';
    document.body.appendChild(videoElement);
    
    videoElement.addEventListener('loadedmetadata', () => {
      console.log('✅ Vidéo chargée - durée:', videoElement.duration, 's');
      console.log('📹 Dimensions vidéo:', videoElement.videoWidth, 'x', videoElement.videoHeight);
      isReady = true;
    });

    videoElement.addEventListener('error', (e) => {
      console.error('❌ Erreur vidéo:', e);
    });

    videoElement.addEventListener('play', () => {
      console.log('▶️ Vidéo playing - currentTime:', videoElement.currentTime);
    });

    videoElement.addEventListener('pause', () => {
      console.log('⏸️ Vidéo paused - currentTime:', videoElement.currentTime);
    });

    videoElement.addEventListener('timeupdate', () => {
      if (Math.floor(videoElement.currentTime) % 10 === 0) {
        console.log('⏱️ Vidéo time:', videoElement.currentTime, '/', videoElement.duration);
      }
    });
  }

  // Changer d'état (vidéo + texte)
  function switchState(newStateIndex) {
    if (newStateIndex === currentStateIndex) return;
    
    currentStateIndex = newStateIndex;
    const state = states[currentStateIndex];
    
    console.log('🔄 Changement d\'état vers:', state.name);
    
    // Animer le texte
    updateTextOverlay(state.title, state.description);
    
    // Reset le timer auto-switch pour que la nouvelle vidéo reste 5 secondes
    stopAutoSwitch();
    if (videoStarted) {
      startAutoSwitch();
    }
    
    // Fade-out de la vidéo (100ms)
    const fadeOutDuration = 100;
    const fadeOutStart = Date.now();
    
    const fadeOutInterval = setInterval(() => {
      const elapsed = Date.now() - fadeOutStart;
      const progress = Math.min(elapsed / fadeOutDuration, 1);
      videoFadeAlpha = 1 - progress;
      
      if (progress >= 1) {
        clearInterval(fadeOutInterval);
        
        // Changer la vidéo au point fade-out maximum
        if (videoStarted && videoElement) {
          videoElement.pause();
          videoElement.currentTime = 0;
          videoElement.src = state.videoSrc;
          videoElement.load();
          videoElement.play().catch(e => console.log('Auto-play bloqué:', e));
        }
        
        // Fade-in de la nouvelle vidéo (100ms)
        const fadeInDuration = 100;
        const fadeInStart = Date.now();
        
        const fadeInInterval = setInterval(() => {
          const elapsedIn = Date.now() - fadeInStart;
          const progressIn = Math.min(elapsedIn / fadeInDuration, 1);
          videoFadeAlpha = progressIn;
          
          if (progressIn >= 1) {
            clearInterval(fadeInInterval);
          }
        }, 16);
      }
    }, 16);
  }

  // Mettre à jour les indicateurs de points
  function updateDots() {
    const dots = document.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
      if (index === currentStateIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  // Mettre à jour l'overlay de texte avec animation de fondu fluide
  function updateTextOverlay(title, description) {
    const contentElement = document.getElementById('video-text-content');
    const titleElement = document.getElementById('video-text-title');
    const descElement = document.getElementById('video-text-description');
    if (!contentElement || !titleElement || !descElement) return;
    
    // Fade out progressif
    contentElement.classList.remove('show');
    
    // Attendre la fin de la transition fade out (400ms), changer le texte, puis fade in
    setTimeout(() => {
      titleElement.textContent = title;
      descElement.textContent = description;
      contentElement.classList.add('show');
      updateDots();
    }, 400);
  }

  // Masquer l'overlay de texte
  function hideTextOverlay() {
    const contentElement = document.getElementById('video-text-content');
    if (contentElement) contentElement.classList.remove('show');
  }

  // Obtenir les points pour une frame donnée
  function getPointsForFrame(frameNum) {
    if (!trackingData || !trackingData.frames) return null;
    const frameStr = frameNum.toString();
    return trackingData.frames[frameStr];
  }

  // Dessiner la vidéo avec crop intelligent pour éviter la distorsion
  function drawVideoOnScreen(ctx, frameNum) {
    if (!isReady || !videoElement) return;

    const points = getPointsForFrame(frameNum);
    if (!points) return;

    const mainCanvas = document.getElementById('anim-canvas');
    
    // Récupérer la première frame pour connaître les dimensions de référence
    const referenceImg = Loader.get(frameNum);
    if (!referenceImg || !referenceImg.naturalWidth) return;

    // Utiliser les VRAIES dimensions du canvas (width/height), pas offsetWidth/offsetHeight
    const refWidth = referenceImg.naturalWidth;
    const refHeight = referenceImg.naturalHeight;
    
    const canvasWidth = mainCanvas.width;
    const canvasHeight = mainCanvas.height;
    
    const scaleX = canvasWidth / refWidth;
    const scaleY = canvasHeight / refHeight;

    // Appliquer le scale aux points
    const { tl, tr, bl, br } = points;
    const scaledTL = { x: tl.x * scaleX, y: tl.y * scaleY };
    const scaledTR = { x: tr.x * scaleX, y: tr.y * scaleY };
    const scaledBL = { x: bl.x * scaleX, y: bl.y * scaleY };
    const scaledBR = { x: br.x * scaleX, y: br.y * scaleY };

    ctx.save();

    // Appliquer le fade alpha juste avant de dessiner la vidéo
    ctx.globalAlpha = videoFadeAlpha;

    // Créer un chemin pour le clipping avec les points scalés
    ctx.beginPath();
    ctx.moveTo(scaledTL.x, scaledTL.y);
    ctx.lineTo(scaledTR.x, scaledTR.y);
    ctx.lineTo(scaledBR.x, scaledBR.y);
    ctx.lineTo(scaledBL.x, scaledBL.y);
    ctx.closePath();
    ctx.clip();

    // Calculer la bounding box
    const minX = Math.min(scaledTL.x, scaledTR.x, scaledBL.x, scaledBR.x);
    const minY = Math.min(scaledTL.y, scaledTR.y, scaledBL.y, scaledBR.y);
    const maxX = Math.max(scaledTL.x, scaledTR.x, scaledBL.x, scaledBR.x);
    const maxY = Math.max(scaledTL.y, scaledTR.y, scaledBL.y, scaledBR.y);

    const screenWidth = maxX - minX;
    const screenHeight = maxY - minY;

    // Calculer les aspect ratios
    const screenAspectRatio = screenWidth / screenHeight;
    const videoWidth = videoElement.videoWidth || 1920;
    const videoHeight = videoElement.videoHeight || 1080;
    const videoAspectRatio = videoWidth / videoHeight;

    // Déterminer le crop pour matcher l'aspect ratio de l'écran SANS DEFORMER
    let sourceWidth, sourceHeight;
    
    if (screenAspectRatio > videoAspectRatio) {
      sourceWidth = videoWidth;
      sourceHeight = videoWidth / screenAspectRatio;
    } else {
      sourceHeight = videoHeight;
      sourceWidth = videoHeight * screenAspectRatio;
    }

    // Centrer le crop
    const sourceX = (videoWidth - sourceWidth) / 2;
    const sourceY = (videoHeight - sourceHeight) / 2;

    // Dessiner la vidéo croppée sans déformation
    ctx.drawImage(
      videoElement,
      sourceX, sourceY, sourceWidth, sourceHeight,
      minX, minY, screenWidth, screenHeight
    );

    ctx.restore();
  }

  // Démarrer le basculement automatique toutes les 8s
  function startAutoSwitch() {
    autoSwitchInterval = setInterval(() => {
      const nextStateIndex = (currentStateIndex + 1) % states.length;
      switchState(nextStateIndex);
    }, 8000);
  }

  // Arrêter le basculement automatique
  function stopAutoSwitch() {
    if (autoSwitchInterval) {
      clearInterval(autoSwitchInterval);
      autoSwitchInterval = null;
    }
  }

  // Ajouter des points cliquables sur le canvas
  function setupClickListeners() {
    const mainCanvas = document.getElementById('anim-canvas');
    
    // Click sur les coins de l'écran
    mainCanvas.addEventListener('click', (e) => {
      if (currentFrame < 469 || currentFrame > 500) return;
      
      const rect = mainCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Vérifier si on clique près des coins de l'écran tracké
      const points = getPointsForFrame(currentFrame);
      if (!points) return;
      
      const referenceImg = Loader.get(currentFrame);
      const scaleX = mainCanvas.width / referenceImg.naturalWidth;
      const scaleY = mainCanvas.height / referenceImg.naturalHeight;
      
      const scaledTL = { x: points.tl.x * scaleX, y: points.tl.y * scaleY };
      const scaledTR = { x: points.tr.x * scaleX, y: points.tr.y * scaleY };
      const scaledBL = { x: points.bl.x * scaleX, y: points.bl.y * scaleY };
      const scaledBR = { x: points.br.x * scaleX, y: points.br.y * scaleY };
      
      const threshold = 50; // pixels
      
      // Vérifier les 4 coins
      if (Math.hypot(x - scaledTL.x, y - scaledTL.y) < threshold) {
        switchState(0);
      } else if (Math.hypot(x - scaledTR.x, y - scaledTR.y) < threshold) {
        switchState(1);
      } else if (Math.hypot(x - scaledBL.x, y - scaledBL.y) < threshold) {
        switchState(2);
      } else if (Math.hypot(x - scaledBR.x, y - scaledBR.y) < threshold) {
        switchState(2);
      }
    });
    
    // Click sur les points indicateurs
    const dots = document.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentFrame >= 482) {
          switchState(index);
        }
      });
    });
  }

  // Hook dans le système Canvas existant
  function init() {
    initVideo();
    loadTrackingData();
    setupClickListeners();

    console.log('🔧 Avant de hooker Canvas.draw - Canvas:', typeof Canvas, 'Canvas.draw:', typeof Canvas.draw);

    const originalDraw = Canvas.draw;
    Canvas.draw = function(index, scrollProgress = 0) {
      currentFrame = index;
      
      originalDraw.call(Canvas, index, scrollProgress);

      // Déclencher autoplay quand on atteint frame 482+
      if (index >= videoStartFrame && !videoStarted && isReady) {
        videoStarted = true;
        videoElement.play().catch(e => console.log('Auto-play bloqué:', e));
        console.log('🎬 Vidéo autoplay démarrée à frame', index);
        
        // Démarrer le basculement automatique
        startAutoSwitch();
        // Afficher le texte avec le premier état
        const state = states[currentStateIndex];
        updateTextOverlay(state.title, state.description);
        startVideoLoop();
      }

      // Arrêter la vidéo si on revient en dessous de videoStartFrame
      if (index < videoStartFrame && videoStarted) {
        videoStarted = false;
        videoElement.pause();
        videoElement.currentTime = 0;
        stopAutoSwitch();
        hideTextOverlay();
        console.log('⏹️ Vidéo arrêtée à frame', index);
      }

      // Ajouter la vidéo si on est dans la plage 469-500
      if (index >= 469 && index <= 500) {
        const mainCanvas = document.getElementById('anim-canvas');
        const mainCtx = mainCanvas.getContext('2d');
        
        // Si pas en autoplay, synchro la vidéo avec le scroll
        if (!videoStarted && videoElement && isReady) {
          // Map la frame au temps de la vidéo (proportionnel)
          const videoDuration = videoElement.duration || 10;
          const frameRange = 500 - 469; // 31 frames
          const frameProgress = (index - 469) / frameRange;
          videoElement.currentTime = frameProgress * videoDuration;
        }
        
        drawVideoOnScreen(mainCtx, index);
      }

      // Afficher le texte progressivement à partir de frame 480
      if (index >= 480 && index < videoStartFrame) {
        const contentElement = document.getElementById('video-text-content');
        const dotsElement = document.getElementById('video-text-dots');
        const overlayElement = document.getElementById('video-text-overlay');
        if (contentElement && overlayElement && dotsElement) {
          // Positionner le texte à droite et en bas de l'écran tracké
          const points = getPointsForFrame(index);
          if (points) {
            const referenceImg = Loader.get(index);
            const mainCanvas = document.getElementById('anim-canvas');
            const scaleX = mainCanvas.width / referenceImg.naturalWidth;
            const scaleY = mainCanvas.height / referenceImg.naturalHeight;
            
            const scaledTR = { x: points.tr.x * scaleX, y: points.tr.y * scaleY };
            const scaledBR = { x: points.br.x * scaleX, y: points.br.y * scaleY };
            
            overlayElement.style.left = (scaledBR.x + 60) + 'px';
            overlayElement.style.top = (scaledTR.y + 20) + 'px';
          }
          
          // Fade in progressif basé sur la progression de la frame (480+)
          const fadeProgress = Math.max(0, (index - 480) / 2);
          contentElement.style.setProperty('--scroll-opacity', Math.min(fadeProgress, 1));
          dotsElement.style.opacity = Math.min(fadeProgress, 1);
        }
      } else if (index < 480 && index >= 469) {
        // Fade out progressif quand on revient avant frame 480
        const contentElement = document.getElementById('video-text-content');
        const dotsElement = document.getElementById('video-text-dots');
        const overlayElement = document.getElementById('video-text-overlay');
        if (contentElement && overlayElement && dotsElement) {
          // Positionner le texte à droite et en bas de l'écran tracké
          const points = getPointsForFrame(index);
          if (points) {
            const referenceImg = Loader.get(index);
            const mainCanvas = document.getElementById('anim-canvas');
            const scaleX = mainCanvas.width / referenceImg.naturalWidth;
            const scaleY = mainCanvas.height / referenceImg.naturalHeight;
            
            const scaledTR = { x: points.tr.x * scaleX, y: points.tr.y * scaleY };
            const scaledBR = { x: points.br.x * scaleX, y: points.br.y * scaleY };
            
            overlayElement.style.left = (scaledBR.x + 60) + 'px';
            overlayElement.style.top = (scaledTR.y + 20) + 'px';
          }
          
          const fadeProgress = (index - 469) / (480 - 469);
          contentElement.style.setProperty('--scroll-opacity', Math.max(fadeProgress, 0));
          dotsElement.style.opacity = Math.max(fadeProgress, 0);
        }
      } else if (index >= videoStartFrame) {
        // Une fois la vidéo lancée, garder le texte visible et positionner à droite de l'écran
        const contentElement = document.getElementById('video-text-content');
        const dotsElement = document.getElementById('video-text-dots');
        const overlayElement = document.getElementById('video-text-overlay');
        if (contentElement && overlayElement && dotsElement) {
          const points = getPointsForFrame(index);
          if (points) {
            const referenceImg = Loader.get(index);
            const mainCanvas = document.getElementById('anim-canvas');
            const scaleX = mainCanvas.width / referenceImg.naturalWidth;
            const scaleY = mainCanvas.height / referenceImg.naturalHeight;
            
            const scaledTR = { x: points.tr.x * scaleX, y: points.tr.y * scaleY };
            const scaledBR = { x: points.br.x * scaleX, y: points.br.y * scaleY };
            
            overlayElement.style.left = (scaledBR.x + 60) + 'px';
            overlayElement.style.top = (scaledTR.y + 20) + 'px';
          }
          
          contentElement.style.setProperty('--scroll-opacity', '1');
          dotsElement.style.opacity = '1';
        }
      } else if (index < 469) {
        // Avant frame 469, texte invisible
        const contentElement = document.getElementById('video-text-content');
        const dotsElement = document.getElementById('video-text-dots');
        if (contentElement && dotsElement) {
          contentElement.style.setProperty('--scroll-opacity', '0');
          dotsElement.style.opacity = '0';
        }
      }
    };

    console.log('✅ VideoScreen initialisé (Canvas 2D)');
  }

  // Boucle de rendu indépendante pour la vidéo
  function startVideoLoop() {
    function loop() {
      if (videoStarted && isReady && videoElement && !videoElement.paused) {
        // Forcer un redraw du canvas quand la vidéo joue
        // Cela assure que même si le scroll est arrêté, on continue à voir la vidéo
        const mainCanvas = document.getElementById('anim-canvas');
        const mainCtx = mainCanvas.getContext('2d');
        
        // Redessiner la vidéo à sa position actuelle
        if (currentFrame >= videoStartFrame) {
          drawVideoOnScreen(mainCtx, currentFrame);
        }
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  return { init, switchState };
})();
