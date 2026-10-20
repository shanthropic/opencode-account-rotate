/** Bounded local activation queue. No claim of cross-process atomicity. */
export declare class Coordinator {
    private tail;
    private size;
    run(operation: () => Promise<void>): Promise<void>;
}
