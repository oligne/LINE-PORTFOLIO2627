const PortfolioCarousels = (() => {
  const instances = [];
  let ticking = false;

  const carouselConfigs = [
    {
      id: 'carousel-section',
      label: 'Diplome project',
      images: [
        { src: './docs/proj_diplome/JOUSSETColine_photo_03.png', width: 2406, height: 1600 },
        { src: './docs/proj_diplome/JOUSSETColine_photo_04.png', width: 2605, height: 1630 },
        { src: './docs/proj_diplome/JOUSSETColine_photo_06.png', width: 1600, height: 2406 },
        { src: './docs/proj_diplome/JOUSSETColine_photo_07.png', width: 1368, height: 1948 }
      ]
    },
    {
      id: 'windows-carousel-section',
      label: 'Windows project',
      images: [
        { src: './docs/windows/JOUSSETColine_rendu3D_01.png', width: 449, height: 590 },
        { src: './docs/windows/JOUSSETColine_rendu3D_02.png', width: 420, height: 592 },
        { src: './docs/windows/JOUSSETColine_rendu3D_03.png', width: 955, height: 588 },
        { src: './docs/windows/JOUSSETColine_rendu3D_04.png', width: 480, height: 587 },
        { src: './docs/windows/JOUSSETColine_rendu3D_05.png', width: 483, height: 592 }
      ]
    }
  ];

  function init() {
    carouselConfigs.forEach((config) => {
      const instance = createCarousel(config);
      if (instance) instances.push(instance);
    });

    if (!instances.length) return;

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', () => {
      instances.forEach(refreshLayout);
      requestUpdate();
    });

    instances.forEach(refreshLayout);
    requestUpdate();

    console.log(`✅ ${instances.length} portfolio carousel(s) initialized`);
  }

  function createCarousel(config) {
    const section = document.getElementById(config.id);
    if (!section) {
      console.warn(`⚠️ Carousel section not found: ${config.id}`);
      return null;
    }

    const horizontalScroll = section.querySelector('.horizontal-scroll');
    const scrollContent = section.querySelector('.scroll-content');

    if (!horizontalScroll || !scrollContent) {
      console.warn(`⚠️ Carousel elements not found: ${config.id}`);
      return null;
    }

    const instance = {
      config,
      section,
      horizontalScroll,
      scrollContent,
      pinDistance: 0,
      initialTranslate: 20,
      finalTranslate: 20,
      textAnchorOffset: 0,
      textAnchorWidth: 0,
      textGap: 0
    };

    config.images.forEach((image, index) => {
      const img = document.createElement('img');
      img.src = image.src;
      img.width = image.width;
      img.height = image.height;
      img.alt = `${config.label} ${index + 1}`;
      img.className = 'carousel-image';
      img.style.setProperty('--image-ratio', `${image.width} / ${image.height}`);
      img.decoding = 'async';
      img.loading = 'eager';
      scrollContent.appendChild(img);
    });

    return instance;
  }

  function refreshLayout(instance) {
    const { section, horizontalScroll, scrollContent } = instance;

    const images = scrollContent.querySelectorAll('.carousel-image');
    const firstRemainingImage = images[Math.max(images.length - 2, 0)];
    const textAnchorImage = images[images.length - 1];
    const scrollContentRect = scrollContent.getBoundingClientRect();
    const firstRemainingOffset = firstRemainingImage ? firstRemainingImage.offsetLeft : 0;
    instance.textAnchorOffset = textAnchorImage ? textAnchorImage.offsetLeft : 0;
    instance.textAnchorWidth = textAnchorImage ? textAnchorImage.offsetWidth : 0;
    const targetFirstRemainingLeft = window.innerWidth < 700
      ? 8
      : 10;
    instance.textGap = window.innerWidth < 700
      ? window.innerWidth * 0.08
      : window.innerWidth * 0.07;

    instance.initialTranslate = window.innerWidth < 700 ? 14 : 20;
    instance.finalTranslate = targetFirstRemainingLeft - firstRemainingOffset;

    const horizontalTravel = Math.abs(instance.finalTranslate - instance.initialTranslate);
    const minPinDistance = window.innerHeight * 2.9;
    instance.pinDistance = Math.max(minPinDistance, horizontalTravel * 1.42);

    section.style.minHeight = `${horizontalScroll.offsetHeight + instance.pinDistance}px`;

    if (!scrollContentRect.width) {
      scrollContent.style.transform = `translate3d(${instance.initialTranslate}px, 0, 0)`;
    }
  }

  function requestUpdate() {
    if (ticking) return;

    ticking = true;
    requestAnimationFrame(() => {
      updateAll();
      ticking = false;
    });
  }

  function updateAll() {
    instances.forEach(update);
  }

  function update(instance) {
    const { section, horizontalScroll, scrollContent } = instance;

    const sectionTop = section.getBoundingClientRect().top + window.scrollY;
    const stickyTop = (window.innerHeight - horizontalScroll.offsetHeight) / 2;
    const stickyStart = sectionTop - stickyTop;
    const leadInDistance = getLeadInDistance();
    const rawProgress = (window.scrollY - stickyStart + leadInDistance) / instance.pinDistance;
    const progress = clamp(rawProgress, 0, 1);
    const smoothProgress = smoothstep(progress);
    const translateX = lerp(instance.initialTranslate, instance.finalTranslate, smoothProgress);
    const textProgress = clamp((progress - 0.74) / 0.18, 0, 1);
    const textLeft = instance.textAnchorOffset + translateX + instance.textAnchorWidth + instance.textGap;

    scrollContent.style.transform = `translate3d(${translateX}px, 0, 0)`;
    horizontalScroll.style.setProperty('--carousel-text-left', `${textLeft}px`);
    horizontalScroll.style.setProperty('--carousel-text-opacity', easeOutCubic(textProgress));
    horizontalScroll.style.setProperty('--carousel-text-y', `${lerp(18, 0, easeOutCubic(textProgress))}px`);
  }

  function getLeadInDistance() {
    return Math.min(window.innerHeight * 0.42, 360);
  }

  function lerp(start, end, progress) {
    return start + (end - start) * progress;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
  }

  function smoothstep(value) {
    return value * value * (3 - 2 * value);
  }

  // API publique
  return {
    init
  };
})();

// Initialiser quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    PortfolioCarousels.init();
  });
} else {
  PortfolioCarousels.init();
}
