/** Bounded local activation queue. No claim of cross-process atomicity. */
export class Coordinator {
    tail = Promise.resolve();
    size = 0;
    run(operation) {
        if (this.size >= 64)
            return Promise.reject(new Error("Recovery queue capacity exceeded"));
        this.size++;
        const next = this.tail.then(operation).finally(() => {
            this.size--;
        });
        this.tail = next.catch(() => { });
        return next;
    }
}
