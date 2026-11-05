const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDirectory = path.resolve(__dirname, '..');
const compilerPackage = require('typescript/package.json');
const compilerCli = path.resolve(
  path.dirname(require.resolve('typescript/package.json')),
  compilerPackage.bin.tsc,
);

// Always rebuild from source so renamed/deleted modules cannot survive a build.
for (const directory of ['dist', 'public/assets']) {
  fs.rmSync(path.join(rootDirectory, directory), { recursive: true, force: true });
}
for (const project of ['tsconfig.json', 'tsconfig.browser.json']) {
  const result = spawnSync(process.execPath, [compilerCli, '-p', project], {
    cwd: rootDirectory,
    stdio: 'inherit',
  });
  if (result.error) {
    console.error('Compilation failed:', result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
