const root = document.documentElement;
const motionButton = document.querySelector('.motion-toggle');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const cards = [...document.querySelectorAll('[data-reveal]')];
let motionEnabled = !motionPreference.matches;

const revealObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  }
}, { threshold: 0.06 });

for (const card of cards) revealObserver.observe(card);

function updateMotion() {
  const enabled = motionEnabled && !motionPreference.matches;
  root.dataset.motion = enabled ? 'on' : 'off';
  root.classList.toggle('js-motion', enabled);
  motionButton.disabled = motionPreference.matches;
  motionButton.title = motionPreference.matches ? 'Анимация отключена настройкой системы' : '';
  motionButton.setAttribute('aria-pressed', String(enabled));
  motionButton.firstChild.textContent = `Анимация: ${enabled ? 'вкл' : 'выкл'} `;
  document.dispatchEvent(new CustomEvent('site:motionchange', { detail: { enabled } }));
}

motionButton.addEventListener('click', () => {
  motionEnabled = !motionEnabled;
  updateMotion();
});

motionPreference.addEventListener('change', () => {
  motionEnabled = !motionPreference.matches;
  updateMotion();
});

updateMotion();
document.querySelector('#year').textContent = new Date().getFullYear();

const precisePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

for (const card of cards) {
  let bounds;
  let frame;
  let pointerX;
  let pointerY;

  card.addEventListener('pointerenter', () => {
    bounds = card.getBoundingClientRect();
  });

  card.addEventListener('pointermove', (event) => {
    if (!motionEnabled || !precisePointer.matches || !bounds) return;
    pointerX = event.clientX - bounds.left;
    pointerY = event.clientY - bounds.top;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      card.style.setProperty('--pointer-x', `${pointerX}px`);
      card.style.setProperty('--pointer-y', `${pointerY}px`);
      frame = undefined;
    });
  });

  card.addEventListener('pointerleave', () => {
    if (frame) cancelAnimationFrame(frame);
    frame = undefined;
    bounds = undefined;
    card.style.removeProperty('--pointer-x');
    card.style.removeProperty('--pointer-y');
  });
}
