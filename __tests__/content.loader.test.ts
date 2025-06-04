import fs from 'fs';
import os from 'os';
import path from 'path';

let loader: typeof import('../lib/content/loader');
const originalCwd = process.cwd();

function makeFile(dir: string, relPath: string, content: string) {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

describe('content loader', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'content-'));
    makeFile(
      tmpDir,
      'app/content/hub/hub1.md',
      `---\ntitle: Hub 1\ndescription: Hub desc\ndate: 2024-01-01\n---\n\n# Hub 1 Content`
    );
    makeFile(
      tmpDir,
      'app/content/spokes/spoke1.md',
      `---\ntitle: Spoke 1\ndescription: Spoke desc\ndate: 2024-01-02\nhubSlug: hub1\nspokeOrder: 2\n---\n\n# Spoke 1 Content`
    );
    process.chdir(tmpDir);
    jest.resetModules();
    loader = require('../lib/content/loader');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('loads hub content', async () => {
    const hub = await loader.getHubContent('hub1');
    expect(hub?.meta.title).toBe('Hub 1');
    expect(hub?.meta.slug).toBe('hub1');
    expect(hub?.content).toContain('<h1');
  });

  test('loads spoke content', async () => {
    const spoke = await loader.getSpokeContent('spoke1');
    expect(spoke?.meta.hubSlug).toBe('hub1');
  });

  test('returns all hub content sorted by date', async () => {
    makeFile(
      tmpDir,
      'app/content/hub/hub2.md',
      `---\ntitle: Hub 2\ndescription: Hub2\ndate: 2024-02-01\n---\n\ntext`
    );
    const hubs = await loader.getAllHubContent();
    expect(hubs.length).toBe(2);
    expect(hubs[0].meta.slug).toBe('hub2');
  });

  test('gets spokes for hub ordered by spokeOrder', async () => {
    makeFile(
      tmpDir,
      'app/content/spokes/spoke2.md',
      `---\ntitle: Spoke 2\ndescription: d\ndate: 2024-01-03\nhubSlug: hub1\nspokeOrder: 1\n---\n\ntext`
    );
    const spokes = await loader.getSpokesForHub('hub1');
    expect(spokes.map(s => s.meta.slug)).toEqual(['spoke2', 'spoke1']);
  });

  test('collects all slugs', async () => {
    const slugs = await loader.getAllContentSlugs();
    expect(slugs.hubSlugs).toContain('hub1');
    expect(slugs.spokeSlugs).toContain('spoke1');
  });
});
