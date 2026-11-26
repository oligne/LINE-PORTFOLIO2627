(() => {
  const form = document.querySelector('#contact-form');
  const targets = { name: 15, email: 15, subject: 15, message: 30 };
  const progress = createTraitLoader({
    container: '#contact-progress',
    size: 120,
    showPercentage: false,
    label: window.PortfolioI18n.t('pages.contact.progress')
  });

  progress.element.setAttribute('aria-valuemin', '0');

  function updateProgress() {
    const shortFields = ['name', 'email', 'subject'];
    const shortProgress = shortFields.reduce((total, name) => {
      return total + form.elements[name].value.trim().length;
    }, 0);
    const shortTarget = targets.name + targets.email + targets.subject;
    const countedShortProgress = shortTarget * (1 - Math.exp(-2 * shortProgress / shortTarget));
    const messageProgress = Math.min(form.elements.message.value.trim().length / targets.message, 1);
    const allShortFieldsFilled = shortFields.every((name) => form.elements[name].value.trim().length > 0);
    const totalTarget = shortTarget + targets.message;
    const remaining = allShortFieldsFilled ? totalTarget - countedShortProgress : targets.message;
    const value = (countedShortProgress + messageProgress * remaining) / totalTarget * 100;
    progress.setProgress(value);
    progress.element.setAttribute('aria-valuenow', String(Math.round(value)));
    progress.element.setAttribute('aria-label', window.PortfolioI18n.t('pages.contact.progress'));
  }

  form.addEventListener('input', updateProgress);
  document.querySelectorAll('[data-language-option]').forEach((button) => {
    button.addEventListener('click', updateProgress);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    const message = form.elements.message.value.trim();
    const subject = form.elements.subject.value.trim();
    const body = `${message}\n\n${name}\n${email}`;
    window.location.href = `mailto:contact@colinejousset.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
  updateProgress();
})();
