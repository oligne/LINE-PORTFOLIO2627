(() => {
  const sections = document.querySelectorAll('.category-carousel');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let ticking = false;

  function update() {
    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (section.classList.contains('project-category')) {
        const viewport = section.querySelector('.project-category-viewport');
        const track = section.querySelector('.project-category-track');
        const distance = Math.max(section.offsetHeight - viewport.offsetHeight, 1);
        const progress = Math.min(Math.max((window.innerHeight * 0.22 - rect.top) / distance, 0), 1);
        const travel = Math.max(track.scrollWidth - viewport.clientWidth, 0);
        section.style.setProperty('--project-shift', `${-travel * progress}px`);
        section.style.setProperty('--intro-opacity', Math.max(0, 1 - progress * 3));
      } else {
        const distance = Math.max(section.offsetHeight - window.innerHeight * 0.5, 1);
        const progress = Math.min(Math.max((window.innerHeight * 0.25 - rect.top) / distance, 0), 1);
        section.style.setProperty('--category-shift', `${reducedMotion.matches ? 0 : -20 * progress}px`);
      }
    });
    ticking = false;
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  window.addEventListener('load', requestUpdate);
  reducedMotion.addEventListener('change', requestUpdate);
  requestUpdate();
})();
