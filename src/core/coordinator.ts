/** Bounded local activation queue. No claim of cross-process atomicity. */
export class Coordinator {
  private tail: Promise<void> = Promise.resolve();
  private size = 0;
  run(operation: () => Promise<void>): Promise<void> {
    if (this.size >= 64) return Promise.reject(new Error("Recovery queue capacity exceeded"));
    this.size++;
    const next = this.tail.then(operation).finally(() => { this.size--; });
    this.tail = next.catch(() => {});
    return next;
  }
}
