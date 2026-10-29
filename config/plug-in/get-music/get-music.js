/* Static Get mini player. Track metadata is embedded in this document at build time. */
(() => {
  'use strict';
  const dataElement = document.getElementById('get-music-tracks');
  const root = document.getElementById('get-music-player');
  const trigger = document.getElementById('get-music-trigger');
  const inline = root?.dataset.inline === 'true';
  if (!dataElement || !root || (!trigger && !inline)) return;
  const tracks = JSON.parse(dataElement.textContent || '[]');
  if (!Array.isArray(tracks) || !tracks.length) return;

  const $ = selector => root.querySelector(selector);
  const audio = $('audio');
  const disc = $('[data-music-disc]');
  const discIcon = $('[data-music-disc-icon]');
  // Identical SVG paths to the Music site's play/pause button; no Music code is modified.
  const DISC_ICONS = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.2 5.3a1 1 0 0 1 1.53-.84l9.1 6.2a1.6 1.6 0 0 1 0 2.66l-9.1 6.2A1 1 0 0 1 8.2 18.7V5.3Z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.75 5.5A1.25 1.25 0 0 1 8 4.25h1.5a1.25 1.25 0 0 1 1.25 1.25v13A1.25 1.25 0 0 1 9.5 19.75H8a1.25 1.25 0 0 1-1.25-1.25v-13Zm6.5 0a1.25 1.25 0 0 1 1.25-1.25H16a1.25 1.25 0 0 1 1.25 1.25v13A1.25 1.25 0 0 1 16 19.75h-1.5a1.25 1.25 0 0 1-1.25-1.25v-13Z"/></svg>'
  };
  let lastDiscState = null;
  const title = $('[data-music-title]');
  const playerImage = $('[data-music-player]');
  const musicLink = $('[data-music-link]');
  const repeatButton = $('[data-music-repeat]');
  const prevButton = $('[data-music-prev]');
  const nextButton = $('[data-music-next]');
  const lyrics = $('[data-music-lyrics]');
  const lyricsTitle = $('[data-music-lyrics-title]');
  const playbackStatus = $('[data-music-status]');
  const lyricsPanel = $('[data-music-lyrics-panel]');
  const mainPanel = $('[data-music-main-panel]');
  let index = 0;
  let repeatOne = false;
  let hasStarted = false;
  // One-song navigation is intentionally still clickable: it restarts that song.
  const singleTrack = tracks.length === 1;
  prevButton.classList.toggle('is-single-track', singleTrack);
  nextButton.classList.toggle('is-single-track', singleTrack);

  function showLyrics(show) {
    // Resize only the existing dialog; keep the audio/player instance alive.
    root.classList.toggle('is-lyrics-open', Boolean(show));
    mainPanel.hidden = Boolean(show);
    lyricsPanel.hidden = !show;
    if (show) {
      lyrics.textContent = tracks[index].lyrics || 'No lyrics available.';
      lyricsTitle.textContent = tracks[index].title;
    }
  }
  function displayPlayback() {
    const playing = !audio.paused && !audio.ended;
    disc.classList.toggle('is-playing', playing);
    // Only replace the icon on real playback state changes; leave the disc/player intact.
    if (lastDiscState !== playing) {
      discIcon.innerHTML = playing ? DISC_ICONS.pause : DISC_ICONS.play;
      lastDiscState = playing;
    }
    disc.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
    disc.setAttribute('aria-pressed', String(playing));
    playbackStatus.textContent = playing ? 'Pause' : 'Play';
  }
  function setTrack(next, autoplay = false) {
    const wasPlaying = !audio.paused && !audio.ended;
    index = (next + tracks.length) % tracks.length;
    const song = tracks[index];
    title.textContent = song.title;
    musicLink.href = song.music_page;
    playerImage.hidden = !song.player_image;
    if (song.player_image) playerImage.src = song.player_image;
    audio.src = song.audio;
    audio.load();
    if (!lyricsPanel.hidden) showLyrics(true);
    displayPlayback();
    if (autoplay && (hasStarted || wasPlaying)) play();
  }
  async function play() {
    try {
      await audio.play();
      hasStarted = true;
    } catch (error) {
      playbackStatus.textContent = 'Playback unavailable';
      console.warn('YURI1 Get music playback:', error);
    }
    displayPlayback();
  }
  function switchPlayback() {
    if (audio.paused) play();
    else audio.pause();
  }
  function showWindow(show) {
    if (inline) { if (!show) showLyrics(false); return; }
    root.hidden = !show;
    trigger.setAttribute('aria-expanded', String(show));
    if (show) {
      showLyrics(false);
      $('[data-music-close]').focus();
    } else trigger.focus();
    // Closing the dialog intentionally does not pause/destroy audio.
  }
  trigger?.addEventListener('click', () => showWindow(root.hidden));
  $('[data-music-close]').addEventListener('click', () => showWindow(false));
  $('[data-music-disc]').addEventListener('click', switchPlayback);
  $('[data-music-prev]').addEventListener('click', () => setTrack(index - 1, !audio.paused));
  $('[data-music-next]').addEventListener('click', () => setTrack(index + 1, !audio.paused));
  $('[data-music-lyrics-button]').addEventListener('click', () => showLyrics(true));
  $('[data-music-lyrics-back]').addEventListener('click', () => showLyrics(false));
  repeatButton.addEventListener('click', () => {
    repeatOne = !repeatOne;
    repeatButton.setAttribute('aria-pressed', String(repeatOne));
    repeatButton.classList.toggle('is-active', repeatOne);
  });
  audio.addEventListener('play', displayPlayback);
  audio.addEventListener('pause', displayPlayback);
  audio.addEventListener('ended', () => {
    if (repeatOne) { audio.currentTime = 0; play(); }
    else if (index < tracks.length - 1) setTrack(index + 1, true);
    else displayPlayback();
  });
  playerImage.addEventListener('error', () => { playerImage.hidden = true; });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !root.hidden) {
      if (!lyricsPanel.hidden) showLyrics(false);
      else showWindow(false);
    }
  });
  setTrack(0, false);
  showLyrics(false);
  displayPlayback();
})();
