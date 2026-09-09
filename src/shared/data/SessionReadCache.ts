export class SessionReadCache {
  private entries = new Map<string, {promise: Promise<unknown>; expires: number}>();
  clear() { this.entries.clear(); }
  read<T>(key: string, loader: () => Promise<T>, reuse: boolean): Promise<T> {
    const previous = this.entries.get(key);
    if (reuse && previous && previous.expires > Date.now()) return previous.promise as Promise<T>;
    const entry = {promise: Promise.resolve().then(loader), expires: Date.now() + 30_000};
    this.entries.set(key, entry);
    void entry.promise.catch(() => { if (this.entries.get(key) === entry) this.entries.delete(key); });
    return entry.promise;
  }
}
