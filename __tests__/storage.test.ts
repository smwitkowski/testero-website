let getCdnUrl: typeof import('../lib/gcp/storage').getCdnUrl;

describe('getCdnUrl', () => {
  const originalEnv = process.env.GCP_CDN_URL;
  beforeAll(() => {
    process.env.GCP_CDN_URL = 'https://cdn.example.com';
    jest.resetModules();
    ({ getCdnUrl } = require('../lib/gcp/storage'));
  });
  afterAll(() => {
    process.env.GCP_CDN_URL = originalEnv;
  });

  it('returns url combining CDN_URL and filename', () => {
    expect(getCdnUrl('file.txt')).toBe('https://cdn.example.com/file.txt');
  });
});
