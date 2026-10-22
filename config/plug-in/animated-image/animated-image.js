/* Optional, user-initiated silent animation. No Music player interaction. */
(() => {
  'use strict';
  const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/></svg>';
  const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M10 9v6M14 9v6"/></svg>';
  const waitingIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 1 7.38 16.75"/><path d="M12 6v6l4 2"/><path d="M2.5 8.875a10 10 0 0 0-.5 3"/><path d="M2.83 16a10 10 0 0 0 2.43 3.4"/><path d="M4.636 5.235a10 10 0 0 1 .891-.857"/><path d="M8.644 21.42a10 10 0 0 0 7.631-.38"/></svg>';
  const cards = [...document.querySelectorAll('.post-image.post.y1-animated-image[data-animation-src]')];
  let active = null;
  function stop(card) {
    const video = card.querySelector('.y1-animated-video');
    if (video) { video.pause(); video.removeAttribute('src'); video.remove(); }
    card.querySelector('img')?.classList.remove('y1-animation-hidden');
    card.classList.remove('is-loading', 'is-playing');
    const button = card.querySelector('.y1-animation-toggle');
    if (button) { button.innerHTML = playIcon; button.setAttribute('aria-label', '播放動態圖片'); button.setAttribute('aria-pressed', 'false'); }
    if (active === card) active = null;
  }
  function start(card) {
    if (active) stop(active);
    const image = card.querySelector('img'), button = card.querySelector('.y1-animation-toggle');
    if (!image || !button) return;
    const video = document.createElement('video');
    video.className = 'y1-animated-video';
    video.muted = true; video.defaultMuted = true; video.loop = true;
    video.playsInline = true; video.preload = 'none'; video.controls = false;
    video.disablePictureInPicture = true;
    video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
    video.setAttribute('disableRemotePlayback', ''); video.setAttribute('aria-hidden', 'true');
    const isCurrent = () => active === card && card.querySelector('.y1-animated-video') === video;
    video.addEventListener('waiting', () => {
      if (!isCurrent()) return;
      button.innerHTML = waitingIcon;
      button.setAttribute('aria-label', '正在緩衝動態圖片');
    });
    video.addEventListener('playing', () => {
      if (!isCurrent()) return;
      card.classList.remove('is-loading'); card.classList.add('is-playing');
      image.classList.add('y1-animation-hidden');
      button.innerHTML = pauseIcon;
      button.setAttribute('aria-label', '停止動態圖片並恢復靜態圖片');
      button.setAttribute('aria-pressed', 'true');
    });
    video.addEventListener('ended', () => { if (isCurrent()) stop(card); });
    video.addEventListener('error', () => { if (isCurrent()) stop(card); });
    card.insertBefore(video, button);
    active = card; card.classList.add('is-loading');
    button.innerHTML = waitingIcon;
    button.setAttribute('aria-label', '正在載入動態圖片');
    button.setAttribute('aria-pressed', 'true');
    // Assign the MP4 URL only in direct response to a click.
    video.src = card.dataset.animationSrc;
    const attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => { if (isCurrent()) stop(card); });
  }
  cards.forEach(card => {
    const button = card.querySelector('.y1-animation-toggle');
    if (!button) return;
    button.innerHTML = playIcon;
    card.addEventListener('click', event => {
      // Reader backup-cover button retains its independent click behavior.
      if (event.target.closest('button:not(.y1-animation-toggle), a, input, select')) return;
      if (active === card) stop(card); else start(card);
    });
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && active) stop(active); });
  if (typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (!entry.isIntersecting && active === entry.target) stop(active);
    });
    cards.forEach(card => observer.observe(card));
  }
})();
