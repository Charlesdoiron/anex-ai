/**
 * Next.js Instrumentation - runs once at server startup
 * Used to load polyfills before any other code runs
 *
 * This file is automatically loaded by Next.js before the application starts.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Polyfill Promise.withResolvers for Node.js < 22
  // Required by pdfjs-dist (used by pdf-parse v2)
  if (typeof Promise.withResolvers !== "function") {
    Promise.withResolvers = function <T>(): {
      promise: Promise<T>
      resolve: (value: T | PromiseLike<T>) => void
      reject: (reason?: unknown) => void
    } {
      let resolve!: (value: T | PromiseLike<T>) => void
      let reject!: (reason?: unknown) => void
      const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
      })
      return { promise, resolve, reject }
    }
  }
}
