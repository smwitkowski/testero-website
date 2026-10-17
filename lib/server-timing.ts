import "server-only";

/** Request-local numeric durations only; never include identity or query values. */
export class ServerTiming {
  private readonly started = performance.now();
  private readonly entries: string[] = [];
  async measure<T>(name: string, task: () => PromiseLike<T> | T): Promise<T> {
    const start = performance.now();
    try { return await task(); }
    finally { this.entries.push(`${name};dur=${(performance.now() - start).toFixed(1)}`); }
  }
  header() { return [...this.entries, `total;dur=${(performance.now() - this.started).toFixed(1)}`].join(", "); }
}
