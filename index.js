import { spawn } from 'node:child_process';
import { createReadStream, existsSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AUDIO_ROUTE = '/dsh-friends-wine/audio.mp3';
const BOUNCE_ROUTE = '/dsh-friends-wine/window-bounce';
const BOUNCE_SCRIPT = fileURLToPath(new URL('./assets/window-bounce.ps1', import.meta.url));
const USER_AUDIO_DIR = join(homedir(), '.dsh', 'friends-wine');
const DEFAULT_AUDIO_FILE = join(USER_AUDIO_DIR, 'friends-wine.mp3');

export const inject = ['webServer', 'connection'];

/** The song is supplied by the user, never shipped in the package. */
function configuredAudioFile() {
  const fromEnv = String(process.env.DSH_FRIENDS_WINE_AUDIO ?? '').trim();
  return fromEnv !== '' ? fromEnv : DEFAULT_AUDIO_FILE;
}

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
 * Serve the user's own song from their local DSH data directory. The package
 * never contains the copyrighted recording; a missing file yields 404 and the
 * client simply keeps the visual effects without audio.
 */
export function apply(ctx) {

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

      const audioFile = configuredAudioFile();
      let audioSize;
      try {
        audioSize = statSync(audioFile).size;
      } catch {
        audioSize = 0;
      }
      if (!existsSync(audioFile) || audioSize <= 0) {
        res.writeHead(404, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        });
        res.end(JSON.stringify({
          ok: false,
          error: {
            code: 'AUDIO_NOT_CONFIGURED',
            message: '未找到本地歌曲，请把 friends-wine.mp3 放到 ~/.dsh/friends-wine/friends-wine.mp3，或设置 DSH_FRIENDS_WINE_AUDIO 指向你的音频文件。',
          },
        }));
        return;
      }

      if (req.method === 'HEAD') {
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioSize,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store',
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
            'Cache-Control': 'no-store',
          });
          createReadStream(audioFile, { start, end }).pipe(res);
          return;
        }
      }

      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioSize,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
      });
      createReadStream(audioFile).pipe(res);
    },
  }), 'friends-wine: audio route');
}
