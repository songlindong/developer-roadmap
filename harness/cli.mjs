#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const harnessDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(harnessDir, '..');
const config = JSON.parse(readFileSync(join(harnessDir, 'config.json'), 'utf8'));
const command = process.argv[2] || 'help';
const args = process.argv.slice(3);

const colors = process.stdout.isTTY
  ? { green: '\u001b[32m', red: '\u001b[31m', cyan: '\u001b[36m', reset: '\u001b[0m' }
  : { green: '', red: '', cyan: '', reset: '' };

function info(message) {
  console.log(`${colors.cyan}==>${colors.reset} ${message}`);
}

function pass(message) {
  console.log(`${colors.green}PASS${colors.reset} ${message}`);
}

function fail(message) {
  console.error(`${colors.red}FAIL${colors.reset} ${message}`);
}

function executable(name) {
  return process.platform === 'win32' && name === 'npm' ? 'npm.cmd' : name;
}

function runProcess(item, quiet = false) {
  const cwd = resolve(rootDir, item.cwd || '.');
  const result = spawnSync(executable(item.command), item.args || [], {
    cwd,
    encoding: 'utf8',
    stdio: item.expectEmptyOutput || quiet ? 'pipe' : 'inherit',
    shell: false,
  });

  if (result.error) {
    fail(`${item.name}: ${result.error.message}`);
    return false;
  }
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    fail(`${item.name} (exit ${result.status})`);
    return false;
  }
  if (item.expectEmptyOutput && result.stdout.trim()) {
    fail(`${item.name}: these files are not formatted:`);
    console.error(result.stdout.trim());
    return false;
  }

  if (!quiet && result.stderr) process.stderr.write(result.stderr);
  pass(item.name);
  return true;
}

function runGate(name) {
  const items = config.gates[name];
  if (!items) {
    fail(`Unknown gate: ${name}`);
    return false;
  }

  info(`Running ${name} gate`);
  for (const item of items) {
    if (!runProcess(item)) return false;
  }
  return true;
}

function doctor() {
  info('Checking local toolchain');
  let ok = true;
  for (const tool of config.tools) {
    const result = spawnSync(executable(tool.name), tool.args, {
      cwd: rootDir,
      encoding: 'utf8',
      shell: false,
    });
    if (result.error || result.status !== 0) {
      fail(`${tool.name}: unavailable. ${tool.hint}`);
      ok = false;
      continue;
    }
    pass(`${tool.name}: ${(result.stdout || result.stderr).trim()}`);
  }

  const frontendModules = join(rootDir, 'frontend', 'node_modules');
  if (!existsSync(frontendModules)) {
    fail('frontend dependencies: run `npm ci --prefix frontend`');
    ok = false;
  } else {
    pass('frontend dependencies installed');
  }
  return ok;
}

const requiredDocs = {
  'spec.md': ['背景', '目标', '非目标', '需求', '验收标准'],
  'plan.md': ['设计方案', '影响范围', '测试策略', '发布与回滚'],
  'tasks.md': ['任务'],
  'verification.md': ['验证摘要', '验证证据'],
};
const allowedStatuses = new Set(['proposed', 'approved', 'implemented', 'verified']);

