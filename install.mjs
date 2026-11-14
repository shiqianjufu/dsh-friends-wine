// install.mjs — 将 dsh-friends-wine 安装到本机 DSH desktop profile。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DSH_HOME = process.env.DSH_HOME ? path.resolve(process.env.DSH_HOME) : path.join(os.homedir(), '.dsh');
const PROFILE = process.env.DSH_PROFILE_DIR
  ? path.resolve(process.env.DSH_PROFILE_DIR)
  : process.env.DSH_PROFILE && path.isAbsolute(process.env.DSH_PROFILE)
    ? path.resolve(process.env.DSH_PROFILE)
    : path.join(DSH_HOME, 'profiles', process.env.DSH_PROFILE || 'desktop');

const NAME = 'dsh-friends-wine';
const OLD_NAME = '@local/dsh-friends-wine';
const TARGET = path.join(DSH_HOME, 'plugins', 'dsh-friends-wine');

function log(message) {
  console.log(`[friends-wine] ${message}`);
}

function backup(file) {
  if (!fs.existsSync(file)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(file, `${file}.bak-friends-wine-${stamp}`);
}

if (!fs.existsSync(path.join(PROFILE, 'package.json'))) {
  console.error(`找不到 DSH profile：${PROFILE}\n可以用 DSH_PROFILE=C:\\path\\to\\profile 指定。`);
  process.exit(1);
}

if (path.resolve(HERE) === path.resolve(TARGET)) {
  console.error('请不要从安装目录里运行 install.mjs（它会先删掉自己）。请在解压目录运行。');
  process.exit(1);
}

fs.rmSync(TARGET, { recursive: true, force: true });
fs.mkdirSync(TARGET, { recursive: true });
fs.cpSync(HERE, TARGET, {
  recursive: true,
  filter: (src) => {
    const rel = path.relative(HERE, src);
    if (!rel) return true;
    if (rel === 'node_modules' || rel === '.git') return false;
    if (rel.startsWith(`.tmp-`)) return false;
    return true;
  },
});
log(`已复制到 ${TARGET}`);
if (!fs.existsSync(path.join(TARGET, 'package.json'))) {
  console.error('复制后的插件缺少 package.json，安装中止。');
  process.exit(1);
}

const pkgPath = path.join(PROFILE, 'package.json');
// Windows editors and PowerShell often write a UTF-8 BOM; JSON.parse rejects it.
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8').replace(/^\uFEFF/u, ''));
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies[NAME] = `link:${TARGET.replace(/\\/g, '/')}`;
delete pkg.dependencies[OLD_NAME];
pkg.dsh = pkg.dsh || {};
pkg.dsh.profile = pkg.dsh.profile || {};
pkg.dsh.profile.bundles = (pkg.dsh.profile.bundles || []).filter((bundle) => bundle !== OLD_NAME);
if (!pkg.dsh.profile.bundles.includes(NAME)) pkg.dsh.profile.bundles.push(NAME);
backup(pkgPath);
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
log('已登记依赖与 bundles');

const modules = path.join(PROFILE, 'node_modules');
fs.mkdirSync(modules, { recursive: true });
const oldScope = path.join(modules, '@local');
const oldLink = path.join(oldScope, 'dsh-friends-wine');
// Migrate the former @local scoped install out of the profile.
if (fs.existsSync(oldLink) || fs.lstatSync(oldLink, { throwIfNoEntry: false }) !== undefined) {
  fs.rmSync(oldLink, { recursive: true, force: true });
}
const linkPath = path.join(modules, 'dsh-friends-wine');
// Remove an old link or a stale/broken junction left by a previous install.
// rmSync on a junction removes the reparse point without touching its target.
if (fs.existsSync(linkPath) || fs.lstatSync(linkPath, { throwIfNoEntry: false }) !== undefined) {
  fs.rmSync(linkPath, { recursive: true, force: true });
}
fs.symlinkSync(TARGET, linkPath, 'junction');
log(`已建立联接：${linkPath}`);

console.log('');
console.log('安装完成。完全退出并重启 DeepSeek Harness（不是刷新页面）。');
console.log('');
console.log('如需音乐，请自备合法音频并放到：');
console.log(`  ${path.join(DSH_HOME, 'friends-wine', 'friends-wine.mp3')}`);
console.log('或设置环境变量 DSH_FRIENDS_WINE_AUDIO 指向本地音频文件。');
