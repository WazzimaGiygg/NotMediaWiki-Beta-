import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, '../package.json');

export function verifyReactDependencies() {
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`package.json not found at: ${packageJsonPath}`);
  }

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const dependencies = pkg.dependencies || {};

  const reactVersion = dependencies.react;
  const reactDomVersion = dependencies['react-dom'];

  console.log('[Dependency Check] Verifying React and React-DOM in package.json...');
  console.log(`  - react: ${reactVersion}`);
  console.log(`  - react-dom: ${reactDomVersion}`);

  if (!reactVersion) {
    console.error('❌ Error: "react" dependency is missing from package.json');
    process.exit(1);
  }

  if (!reactDomVersion) {
    console.error('❌ Error: "react-dom" dependency is missing from package.json');
    process.exit(1);
  }

  const cleanReact = reactVersion.replace(/^[\^~>=<]+/, '');
  const cleanReactDom = reactDomVersion.replace(/^[\^~>=<]+/, '');

  const majorReact = cleanReact.split('.')[0];
  const majorReactDom = cleanReactDom.split('.')[0];

  if (majorReact !== majorReactDom) {
    console.error(
      `❌ Error: React version (${reactVersion}) and React-DOM version (${reactDomVersion}) major versions do not match!`
    );
    process.exit(1);
  }

  console.log(`✅ Success: React (${reactVersion}) and React-DOM (${reactDomVersion}) are valid and compatible.`);
}

// Run directly if executed via CLI
if (process.argv[1] === __filename) {
  try {
    verifyReactDependencies();
  } catch (err) {
    console.error('❌ Failed dependency verification:', err);
    process.exit(1);
  }
}