function hasHeading(content, heading) {
  return new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*$`, 'mi').test(content);
}

function checkSpecs() {
  info('Checking change specifications');
  const changesDir = join(rootDir, 'specs', 'changes');
  if (!existsSync(changesDir)) {
    fail('specs/changes does not exist');
    return false;
  }

  const directories = readdirSync(changesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'));
  let ok = true;

  for (const entry of directories) {
    const changeDir = join(changesDir, entry.name);
    const manifestPath = join(changeDir, 'change.json');
    if (!existsSync(manifestPath)) {
      fail(`${entry.name}: missing change.json`);
      ok = false;
      continue;
    }

    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (error) {
      fail(`${entry.name}: invalid change.json (${error.message})`);
      ok = false;
      continue;
    }

    for (const field of ['id', 'title', 'status', 'created', 'updated']) {
      if (!manifest[field]) {
        fail(`${entry.name}: change.json is missing ${field}`);
        ok = false;
      }
    }
    if (manifest.id !== entry.name) {
      fail(`${entry.name}: manifest id must match its directory`);
      ok = false;
    }
    if (!allowedStatuses.has(manifest.status)) {
      fail(`${entry.name}: invalid status ${manifest.status}`);
      ok = false;
    }

    for (const [file, headings] of Object.entries(requiredDocs)) {
      const path = join(changeDir, file);
      if (!existsSync(path)) {
        fail(`${entry.name}: missing ${file}`);
        ok = false;
        continue;
      }
      const content = readFileSync(path, 'utf8');
      for (const heading of headings) {
        if (!hasHeading(content, heading)) {
          fail(`${entry.name}/${file}: missing "## ${heading}"`);
          ok = false;
        }
      }
    }

    if (manifest.status === 'verified') {
      const tasks = readFileSync(join(changeDir, 'tasks.md'), 'utf8');
      const verification = readFileSync(join(changeDir, 'verification.md'), 'utf8');
      if (/^- \[ \]/m.test(tasks)) {
        fail(`${entry.name}: verified change still has incomplete tasks`);
        ok = false;
      }
      if (/\bTODO\b|待补充/i.test(verification)) {
        fail(`${entry.name}: 已验证的变更仍有待补充的验证证据`);
        ok = false;
      }
    }

    if (ok) pass(`${entry.name} (${manifest.status})`);
  }

  if (directories.length === 0) pass('no change specifications yet');
  return ok;
}

function renderTemplate(name, values) {
  let content = readFileSync(join(rootDir, 'specs', '_template', name), 'utf8');
  for (const [key, value] of Object.entries(values)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  return content;
}

function newSpec(rawSlug, rawTitle) {
  const slug = (rawSlug || '').toLowerCase().trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    fail('Usage: npm run spec:new -- <kebab-case-slug> "<title>"');
    return false;
  }

  const changeDir = join(rootDir, 'specs', 'changes', slug);
  if (existsSync(changeDir)) {
    fail(`Change already exists: specs/changes/${slug}`);
    return false;
  }

  const title = (rawTitle || slug.replaceAll('-', ' ')).trim();
  const today = new Date().toISOString().slice(0, 10);
  const values = { id: slug, title, date: today };
  mkdirSync(changeDir, { recursive: true });
  for (const name of ['change.json', ...Object.keys(requiredDocs)]) {
    writeFileSync(join(changeDir, name), renderTemplate(name, values), 'utf8');
  }
  pass(`created specs/changes/${slug}`);
  console.log('下一步：完善 spec.md 和 plan.md，评审通过并将状态设为 "approved" 后再开始实现。');
  return true;
}

function printHelp() {
  console.log(`SDD 开发 Harness

用法：node harness/cli.mjs <命令>

命令：
  doctor                     检查本地开发环境
  new <slug> [title]         创建变更规格
  spec-check                 校验全部变更规格
  check                      运行格式、vet 和 lint 检查
  test                       运行前后端测试
  build                      构建前后端
  verify                     依次运行规格、检查、测试和构建质量门
  help                       显示本帮助信息`);
}

let ok;
switch (command) {
  case 'doctor': ok = doctor(); break;
  case 'new': ok = newSpec(args[0], args.slice(1).join(' ')); break;
  case 'spec-check': ok = checkSpecs(); break;
  case 'check': ok = checkSpecs() && runGate('check'); break;
  case 'test': ok = runGate('test'); break;
  case 'build': ok = runGate('build'); break;
  case 'verify':
    ok = checkSpecs() && runGate('check') && runGate('test') && runGate('build');
    break;
  case 'help':
  case '--help':
  case '-h': printHelp(); ok = true; break;
  default: fail(`Unknown command: ${command}`); printHelp(); ok = false;
}

process.exitCode = ok ? 0 : 1;
