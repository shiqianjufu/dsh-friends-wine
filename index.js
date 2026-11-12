import { spawn } from 'node:child_process';
import { createReadStream, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AUDIO_ROUTE = '/dsh-friends-wine/audio.mp3';
const BOUNCE_ROUTE = '/dsh-friends-wine/window-bounce';
const BOUNCE_SCRIPT = fileURLToPath(new URL('./assets/window-bounce.ps1', import.meta.url));

export const inject = ['webServer', 'connection'];

/** The live native-window bounce helper, if one is running. */
let bounce = null;
/** Stop the helper if the visible page stops sending heartbeats. */
let bounceLease = null;
/** True when the window is maximized or otherwise not movable this turn. */
let bounceBlocked = false;

function releaseBounceLease() {
  if (bounceLease === null) return;
  clearTimeout(bounceLease);
  bounceLease = null;
}

function armBounceLease() {
  if (bounceLease !== null) clearTimeout(bounceLease);
  bounceLease = setTimeout(() => {
    bounceLease = null;
    stopWindowBounce();
  }, 4000);
}

function startWindowBounce() {
  if (process.platform !== 'win32' || bounce !== null || bounceBlocked) return;

  const stopFile = join(tmpdir(), `dsh-friends-wine-bounce-${process.pid}-${Date.now()}.stop`);
  try {
    unlinkSync(stopFile);
  } catch {
    /* The unique name should not exist yet. */
  }

  let child;
  try {
    child = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      BOUNCE_SCRIPT,
      '-ProcessId',
      String(process.ppid),
      '-StopFile',
      stopFile,
      '-Jump',
      '26',
      '-Period',
      '1000',
    ], { windowsHide: true, stdio: 'ignore' });
  } catch {
    return;
  }

  const record = { child, stopFile, killTimer: null };
  bounce = record;

  const release = () => {
    if (record.killTimer !== null) {
      clearTimeout(record.killTimer);
      record.killTimer = null;
    }
    if (bounce === record) bounce = null;
    try {
      unlinkSync(stopFile);
    } catch {
      /* Already removed. */
    }
  };

  child.on('error', release);
  child.on('exit', (code) => {
    release();
    // Exit code 2 means maximized/minimized/no window: do not respawn on every
    // heartbeat for the rest of this turn.
    if (code === 2) bounceBlocked = true;
  });
}

function stopWindowBounce() {
  const record = bounce;
  if (record === null) return;
  try {
    writeFileSync(record.stopFile, '');
  } catch {
    /* The helper may not have created anything yet; the timeout below covers it. */
  }
  if (record.killTimer === null) {
    record.killTimer = setTimeout(() => {
      record.killTimer = null;
      try {
        record.child.kill();
      } catch {
        /* Already gone. */
      }
    }, 2500);
  }
}

/**
 * Serve the bundled song from the same origin as the page so the Client half
 * can play it without bundling megabytes of base64 into the module.
 */
export function apply(ctx) {
  const audioFile = fileURLToPath(new URL('./assets/friends-wine.mp3', import.meta.url));
  const audioSize = statSync(audioFile).size;

  ctx.effect(() => () => {
    releaseBounceLease();
    stopWindowBounce();
  }, 'friends-wine: native window bounce');

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: BOUNCE_ROUTE,
    handler(req, res) {
      const rejection = ctx.connection.requestRejection({ headers: req.headers });
      if (rejection !== undefined) {
        res.writeHead(rejection, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        });
        res.end(JSON.stringify({
          ok: false,
          error: {
            code: rejection === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
            message: '需要有效的 DSH connection 认证',
          },
        }));
        return;
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { Allow: 'POST' });
        res.end();
        return;
      }
      const url = new URL(req.url ?? BOUNCE_ROUTE, 'http://127.0.0.1');
      if (url.searchParams.get('active') === '1') {
        startWindowBounce();
        armBounceLease();
      } else {
        bounceBlocked = false;
        releaseBounceLease();
        stopWindowBounce();
      }
      res.writeHead(204, { 'Cache-Control': 'no-store' });
      res.end();
    },
  }), 'friends-wine: window bounce route');

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: AUDIO_ROUTE,
    handler(req, res) {
      if (req.method === 'HEAD') {
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioSize,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400',
        });
        res.end();
        return;
      }

      const range = req.headers.range;
      if (typeof range === 'string') {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
        if (match !== null) {
          let start = match[1] === '' ? 0 : Number(match[1]);
          let end = match[2] === '' ? audioSize - 1 : Number(match[2]);
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
            start = 0;
            end = audioSize - 1;
          }
          if (start < 0) start = 0;
          if (end >= audioSize) end = audioSize - 1;
          if (start > end) {
            res.writeHead(416, { 'Content-Range': `bytes */${audioSize}` });
            res.end();
            return;
          }
          res.writeHead(206, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': end - start + 1,
            'Content-Range': `bytes ${start}-${end}/${audioSize}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=86400',
          });
          createReadStream(audioFile, { start, end }).pipe(res);
          return;
        }
      }

      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioSize,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
      });
      createReadStream(audioFile).pipe(res);
    },
  }), 'friends-wine: audio route');
}
