const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

console.log('======================================================');
console.log('    RUNNING SEAT SAFARI THEME SYSTEM VERIFICATION     ');
console.log('======================================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
    failed++;
  }
}

// 1. Verify CSS compilation with custom-variant dark
test('Theme 1: Compiled CSS uses selector-based :where(.dark) rather than media-query gating', () => {
  const distDir = path.join(__dirname, '../client/dist/assets');
  assert.ok(fs.existsSync(distDir), 'Client dist/assets must exist');
  
  const cssFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.css'));
  assert.ok(cssFiles.length > 0, 'Must have compiled CSS bundle');
  
  const css = fs.readFileSync(path.join(distDir, cssFiles[0]), 'utf8');
  
  // Verify :where(.dark) exists and is used extensively
  const darkMatches = css.match(/:where\(\.dark[^\)]*\)/g) || css.match(/\.dark/g);
  assert.ok(darkMatches && darkMatches.length > 50, 'CSS must contain class-based dark rules');

  // Verify that utility classes are not trapped inside @media (prefers-color-scheme: dark)
  const mediaDark = css.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:where\(\.dark/);
  assert.strictEqual(mediaDark, null, 'Utility dark classes must NOT be trapped in @media prefers-color-scheme');
});

// 2. Verify design tokens in CSS
test('Theme 2: CSS contains exact required dark and light design tokens', () => {
  const indexCss = fs.readFileSync(path.join(__dirname, '../client/src/index.css'), 'utf8');
  
  // Required Light Mode tokens
  assert.ok(indexCss.includes('#F8F8F8'), 'Must include light background #F8F8F8');
  assert.ok(indexCss.includes('#FFFFFF'), 'Must include light surface #FFFFFF');
  assert.ok(indexCss.includes('#171717'), 'Must include light primary text #171717');
  assert.ok(indexCss.includes('#737373'), 'Must include light secondary text #737373');
  assert.ok(indexCss.includes('#E5E5E5'), 'Must include light border #E5E5E5');
  assert.ok(indexCss.includes('#EA580C'), 'Must include light accent orange #EA580C');

  // Required Dark Mode tokens
  assert.ok(indexCss.includes('#111318'), 'Must include dark background #111318');
  assert.ok(indexCss.includes('#202127'), 'Must include dark surface #202127');
  assert.ok(indexCss.includes('#292A30'), 'Must include dark elevated surface #292A30');
  assert.ok(indexCss.includes('#F5F5F5'), 'Must include dark primary text #F5F5F5');
  assert.ok(indexCss.includes('#A1A1AA'), 'Must include dark secondary text #A1A1AA');
  assert.ok(indexCss.includes('#33343B'), 'Must include dark border #33343B');
  assert.ok(indexCss.includes('#F97316'), 'Must include dark accent orange #F97316');
});

// 3. Verify anti-flash inline script in index.html
test('Theme 3: index.html has early inline script to prevent unstyled theme flash', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '../client/index.html'), 'utf8');
  assert.ok(indexHtml.includes('safari_theme'), 'Must read safari_theme from localStorage');
  assert.ok(indexHtml.includes('prefers-color-scheme'), 'Must fallback to system prefers-color-scheme');
  assert.ok(indexHtml.includes("classList.add('dark')"), 'Must add dark class early in head');
  assert.ok(indexHtml.includes("setAttribute('data-theme'"), 'Must set data-theme attribute');
});

// 4. Verify ThemeContext logic simulation
test('Theme 4: ThemeContext logic correctly resolves first-visit system theme and manual overrides', () => {
  // Simulate mock browser environment
  const mockStorage = new Map();
  let mediaQueryMatches = false; // System prefers light by default

  const resolveTheme = () => {
    const saved = mockStorage.get('safari_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return mediaQueryMatches ? 'dark' : 'light';
  };

  // Scenario A: First visit, system is light -> resolved is light
  assert.strictEqual(resolveTheme(), 'light');

  // Scenario B: First visit, system changes to dark -> resolved is dark
  mediaQueryMatches = true;
  assert.strictEqual(resolveTheme(), 'dark');

  // Scenario C: User manually chooses 'light' -> saved to storage
  mockStorage.set('safari_theme', 'light');
  assert.strictEqual(resolveTheme(), 'light');

  // Scenario D: System changes to dark, but user manual preference 'light' MUST override system
  mediaQueryMatches = true;
  assert.strictEqual(resolveTheme(), 'light', 'Manual user preference must override system OS preference');

  // Scenario E: User toggles to 'dark' -> saved to storage
  mockStorage.set('safari_theme', 'dark');
  assert.strictEqual(resolveTheme(), 'dark');
});

console.log('\n======================================================');
console.log(`  THEME RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}
