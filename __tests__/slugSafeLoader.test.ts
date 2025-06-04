jest.mock('../lib/content/loader', () => ({
  getHubContent: jest.fn(async (s: string) => `hub:${s}`),
  getSpokeContent: jest.fn(async (s: string) => `spoke:${s}`),
  getSpokesForHub: jest.fn(async (s: string) => [`spokes:${s}`]),
  getAllContentSlugs: jest.fn(),
  getAllHubContent: jest.fn(),
  getAllSpokeContent: jest.fn(),
}));

const loaderMocks = require('../lib/content/loader');

describe('slug safe loader wrappers', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('getHubContentSafe extracts slug from params', async () => {
    const { getHubContentSafe } = require('../lib/content/slugSafeLoader');
    const res = await getHubContentSafe({ params: { slug: ['test'] } });
    expect(loaderMocks.getHubContent).toHaveBeenCalledWith('test');
    expect(res).toBe('hub:test');
  });

  test('getHubContentSafe falls back to default', async () => {
    const { getHubContentSafe } = require('../lib/content/slugSafeLoader');
    await getHubContentSafe({});
    expect(loaderMocks.getHubContent).toHaveBeenCalledWith('google-cloud-certification-guide');
  });

  test('getSpokeContentSafe handles string slug', async () => {
    const { getSpokeContentSafe } = require('../lib/content/slugSafeLoader');
    const res = await getSpokeContentSafe('s1');
    expect(loaderMocks.getSpokeContent).toHaveBeenCalledWith('s1');
    expect(res).toBe('spoke:s1');
  });

  test('getSpokesForHubSafe uses provided slug', async () => {
    const { getSpokesForHubSafe } = require('../lib/content/slugSafeLoader');
    const res = await getSpokesForHubSafe({ slug: 'hub1' });
    expect(loaderMocks.getSpokesForHub).toHaveBeenCalledWith('hub1');
    expect(res).toEqual(['spokes:hub1']);
  });

  test('re-exports other functions', () => {
    const mod = require('../lib/content/slugSafeLoader');
    expect(mod.getAllContentSlugs).toBe(loaderMocks.getAllContentSlugs);
    expect(mod.getAllHubContent).toBe(loaderMocks.getAllHubContent);
    expect(mod.getAllSpokeContent).toBe(loaderMocks.getAllSpokeContent);
  });
});
