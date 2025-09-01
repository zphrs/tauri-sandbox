export type RWLock<T> = {
    waiting: Set<{
        type: "reader" | "writer";
        callback: () => void;
    }>;
    readersActive: number;
    writerActive: boolean;
    value: T;
    /**
     * Will release lock automatically when `then` resolves. Pass in {@link MANUAL}
     * to be forced to manually release the lock when you're done with it
     * @param then
     * @returns a function called `release` to release the lock and the async lock
     * itself which will resolve once the lock is held
     */
    read: (then: (value: T) => void | Promise<void>) => {
        release: () => void;
        lock: Promise<T>;
    };
    write: (then: (value: T) => void | Promise<void>) => {
        release: () => void;
        lock: Promise<T>;
    };
};
export declare const MANUAL: () => Promise<never>;
export declare function createRWLock<T>(value: T): RWLock<T>;
