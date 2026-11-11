(() => {
  'use strict';

  const button = document.getElementById('effects-btn');
  const background = document.getElementById('particles-js');
  const foreground = document.getElementById('interaction-canvas');
  const spotlight = document.getElementById('cursor-glow');
  const progress = document.getElementById('scroll-progress');
  const toast = document.getElementById('effects-toast');
  const name = document.querySelector('.profile-name');
  if (!button || !background || !foreground) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const palette = ['#477be8', '#9169d8', '#22a9b1', '#dc77ae', '#e5a64c'];
  const timers = new Set();
  const animations = new Set();
  const pointer = { x: 0, y: 0, active: false };
  const originalName = name?.textContent.trim() || '';
  let preference = true;
  let enabled = false;
  let running = false;
  let frame = 0;
  let lastFrame = 0;
  let lastTrail = 0;
  let width = 0;
  let height = 0;
  let nodes = [];
  let sparks = [];
  let activeCard = null;
  let typedName = false;
  let scrollFrame = 0;
  let backgroundContext;
  let foregroundContext;

  try {
    preference = localStorage.getItem('effects') !== 'off';
  } catch {
    // Decorative effects do not depend on storage access.
  }
  try {
    backgroundContext = background.getContext('2d');
    foregroundContext = foreground.getContext('2d');
  } catch {
    // CSS effects and the readable page remain available without Canvas.
  }

  const chinese = () => document.documentElement.lang.startsWith('zh');
  const random = (min, max) => min + Math.random() * (max - min);
  const color = () => palette[Math.floor(Math.random() * palette.length)];

  function later(callback, delay) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (running) callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  function animate(element, keyframes, options) {
    if (!element?.animate || !running) return null;
    try {
      const animation = element.animate(keyframes, options);
      animations.add(animation);
      animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
      return animation;
    } catch {
      return null;
    }
  }

  function updateButton() {
    const label = reducedMotion.matches
      ? (chinese() ? '系统已启用减少动态效果' : 'Reduced motion is enabled in system settings')
      : enabled
        ? (chinese() ? '关闭动态效果' : 'Turn off visual effects')
        : (chinese() ? '开启动态效果' : 'Turn on visual effects');
    button.hidden = false;
    button.disabled = reducedMotion.matches;
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  function makeNode(x = random(0, width), y = random(0, height)) {
    return {
      x, y,
      vx: random(-0.018, 0.018),
      vy: random(-0.018, 0.018),
      radius: random(1.1, 2.4),
      hue: Math.random() > 0.65 ? '132, 104, 201' : '74, 129, 208'
    };
  }

  function resize() {
    width = document.documentElement.clientWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    for (const [canvas, context] of [[background, backgroundContext], [foreground, foregroundContext]]) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    const count = Math.min(width < 700 ? 30 : 64, Math.max(18, Math.floor(width * height / 23000)));
    nodes = Array.from({ length: count }, () => makeNode());
    if (!running) clearCanvases();
    updateProgress();
  }

  function clearCanvases() {
    backgroundContext?.clearRect(0, 0, width, height);
    foregroundContext?.clearRect(0, 0, width, height);
  }

  function drawBackground(delta) {
    const context = backgroundContext;
    if (!context) return;
    context.clearRect(0, 0, width, height);
    for (const node of nodes) {
      node.x += node.vx * delta;
      node.y += node.vy * delta;
      if (node.x < -10) node.x = width + 10;
      if (node.x > width + 10) node.x = -10;
      if (node.y < -10) node.y = height + 10;
      if (node.y > height + 10) node.y = -10;
      context.beginPath();
      context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(${node.hue}, 0.48)`;
      context.fill();
      if (pointer.active && finePointer.matches) {
        const distance = Math.hypot(node.x - pointer.x, node.y - pointer.y);
        if (distance < 175) {
          context.beginPath();
          context.moveTo(node.x, node.y);
          context.lineTo(pointer.x, pointer.y);
          context.strokeStyle = `rgba(91, 123, 208, ${(1 - distance / 175) * 0.28})`;
          context.lineWidth = 0.8;
          context.stroke();
        }
      }
    }
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const distance = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);
        if (distance >= 140) continue;
        context.beginPath();
        context.moveTo(nodes[a].x, nodes[a].y);
        context.lineTo(nodes[b].x, nodes[b].y);
        context.strokeStyle = `rgba(101, 128, 188, ${(1 - distance / 140) * 0.2})`;
        context.lineWidth = 0.7;
        context.stroke();
      }
    }
  }

  function addSpark(spark) {
    sparks.push(spark);
    if (sparks.length > 180) sparks.splice(0, sparks.length - 180);
  }

  function burst(x, y, count = 12, scale = 1) {
    if (!running) return;
    addSpark({ kind: 'ring', x, y, age: 0, life: 600, color: color(), size: 36 * scale });
    for (let index = 0; index < count; index++) {
      const angle = index / count * Math.PI * 2 + random(-0.15, 0.15);
      const distance = random(35, 85) * scale;
      addSpark({
        kind: index % 5 === 0 ? 'star' : 'dot',
        x, y, dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance,
        age: 0, life: random(550, 850), color: color(), size: random(2.5, 4.5)
      });
    }
  }

  function drawSparks(delta) {
    const context = foregroundContext;
    if (!context) return;
    context.clearRect(0, 0, width, height);
    sparks = sparks.filter(spark => spark.age < spark.life);
    for (const spark of sparks) {
      spark.age += delta;
      const phase = Math.min(1, spark.age / spark.life);
      const ease = 1 - Math.pow(1 - phase, 3);
      context.globalAlpha = (1 - phase) * 0.85;
      context.fillStyle = spark.color;
      context.strokeStyle = spark.color;
      if (spark.kind === 'ring') {
        context.beginPath();
        context.arc(spark.x, spark.y, 4 + ease * spark.size, 0, Math.PI * 2);
        context.lineWidth = 1.6 * (1 - phase) + 0.3;
        context.stroke();
        continue;
      }
      const x = spark.x + spark.dx * ease;
      const y = spark.y + spark.dy * ease;
      const size = Math.max(0.1, spark.size * (1 - phase * 0.8));
      context.beginPath();
      if (spark.kind === 'star') {
        context.moveTo(x, y - size * 1.6);
        context.lineTo(x + size * 0.45, y - size * 0.45);
        context.lineTo(x + size * 1.6, y);
        context.lineTo(x + size * 0.45, y + size * 0.45);
        context.lineTo(x, y + size * 1.6);
        context.lineTo(x - size * 0.45, y + size * 0.45);
        context.lineTo(x - size * 1.6, y);
        context.lineTo(x - size * 0.45, y - size * 0.45);
        context.closePath();
      } else {
        context.arc(x, y, size, 0, Math.PI * 2);
      }
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function tick(now) {
    frame = 0;
    if (!running) return;
    if (!lastFrame) lastFrame = now;
    const elapsed = now - lastFrame;
    if (elapsed >= 1000 / 30) {
      const delta = Math.min(elapsed, 65);
      lastFrame = now;
      drawBackground(delta);
      drawSparks(delta);
    }
    frame = requestAnimationFrame(tick);
  }

  function resetCard() {
    if (!activeCard) return;
    activeCard.style.removeProperty('--tilt-x');
    activeCard.style.removeProperty('--tilt-y');
    activeCard = null;
  }

  function finishName() {
    if (!name || !name.hasAttribute('data-typing')) return;
    name.textContent = originalName;
    name.removeAttribute('data-typing');
  }

  function typeName() {
    if (typedName || !name?.animate || !running) return;
    typedName = true;
    name.setAttribute('aria-label', originalName);
    name.setAttribute('data-typing', 'true');
    const fragment = document.createDocumentFragment();
    for (const [index, letter] of [...originalName].entries()) {
      const span = document.createElement('span');
      span.textContent = letter;
      span.setAttribute('aria-hidden', 'true');
      span.style.whiteSpace = 'pre';
      fragment.appendChild(span);
      animate(span, [{ opacity: 0 }, { opacity: 1 }], {
        duration: 90, delay: index * 75, easing: 'steps(1, end)', fill: 'backwards'
      });
    }
    name.replaceChildren(fragment);
    later(finishName, originalName.length * 75 + 220);
  }

  function syncMotion() {
    enabled = preference && !reducedMotion.matches;
    running = enabled && !document.hidden;
    document.body.classList.toggle('effects-on', running);
    document.body.classList.toggle('effects-paused', !running);
    updateButton();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
    if (running) {
      if (backgroundContext || foregroundContext) frame = requestAnimationFrame(tick);
      typeName();
      return;
    }
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    for (const animation of animations) animation.cancel();
    animations.clear();
    sparks = [];
    pointer.active = false;
    resetCard();
    finishName();
    if (toast) toast.hidden = true;
    clearCanvases();
  }

  function updateProgress() {
    scrollFrame = 0;
    if (!progress) return;
    const total = document.documentElement.scrollHeight - window.innerHeight;
    const value = total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0;
    progress.style.transform = `scaleX(${value})`;
  }

  button.addEventListener('click', () => {
    preference = !preference;
    try { localStorage.setItem('effects', preference ? 'on' : 'off'); } catch { /* Optional preference. */ }
    syncMotion();
  });

  document.addEventListener('languagechange', () => {
    updateButton();
    if (toast && !toast.hidden) toast.textContent = chinese() ? '✦ 你发现了隐藏彩蛋！' : '✦ You found the easter egg!';
    updateProgress();
  });

  document.addEventListener('pointermove', event => {
    if (!running || !finePointer.matches || event.pointerType === 'touch') return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    if (spotlight) {
      spotlight.style.left = `${pointer.x}px`;
      spotlight.style.top = `${pointer.y}px`;
    }
    const now = performance.now();
    if (now - lastTrail > 42) {
      lastTrail = now;
      addSpark({ kind: 'dot', x: pointer.x, y: pointer.y, dx: random(-8, 8), dy: random(-12, 4), age: 0, life: 520, color: color(), size: 3.4 });
    }
    const card = event.target.closest?.('.pub-entry, .entry-block');
    if (card !== activeCard) resetCard();
    if (!card) return;
    activeCard = card;
    const rect = card.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
    card.style.setProperty('--tilt-x', `${(-y * 2).toFixed(2)}deg`);
    card.style.setProperty('--tilt-y', `${(x * 2).toFixed(2)}deg`);
  }, { passive: true });

  document.addEventListener('pointerout', event => {
    if (!event.relatedTarget) {
      pointer.active = false;
      resetCard();
    }
  }, { passive: true });

  document.addEventListener('click', event => {
    if (!running || event.detail === 0 || event.target.closest?.('#effects-btn')) return;
    if (window.getSelection()?.toString()) return;
    burst(event.clientX, event.clientY, width < 700 ? 9 : 12);
    for (let index = 0; index < 3; index++) nodes.push(makeNode(event.clientX + random(-20, 20), event.clientY + random(-20, 20)));
    const cap = width < 700 ? 38 : 76;
    if (nodes.length > cap) nodes.splice(0, nodes.length - cap);
  }, { passive: true });

  const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let position = 0;
  document.addEventListener('keydown', event => {
    if (!running || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    position = key === code[position] ? position + 1 : key === code[0] ? 1 : 0;
    if (position !== code.length) return;
    position = 0;
    if (toast) {
      toast.textContent = chinese() ? '✦ 你发现了隐藏彩蛋！' : '✦ You found the easter egg!';
      toast.hidden = false;
      animate(toast, [{ opacity: 0, translate: '0 12px' }, { opacity: 1, translate: '0 0' }], { duration: 260, easing: 'ease-out' });
      later(() => { toast.hidden = true; }, 2800);
    }
    for (let index = 0; index < 7; index++) {
      later(() => burst(random(width * 0.1, width * 0.9), random(height * 0.15, height * 0.75), 18, 1.5), index * 180);
    }
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting || !running) continue;
        animate(entry.target, [{ opacity: 0.4, translate: '0 16px' }, { opacity: 1, translate: '0 0' }], { duration: 520, easing: 'cubic-bezier(.2,.65,.3,1)' });
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.04 });
    document.querySelectorAll('.section-title, .entry-block, .pub-entry, .interest-tags').forEach(element => observer.observe(element));
  }

  window.addEventListener('scroll', () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress);
  }, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('load', updateProgress);
  document.addEventListener('visibilitychange', syncMotion);
  reducedMotion.addEventListener('change', syncMotion);
  finePointer.addEventListener('change', () => { pointer.active = false; resetCard(); });
  resize();
  syncMotion();
})();
