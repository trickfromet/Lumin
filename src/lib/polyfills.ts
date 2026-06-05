/**
 * Edge Runtime polyfills
 *
 * bcryptjs 依赖 setImmediate，但 Edge Runtime（Cloudflare Workers）不提供。
 * 此文件必须在 bcryptjs 之前导入。
 */
if (typeof globalThis.setImmediate === "undefined") {
  const setImmediatePolyfill = (
    fn: (...args: unknown[]) => void,
    ...args: unknown[]
  ) => setTimeout(fn, 0, ...args);
  (globalThis as Record<string, unknown>).setImmediate = setImmediatePolyfill;
}

export {};
