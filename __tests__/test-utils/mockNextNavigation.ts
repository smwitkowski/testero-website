import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

type MockRouterFn = jest.Mock<ReturnType<AppRouterInstance['push']>, Parameters<AppRouterInstance['push']>>;

type RouterMethod = jest.Mock<ReturnType<AppRouterInstance['back']>, Parameters<AppRouterInstance['back']>>;

type PrefetchMethod = jest.Mock<ReturnType<AppRouterInstance['prefetch']>, Parameters<AppRouterInstance['prefetch']>>;

export interface MockAppRouterInstance extends Omit<AppRouterInstance, 'push' | 'replace' | 'prefetch' | 'back' | 'forward' | 'refresh'> {
  push: MockRouterFn;
  replace: MockRouterFn;
  back: RouterMethod;
  forward: RouterMethod;
  refresh: RouterMethod;
  prefetch: PrefetchMethod;
}

const createRouterState = (overrides: Partial<MockAppRouterInstance> = {}): MockAppRouterInstance => ({
  back: jest.fn(),
  forward: jest.fn(),
  prefetch: jest.fn().mockResolvedValue(undefined),
  push: jest.fn(),
  replace: jest.fn(),
  refresh: jest.fn(),
  pathname: '/',
  query: {},
  params: {},
  ...overrides,
});

export const mockRouter: MockAppRouterInstance = createRouterState();

export const resetMockRouter = (overrides: Partial<MockAppRouterInstance> = {}): void => {
  Object.assign(mockRouter, createRouterState(overrides));
};

type IteratorFactory<T> = () => IterableIterator<T>;

type ForEachCallback = (value: string, key: string, parent: ReadonlyURLSearchParams) => void;

export interface MockReadonlyURLSearchParams {
  get: jest.Mock<string | null, [string]>;
  getAll: jest.Mock<string[], [string]>;
  has: jest.Mock<boolean, [string]>;
  entries: jest.Mock<IterableIterator<[string, string]>, []>;
  keys: jest.Mock<IterableIterator<string>, []>;
  values: jest.Mock<IterableIterator<string>, []>;
  forEach: jest.Mock<void, [ForEachCallback]>;
  toString: jest.Mock<string, []>;
  setParams: (params?: Record<string, string>) => void;
  resetMocks: () => void;
}

const cloneIterator = <T>(factory: IteratorFactory<T>): IterableIterator<T> => {
  const snapshot = Array.from(factory());
  return snapshot[Symbol.iterator]();
};

const createSearchParamsState = (initial: Record<string, string> = {}): MockReadonlyURLSearchParams => {
  let current = new URLSearchParams(initial);

  const api: MockReadonlyURLSearchParams = {
    get: jest.fn((key: string) => current.get(key)),
    getAll: jest.fn((key: string) => current.getAll(key)),
    has: jest.fn((key: string) => current.has(key)),
    entries: jest.fn(() => cloneIterator(() => current.entries())),
    keys: jest.fn(() => cloneIterator(() => current.keys())),
    values: jest.fn(() => cloneIterator(() => current.values())),
    forEach: jest.fn((callback: ForEachCallback) => {
      current.forEach((value, key) => callback(value, key, api as unknown as ReadonlyURLSearchParams));
    }),
    toString: jest.fn(() => current.toString()),
    setParams: (params: Record<string, string> = {}) => {
      current = new URLSearchParams(params);
    },
    resetMocks: () => {
      api.get.mockClear();
      api.getAll.mockClear();
      api.has.mockClear();
      api.entries.mockClear();
      api.keys.mockClear();
      api.values.mockClear();
      api.forEach.mockClear();
      api.toString.mockClear();
    },
  };

  return api;
};

export const mockSearchParams: MockReadonlyURLSearchParams = createSearchParamsState();

export const resetMockSearchParams = (params?: Record<string, string>): void => {
  mockSearchParams.setParams(params ?? {});
  mockSearchParams.resetMocks();
};

export const setMockSearchParams = (params: Record<string, string>): void => {
  mockSearchParams.setParams(params);
};
