const Scroll = (() => {
  const wrapper = document.getElementById('scroll-wrapper');
  let ticking = false;

  function getScrollState() {
    const rect = wrapper.getBoundingClientRect();
    const scrollable = wrapper.offsetHeight - (window.innerHeight - 52);
    const scrolled = Math.max(0, -rect.top);
    const progress = Math.min(scrolled / scrollable, 1);
    
    // Calculer les frames avec ralentissement de 2x après 400
    let frame = progress * 600;
    
    if (frame >= 400) {
      // Entre frame 400 et 500, on ralentit : il faut 2x plus de scroll
      const scrolledAfter400 = (frame - 400) / 2;
      frame = Math.min(400 + scrolledAfter400, 500);
    }
    
    return {
      frame: Math.round(frame),
      progress
    };
  }

  function requestDraw() {
    if (ticking) return;

    ticking = true;
    requestAnimationFrame(() => {
      const { frame, progress } = getScrollState();
      Canvas.draw(frame, progress);
      ticking = false;
    });
  }

  function init() {
    window.addEventListener('scroll', requestDraw, { passive: true });
  }

  return { init };
})();
