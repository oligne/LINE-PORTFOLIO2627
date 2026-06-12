const Scroll = (() => {
  const wrapper = document.getElementById('scroll-wrapper');

  function getFrame() {
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
    
    return Math.round(frame);
  }

  function getScrollProgress() {
    const rect = wrapper.getBoundingClientRect();
    const scrollable = wrapper.offsetHeight - (window.innerHeight - 52);
    const scrolled = Math.max(0, -rect.top);
    return Math.min(scrolled / scrollable, 1);
  }

  function init() {
    window.addEventListener('scroll', () => {
      Canvas.draw(getFrame(), getScrollProgress());
    }, { passive: true });
  }

  return { init };
})();
