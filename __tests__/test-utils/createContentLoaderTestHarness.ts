import path from "path";
import { jest } from "@jest/globals";

const actualFs = jest.requireActual("fs");

interface VirtualEntryBase {
  mtime: number;
}

interface VirtualDirectory extends VirtualEntryBase {
  type: "dir";
  children: Set<string>;
}

interface VirtualFile extends VirtualEntryBase {
  type: "file";
  content: string;
}

type VirtualEntry = VirtualDirectory | VirtualFile;

type LoaderModule = Awaited<typeof import("@/lib/content/loader")>;

type FilesMap = Record<string, string>;

export interface ContentLoaderHarnessOptions {
  files?: FilesMap;
  directories?: string[];
}

export interface ContentLoaderHarness {
  loader: LoaderModule;
  fsMocks: {
    readFile: jest.Mock;
    readFileSync: jest.Mock;
    readdir: jest.Mock;
    readdirSync: jest.Mock;
    stat: jest.Mock;
    access: jest.Mock;
  };
  cacheMocks: {
    get: jest.Mock;
    set: jest.Mock;
  };
  mdxMocks: {
    processMDX: jest.Mock;
    extractMDXMetadata: jest.Mock;
  };
}

function normalise(p: string): string {
  return path.resolve(p);
}

function createVirtualStructure(options: ContentLoaderHarnessOptions) {
  const entries = new Map<string, VirtualEntry>();
  const { files = {}, directories = [] } = options;

  const ensureDirectory = (dirPath: string) => {
    const normalised = normalise(dirPath);
    if (entries.has(normalised)) {
      return;
    }

    const parent = path.dirname(normalised);
    if (parent && parent !== normalised) {
      ensureDirectory(parent);
      const parentEntry = entries.get(parent);
      if (parentEntry && parentEntry.type === "dir") {
        parentEntry.children.add(path.basename(normalised));
      }
    }

    entries.set(normalised, {
      type: "dir",
      children: new Set<string>(),
      mtime: Date.now(),
    });
  };

  for (const dir of directories) {
    ensureDirectory(dir);
  }

  let fileIndex = 0;
  for (const [filePath, content] of Object.entries(files)) {
    const normalised = normalise(filePath);
    const parent = path.dirname(normalised);
    ensureDirectory(parent);
    const parentEntry = entries.get(parent);
    if (parentEntry && parentEntry.type === "dir") {
      parentEntry.children.add(path.basename(normalised));
    }

    entries.set(normalised, {
      type: "file",
      content,
      mtime: Date.now() + fileIndex,
    });
    fileIndex += 1;
  }

  return entries;
}

function createFsMock(options: ContentLoaderHarnessOptions) {
  const entries = createVirtualStructure(options);

  const makeError = (code: string, message: string) => {
    const error = new Error(message);
    (error as NodeJS.ErrnoException).code = code;
    return error;
  };

  const readFile = jest.fn(async (filePath: string) => {
    const entry = entries.get(normalise(filePath));
    if (!entry || entry.type !== "file") {
      throw makeError("ENOENT", `No such file: ${filePath}`);
    }
    await Promise.resolve();
    return entry.content;
  });

  const readdir = jest.fn(async (dirPath: string) => {
    const entry = entries.get(normalise(dirPath));
    if (!entry) {
      throw makeError("ENOENT", `No such directory: ${dirPath}`);
    }
    if (entry.type !== "dir") {
      throw makeError("ENOTDIR", `${dirPath} is not a directory`);
    }
    await Promise.resolve();
    return Array.from(entry.children);
  });

  const stat = jest.fn(async (targetPath: string) => {
    const entry = entries.get(normalise(targetPath));
    if (!entry) {
      throw makeError("ENOENT", `No such entry: ${targetPath}`);
    }
    await Promise.resolve();
    return {
      isFile: () => entry.type === "file",
      isDirectory: () => entry.type === "dir",
      mtime: new Date(entry.mtime),
    };
  });

  const access = jest.fn(async (targetPath: string) => {
    const entry = entries.get(normalise(targetPath));
    if (!entry) {
      throw makeError("ENOENT", `Cannot access: ${targetPath}`);
    }
    await Promise.resolve();
  });

  const readFileSync = jest.fn(() => {
    throw new Error("Synchronous readFileSync should not be used in async tests");
  });

  const readdirSync = jest.fn(() => {
    throw new Error("Synchronous readdirSync should not be used in async tests");
  });

  const fsMock = {
    ...actualFs,
    promises: {
      ...actualFs.promises,
      readFile,
      readdir,
      stat,
      access,
    },
    readFileSync,
    readdirSync,
  };

  return {
    fsMock,
    readFile,
    readFileSync,
    readdir,
    readdirSync,
    stat,
    access,
  };
}

export async function createContentLoaderTestHarness(
  options: ContentLoaderHarnessOptions
): Promise<ContentLoaderHarness> {
  jest.resetModules();

  const { fsMock, readFile, readFileSync, readdir, readdirSync, stat, access } = createFsMock(options);

  const cacheStore = new Map<string, unknown>();
  const cacheGet = jest.fn(async (key: string) => {
    await Promise.resolve();
    return cacheStore.has(key) ? cacheStore.get(key) ?? null : null;
  });
  const cacheSet = jest.fn(async (key: string, value: unknown) => {
    cacheStore.set(key, value);
    await Promise.resolve();
  });

  const processMDX = jest.fn(async (source: string) => {
    await Promise.resolve();
    return source;
  });
  const extractMDXMetadata = jest.fn(() => ({
    readingTimeMinutes: 1,
    wordCount: 100,
    images: [],
    internalLinks: [],
    externalLinks: [],
  }));

  let loaderModule: LoaderModule | undefined;

  await jest.isolateModulesAsync(async () => {
    jest.doMock("fs", () => fsMock);
    jest.doMock("@/lib/content/cache", () => ({
      contentCache: {
        get: cacheGet,
        set: cacheSet,
      },
    }));
    jest.doMock("@/lib/content/mdx", () => ({
      processMDX,
      extractMDXMetadata,
    }));

    loaderModule = await import("@/lib/content/loader");
  });

  if (!loaderModule) {
    throw new Error("Failed to load content loader module under test harness");
  }

  return {
    loader: loaderModule,
    fsMocks: {
      readFile,
      readFileSync,
      readdir,
      readdirSync,
      stat,
      access,
    },
    cacheMocks: {
      get: cacheGet,
      set: cacheSet,
    },
    mdxMocks: {
      processMDX,
      extractMDXMetadata,
    },
  };
}
