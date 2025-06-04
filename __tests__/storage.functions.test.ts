const fileMock = {
  save: jest.fn(),
  getSignedUrl: jest.fn(),
  exists: jest.fn(),
  delete: jest.fn(),
};
const bucketMock = {
  upload: jest.fn(),
  file: jest.fn(() => fileMock),
  setCorsConfiguration: jest.fn(),
};
const storageInstance = { bucket: jest.fn(() => bucketMock) };
const StorageMock = jest.fn(() => storageInstance);

jest.mock('@google-cloud/storage', () => ({
  Storage: StorageMock,
}));

describe('gcp storage helpers', () => {
  const env = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...env, GCP_STORAGE_BUCKET_NAME: 'b', GCP_CDN_URL: 'https://cdn' };
    fileMock.save.mockReset();
    fileMock.getSignedUrl.mockReset();
    fileMock.exists.mockReset();
    fileMock.delete.mockReset();
    bucketMock.upload.mockReset();
    bucketMock.setCorsConfiguration.mockReset();
    storageInstance.bucket.mockClear();
    StorageMock.mockClear();
  });

  afterAll(() => {
    process.env = env;
  });

  test('initStorage uses key file when provided', () => {
    process.env.GCP_KEY_FILE_PATH = '/key.json';
    const { initStorage } = require('../lib/gcp/storage');
    const client = initStorage();
    expect(StorageMock).toHaveBeenCalledWith({ keyFilename: '/key.json' });
    expect(initStorage()).toBe(client); // cached
  });

  test('uploadFile uploads and returns cdn url', async () => {
    const { uploadFile } = require('../lib/gcp/storage');
    const url = await uploadFile('local.txt', 'dest.txt', { contentType: 'text/plain', metadata: { a: 'b' } });
    expect(bucketMock.upload).toHaveBeenCalledWith('local.txt', expect.objectContaining({ destination: 'dest.txt' }));
    const opts = bucketMock.upload.mock.calls[0][1];
    expect(opts.metadata.contentType).toBe('text/plain');
    expect(opts.metadata.metadata).toEqual({ a: 'b' });
    expect(url).toBe('https://cdn/dest.txt');
  });

  test('uploadBuffer saves buffer', async () => {
    const { uploadBuffer } = require('../lib/gcp/storage');
    await uploadBuffer(Buffer.from('a'), 'buf.txt', { cacheControl: 'no-cache', contentType: 'text/plain' });
    expect(fileMock.save).toHaveBeenCalled();
    const opts = fileMock.save.mock.calls[0][1];
    expect(opts.metadata.cacheControl).toBe('no-cache');
    expect(opts.metadata.contentType).toBe('text/plain');
  });

  test('getSignedUrl returns url', async () => {
    fileMock.getSignedUrl.mockResolvedValue(['signed']);
    const { getSignedUrl } = require('../lib/gcp/storage');
    const url = await getSignedUrl('file.txt', { action: 'write', expires: 10, contentType: 'text/plain' });
    expect(fileMock.getSignedUrl).toHaveBeenCalled();
    expect(url).toBe('signed');
  });

  test('fileExists checks existence', async () => {
    fileMock.exists.mockResolvedValue([true]);
    const { fileExists } = require('../lib/gcp/storage');
    await expect(fileExists('a.txt')).resolves.toBe(true);
  });

  test('deleteFile removes file', async () => {
    const { deleteFile } = require('../lib/gcp/storage');
    await deleteFile('x.txt');
    expect(fileMock.delete).toHaveBeenCalled();
  });

  test('configureBucketCors sets configuration', async () => {
    const { configureBucketCors } = require('../lib/gcp/storage');
    await configureBucketCors(['https://a.com'], ['GET'], 600);
    expect(bucketMock.setCorsConfiguration).toHaveBeenCalledWith([
      {
        origin: ['https://a.com'],
        method: ['GET'],
        responseHeader: ['Content-Type', 'x-goog-meta-*'],
        maxAgeSeconds: 600,
      },
    ]);
  });
});
