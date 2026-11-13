window.__ModuleLoader__.load({
  id: 'dsh-friends-wine',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const AUDIO_URL = '/dsh-friends-wine/audio.mp3';
    const BOUNCE_URL = '/dsh-friends-wine/window-bounce';
    const ROOT_ATTR = 'data-dsh-friends-wine';
    const activeTokens = new Set();

    let audio = null;
    let bounceHeartbeat = null;
    let bounceRequested = false;

    function ensureAudio() {
      if (audio !== null) return audio;
      audio = new Audio(AUDIO_URL);
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = 0.55;
      return audio;
    }

    function setRunning(running) {
      const root = document.documentElement;
      if (running) root.setAttribute(ROOT_ATTR, 'active');
      else root.removeAttribute(ROOT_ATTR);
    }

    function play() {
      const element = ensureAudio();
      if (element.paused) {
        try {
          element.currentTime = 0;
        } catch {
          /* The media metadata may not be ready yet; play() starts at zero anyway. */
        }
        const started = element.play();
        if (started !== undefined && typeof started.catch === 'function') started.catch(() => {});
      }
    }

    function stop() {
      if (audio === null) return;
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        /* Ignore a reset before metadata is available. */
      }
    }

    function syncAudio() {
      if (activeTokens.size > 0) {
        setRunning(true);
        startWindowBounce();
        play();
      } else {
        setRunning(false);
        stopWindowBounce();
        stop();
      }
    }

    function postWindowBounce(active) {
      try {
        const request = fetch(BOUNCE_URL + (active ? '?active=1' : '?active=0'), {
          method: 'POST',
          cache: 'no-store',
          keepalive: true,
        });
        if (request !== undefined && typeof request.catch === 'function') request.catch(() => {});
      } catch {
        /* The Host route is best-effort; animation still runs without it. */
      }
    }

    function startWindowBounce() {
      if (bounceRequested) return;
      bounceRequested = true;
      postWindowBounce(true);
      // The Host stops the helper if this page disappears mid-turn.
      bounceHeartbeat = setInterval(() => postWindowBounce(true), 2000);
    }

    function stopWindowBounce() {
      if (!bounceRequested) return;
      bounceRequested = false;
      if (bounceHeartbeat !== null) {
        clearInterval(bounceHeartbeat);
        bounceHeartbeat = null;
      }
      postWindowBounce(false);
    }

    const RUNNING_TEXT = '时间来不及了';

    function rewriteRunningLabel(container) {
      const label = container.querySelector('[class*="runningText"]');
      if (label === null) return;
      const current = label.textContent ?? '';
      if (current.includes(RUNNING_TEXT)) return;
      if (!current.includes('深度求索中')) return;

      const withoutLead = current.replace(/^\s*深度求索中[，,\s]*/u, '');
      const timePart = withoutLead.replace(/[\s·…]+$/u, '').trim();
      label.textContent = timePart === ''
        ? RUNNING_TEXT
        : timePart + '，' + RUNNING_TEXT + ' ···';

      const status = container.querySelector('[role="status"]');
      if (status !== null && status !== label) status.textContent = RUNNING_TEXT;
    }

    function watchRunningLabel() {
      let runningEl = null;
      let runningObserver = null;

      const scan = () => {
        const found = document.querySelector('[data-chat-running]');
        if (found === runningEl) {
          if (found !== null) rewriteRunningLabel(found);
          return;
        }
        if (runningObserver !== null) {
          runningObserver.disconnect();
          runningObserver = null;
        }
        runningEl = found;
        if (found === null) return;
        rewriteRunningLabel(found);
        runningObserver = new MutationObserver(() => rewriteRunningLabel(found));
        runningObserver.observe(found, { childList: true, subtree: true, characterData: true });
      };

      const root = document.body ?? document.documentElement;
      if (root === null) return () => {};
      const bodyObserver = new MutationObserver(scan);
      bodyObserver.observe(root, { childList: true, subtree: true });
      scan();

      return () => {
        bodyObserver.disconnect();
        if (runningObserver !== null) runningObserver.disconnect();
      };
    }

    function Whale() {
      return h('div', { className: 'dsh-fw-mascot', 'aria-hidden': 'true' },
        h('span', { className: 'dsh-fw-note dsh-fw-note-a' }, '\u266a'),
        h('span', { className: 'dsh-fw-note dsh-fw-note-b' }, '\u266b'),
        h('svg', {
          className: 'dsh-fw-whale',
          width: 68,
          height: 54,
          viewBox: '0 0 72 56',
          fill: 'none',
          xmlns: 'http://www.w3.org/2000/svg',
        },
          h('path', {
            fill: 'currentColor',
            d: 'M7 31.5C7 21.8 16 14 28.6 14c11.5 0 19.2 5.7 22.6 13.7 2.8-1.4 5.5-4 7.7-6.8 1.1-1.4 3.2-.5 3.2 1.6l-1.1 9 1.1 9c.1 2.1-2.1 3-3.2 1.6-2.2-2.8-4.9-5.4-7.7-6.8C48.8 43.3 41.1 49 29.6 49 17 49 7 41.2 7 31.5Z',
          }),
          h('ellipse', {
            cx: '27',
            cy: '38',
            rx: '14.5',
            ry: '6.2',
            fill: '#ffffff',
            fillOpacity: '.35',
          }),
          h('circle', { cx: '19.5', cy: '28.5', r: '3.3', fill: '#ffffff' }),
          h('circle', { cx: '18.7', cy: '28.8', r: '1.55', fill: '#17233d' }),
          h('path', {
            d: 'M22.5 35.4c2.4 1.8 5 2.1 7.4.9',
            stroke: '#ffffff',
            strokeOpacity: '.7',
            strokeWidth: '1.8',
            strokeLinecap: 'round',
          }),
          h('path', {
            d: 'M29.5 13.5c.4-3.4-1.1-6.1-4.3-8.1M29.5 13.5c-2.7-1.9-5.7-2.2-8.8-1',
            stroke: '#8ab4ff',
            strokeWidth: '2.3',
            strokeLinecap: 'round',
          }),
          h('circle', { cx: '24.4', cy: '4.2', r: '1.9', fill: '#8ab4ff' }),
          h('circle', { cx: '19.6', cy: '10.1', r: '1.35', fill: '#8ab4ff' }),
        ),
      );
    }

    function FriendsWine({ sessionId, useSessionStatus }) {
      const running = useSessionStatus((snapshot) => {
        if (sessionId === undefined) return false;
        return snapshot.get(sessionId)?.running === true;
      });

      React.useEffect(() => {
        if (!running) return undefined;
        const token = Symbol('friends-wine');
        activeTokens.add(token);
        syncAudio();
        return () => {
          activeTokens.delete(token);
          syncAudio();
        };
      }, [running]);

      return running ? h(Whale) : null;
    }

    const CSS = `
html[${ROOT_ATTR}="active"] [data-composer-card] {
  transform-origin: 50% 100% !important;
  animation: dsh-fw-card-stretch 1s cubic-bezier(.45, .05, .55, .95) infinite !important;
  will-change: transform;
  z-index: 6;
}

html[${ROOT_ATTR}="active"] [data-composer-card] button {
  transform-origin: 50% 100%;
  animation: dsh-fw-button-stretch 1s cubic-bezier(.45, .05, .55, .95) infinite;
  will-change: transform;
}

html[${ROOT_ATTR}="active"] [class*="fishHitbox"] {
  transform-origin: 50% 100%;
  animation: dsh-fw-mascot-stretch 1s cubic-bezier(.45, .05, .55, .95) infinite;
  will-change: transform;
}

/* The sidebar's little whale is the brand mark, not the hero fish. Let it
   stretch upward without being clipped by the brand row's overflow:hidden. */
html[${ROOT_ATTR}="active"] [class*="brand"] {
  overflow: visible !important;
}

/* Every sidebar glyph joins in: rail buttons, workspace icons, plugin entry,
   footer actions and the brand whale. */
html[${ROOT_ATTR}="active"] [class*="sidebarCol"] svg,
html[${ROOT_ATTR}="active"] [class*="sidebarCol"] img,
html[${ROOT_ATTR}="active"] [class*="wtg9ga_root"] svg,
html[${ROOT_ATTR}="active"] [class*="wtg9ga_root"] img {
  transform-origin: 50% 100%;
  animation: dsh-fw-mascot-stretch 1s cubic-bezier(.45, .05, .55, .95) infinite;
  will-change: transform;
}

/* Row artwork on the Plugins page. */
html[${ROOT_ATTR}="active"] [data-plugin-rows] svg,
html[${ROOT_ATTR}="active"] [data-plugin-rows] img,
html[${ROOT_ATTR}="active"] [data-plugin-rows] [class*="rowIcon"],
html[${ROOT_ATTR}="active"] [data-plugin-panel] svg,
html[${ROOT_ATTR}="active"] [data-plugin-panel] img,
html[${ROOT_ATTR}="active"] [data-plugin-item] svg,
html[${ROOT_ATTR}="active"] [data-plugin-item] img,
html[${ROOT_ATTR}="active"] [data-plugin-package] svg,
html[${ROOT_ATTR}="active"] [data-plugin-package] img {
  transform-origin: 50% 100%;
  animation: dsh-fw-mascot-stretch 1s cubic-bezier(.45, .05, .55, .95) infinite;
  will-change: transform;
}

/* Shortcut keycaps and shortcut-panel glyphs. */
html[${ROOT_ATTR}="active"] kbd,
html[${ROOT_ATTR}="active"] [class*="shortcut"] svg,
html[${ROOT_ATTR}="active"] [class*="shortcut"] img {
  display: inline-block;
  transform-origin: 50% 100%;
  animation: dsh-fw-mascot-stretch 1s cubic-bezier(.45, .05, .55, .95) infinite;
  will-change: transform;
}

/* The separately installed balance widget draws its whale as .dshwv-img;
   animate that image in place so its own mirror/drag transforms survive. */
html[${ROOT_ATTR}="active"] .dshwv-img {
  transform-origin: 50% 100%;
  animation: dsh-fw-mascot-stretch 1s cubic-bezier(.45, .05, .55, .95) infinite;
  will-change: transform;
}

.dsh-fw-mascot {
  position: fixed;
  right: max(22px, env(safe-area-inset-right));
  bottom: calc(126px + env(safe-area-inset-bottom));
  width: 76px;
  height: 62px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  pointer-events: none;
  z-index: 60;
  color: var(--dsw-alias-label-primary-bluish, #4d6bfe);
  transform-origin: 50% 100%;
  animation: dsh-fw-mascot-stretch 1s cubic-bezier(.45, .05, .55, .95) infinite;
  filter: drop-shadow(0 6px 10px rgba(30, 58, 138, .18));
  will-change: transform;
}

.dsh-fw-whale {
  display: block;
  overflow: visible;
}

.dsh-fw-note {
  position: absolute;
  top: 1px;
  color: var(--dsw-alias-label-primary-bluish, #4d6bfe);
  font-family: var(--ds-font-family-code, ui-monospace, monospace);
  font-weight: 700;
  line-height: 1;
  opacity: .85;
  animation: dsh-fw-note-float 1.6s ease-in-out infinite;
}

.dsh-fw-note-a {
  right: 13px;
  font-size: 15px;
}

.dsh-fw-note-b {
  right: 2px;
  top: 12px;
  font-size: 11px;
  animation-delay: .45s;
}

@keyframes dsh-fw-card-stretch {
  0%, 14% { transform: scaleY(1) scaleX(1); }
  38% { transform: scaleY(1.88) scaleX(.91); }
  50% { transform: scaleY(2) scaleX(.89); }
  62% { transform: scaleY(1.86) scaleX(.92); }
  82%, 100% { transform: scaleY(1) scaleX(1.01); }
}

@keyframes dsh-fw-button-stretch {
  0%, 14% { transform: scaleY(1); }
  50% { transform: scaleY(1.06); }
  62% { transform: scaleY(1.03); }
  82%, 100% { transform: scaleY(1); }
}

@keyframes dsh-fw-mascot-stretch {
  0%, 12% { transform: scaleY(1) scaleX(1); }
  40% { transform: scaleY(1.92) scaleX(.87); }
  52% { transform: scaleY(2) scaleX(.85); }
  64% { transform: scaleY(1.9) scaleX(.88); }
  84%, 100% { transform: scaleY(1) scaleX(1.02); }
}

@keyframes dsh-fw-note-float {
  0%, 100% { transform: translateY(0) rotate(-6deg); opacity: .5; }
  50% { transform: translateY(-8px) rotate(5deg); opacity: .95; }
}

@media (prefers-reduced-motion: reduce) {
  html[${ROOT_ATTR}="active"] [data-composer-card],
  html[${ROOT_ATTR}="active"] [data-composer-card] button,
  html[${ROOT_ATTR}="active"] [class*="fishHitbox"],
  html[${ROOT_ATTR}="active"] .dshwv-img,
  html[${ROOT_ATTR}="active"] [class*="sidebarCol"] svg,
  html[${ROOT_ATTR}="active"] [class*="sidebarCol"] img,
  html[${ROOT_ATTR}="active"] [class*="wtg9ga_root"] svg,
  html[${ROOT_ATTR}="active"] [class*="wtg9ga_root"] img,
  html[${ROOT_ATTR}="active"] [data-plugin-rows] svg,
  html[${ROOT_ATTR}="active"] [data-plugin-rows] img,
  html[${ROOT_ATTR}="active"] [data-plugin-rows] [class*="rowIcon"],
  html[${ROOT_ATTR}="active"] [data-plugin-panel] svg,
  html[${ROOT_ATTR}="active"] [data-plugin-panel] img,
  html[${ROOT_ATTR}="active"] [data-plugin-item] svg,
  html[${ROOT_ATTR}="active"] [data-plugin-item] img,
  html[${ROOT_ATTR}="active"] [data-plugin-package] svg,
  html[${ROOT_ATTR}="active"] [data-plugin-package] img,
  html[${ROOT_ATTR}="active"] kbd,
  html[${ROOT_ATTR}="active"] [class*="shortcut"] svg,
  html[${ROOT_ATTR}="active"] [class*="shortcut"] img,
  .dsh-fw-mascot,
  .dsh-fw-note {
    animation: none !important;
  }
}
`;

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.effect(() => {
          const style = document.createElement('style');
          style.id = 'dsh-friends-wine-style';
          style.textContent = CSS;
          document.head.appendChild(style);
          return () => style.remove();
        }, 'friends-wine: styles');

        ctx.effect(watchRunningLabel, 'friends-wine: running label');

        ctx.effect(() => {
          const resume = () => {
            if (activeTokens.size === 0) return;
            const element = ensureAudio();
            if (!element.paused) return;
            const started = element.play();
            if (started !== undefined && typeof started.catch === 'function') started.catch(() => {});
          };
          window.addEventListener('pointerdown', resume, true);
          window.addEventListener('keydown', resume, true);
          return () => {
            window.removeEventListener('pointerdown', resume, true);
            window.removeEventListener('keydown', resume, true);
            activeTokens.clear();
            setRunning(false);
            stopWindowBounce();
            stop();
          };
        }, 'friends-wine: audio lifecycle');

        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'friends-wine',
          order: 90,
        }, FriendsWine));
      },
    };
  },
});
