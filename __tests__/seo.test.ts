import { generateMetadata, generateViewport, generateJsonLd } from '../lib/seo/seo';

describe('SEO utilities', () => {
  test('generateMetadata returns defaults', () => {
    const meta = generateMetadata();
    expect(meta.title).toMatch(/Testero/);
    expect(meta.openGraph?.url).toBe('https://testero.ai/');
  });

  test('generateMetadata uses custom props', () => {
    const meta = generateMetadata({
      title: 'Custom',
      description: 'Desc',
      keywords: ['a'],
      ogImage: '/a.jpg',
      twitterImage: '/b.jpg',
      noIndex: true,
      canonical: '/page',
      useCdn: false,
    });
    expect(meta.title).toBe('Custom');
    expect(meta.description).toBe('Desc');
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.openGraph?.images?.[0].url).toBe('/a.jpg');
    expect(meta.twitter?.images).toEqual(['/b.jpg']);
    expect(meta.alternates?.canonical).toBe('https://testero.ai/page');
  });

  test('generateViewport returns expected config', () => {
    expect(generateViewport()).toEqual({ width: 'device-width', initialScale: 1, maximumScale: 1 });
  });

  test('generateJsonLd merges data and handles cdn flag', () => {
    const json = generateJsonLd({ custom: true });
    const data = JSON.parse(json);
    expect(data.custom).toBe(true);
    const org = data['@graph'][0];
    expect(org.logo.url).toBe('/logo.png');

    const json2 = generateJsonLd({}, false);
    const data2 = JSON.parse(json2);
    const org2 = data2['@graph'][0];
    expect(org2.logo.url).toBe('https://testero.ai/logo.png');
  });
});
