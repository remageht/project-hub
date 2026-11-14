const root = document.documentElement;
const motionButton = document.querySelector('.motion-toggle');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const cards = [...document.querySelectorAll('[data-reveal]')];
let motionEnabled = !motionPreference.matches;
const hero = document.querySelector('.hero');
const heroTitle = document.querySelector('#hero-title');
const emphasis = document.querySelector('.hero-emphasis');
const footer = document.querySelector('.site-footer');
const noteLines = [...document.querySelectorAll('.note-line')];
const heroLetters = [];
let heroSplit = false;
let heroBounds;
let heroFrame;
let heroX;
let heroY;
let replayAt = 0;
let noteIndex = 0;
let scrollFrame = 0;

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
  if (!enabled) hero.style.setProperty('--sheen', '0');
  if (enabled) splitHeroWord();
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

function splitHeroWord() {
  if (heroSplit || !emphasis) return;
  heroSplit = true;
  const word = emphasis.textContent;
  const spoken = document.createElement('span');
  spoken.className = 'visually-hidden';
  spoken.textContent = word;
  emphasis.textContent = '';
  emphasis.classList.add('is-split');
  emphasis.setAttribute('aria-hidden', 'true');

  for (const [index, letter] of [...word].entries()) {
    const node = document.createElement('span');
    node.className = 'hero-letter';
    node.style.setProperty('--i', String(index));
    node.textContent = letter;
    emphasis.append(node);
    heroLetters.push(node);
  }

  emphasis.before(spoken);
}

hero?.addEventListener('pointerenter', () => {
  if (!motionEnabled || !precisePointer.matches) return;
  heroBounds = hero.getBoundingClientRect();
});

hero?.addEventListener('pointermove', (event) => {
  if (!heroBounds || !motionEnabled || !precisePointer.matches) return;
  heroX = (event.clientX - heroBounds.left) / heroBounds.width * 2 - 1;
  heroY = (event.clientY - heroBounds.top) / heroBounds.height * 2 - 1;
  if (heroFrame) return;
  heroFrame = requestAnimationFrame(() => {
    heroFrame = undefined;
    hero.style.setProperty('--px', heroX.toFixed(3));
    hero.style.setProperty('--py', heroY.toFixed(3));
    hero.style.setProperty('--sheen', '1');
  });
});

hero?.addEventListener('pointerleave', () => {
  if (heroFrame) cancelAnimationFrame(heroFrame);
  heroFrame = undefined;
  heroBounds = undefined;
  hero.style.setProperty('--sheen', '0');
  hero.style.removeProperty('--px');
  hero.style.removeProperty('--py');
});

heroTitle?.addEventListener('pointerenter', () => {
  if (!motionEnabled || !precisePointer.matches || !heroSplit) return;
  const now = performance.now();
  if (now - replayAt < 4000) return;
  replayAt = now;
  const animations = heroLetters.flatMap((letter) => letter.getAnimations());
  const start = animations[0]?.effect.getComputedTiming().delay ?? 0;
  for (const animation of animations) {
    animation.currentTime = start;
    animation.play();
  }
});

function updateScrollProgress() {
  const range = root.scrollHeight - innerHeight;
  footer?.style.setProperty('--scroll', range > 0 ? Math.min(1, scrollY / range).toFixed(4) : '1');
}

function rotateNote() {
  if (!motionEnabled || noteLines.length < 2) return;
  noteLines[noteIndex].classList.remove('is-active');
  noteLines[noteIndex].setAttribute('aria-hidden', 'true');
  noteIndex = (noteIndex + 1) % noteLines.length;
  noteLines[noteIndex].classList.add('is-active');
  noteLines[noteIndex].removeAttribute('aria-hidden');
}

window.addEventListener('scroll', () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    updateScrollProgress();
  });
}, { passive: true });
window.addEventListener('resize', updateScrollProgress);
updateScrollProgress();
setInterval(rotateNote, 5200);
