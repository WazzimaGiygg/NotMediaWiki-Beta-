import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Package Dependencies Verification', () => {
  it('should verify react and react-dom are properly specified and version-aligned', () => {
    const pkgPath = path.resolve(__dirname, '../package.json');
    expect(fs.existsSync(pkgPath)).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.dependencies).toBeDefined();

    const reactVersion = pkg.dependencies.react;
    const reactDomVersion = pkg.dependencies['react-dom'];

    expect(reactVersion).toBeDefined();
    expect(typeof reactVersion).toBe('string');
    expect(reactDomVersion).toBeDefined();
    expect(typeof reactDomVersion).toBe('string');

    const cleanReact = reactVersion.replace(/^[\^~>=<]+/, '');
    const cleanReactDom = reactDomVersion.replace(/^[\^~>=<]+/, '');

    // Major versions must match
    expect(cleanReact.split('.')[0]).toBe(cleanReactDom.split('.')[0]);
    // Both versions should be identical
    expect(cleanReact).toBe(cleanReactDom);
  });

  it('should verify vite build and preview scripts have no conflicting flags', () => {
    const pkgPath = path.resolve(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const scripts = pkg.scripts || {};

    expect(scripts.build).toBe('vite build');
    expect(scripts.preview).toBe('vite preview');
  });
});
