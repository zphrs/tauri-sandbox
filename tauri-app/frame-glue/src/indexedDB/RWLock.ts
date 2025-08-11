export type RWLock<T> = {
    waiting: Set<{ type: "reader" | "writer"; callback: () => void }>
    readersActive: number
    writerActive: boolean
    value: T
    /**
     * Will release lock automatically when `then` resolves. Pass in {@link MANUAL}
     * to be forced to manually release the lock when you're done with it
     * @param then
     * @returns a function called `release` to release the lock and the async lock
     * itself which will resolve once the lock is held
     */
    read: (then: (value: T) => void | Promise<void>) => {
        release: () => void
        lock: Promise<T>
    }
    write: (then: (value: T) => void | Promise<void>) => {
        release: () => void
        lock: Promise<T>
    }
}

export const MANUAL: () => Promise<any> = () => {
    return new Promise((_res) => {})
}

function maybeGiveNext<T>(lock: RWLock<T>) {
    // trigger whatever is next; if that's one writer then break immediately.
    if (lock.readersActive === 0 && lock.writerActive === false) {
        const toDeletes = []
        for (const next of lock.waiting) {
            next.callback()
            toDeletes.push(next)
            if (next.type === "writer") break
            maybeGiveNext(lock)
        }
        for (const toDelete of toDeletes) {
            lock.waiting.delete(toDelete)
        }
    }
    if (lock.readersActive !== 0 && lock.writerActive === false) {
        const toDeletes = []
        for (const maybeReader of lock.waiting) {
            if (maybeReader.type === "writer") {
                break
            }
            maybeReader.callback()
            toDeletes.push(maybeReader)
            lock.waiting.delete(maybeReader)
        }
        for (const toDelete of toDeletes) {
            lock.waiting.delete(toDelete)
        }
    }
}

export function createRWLock<T>(value: T): RWLock<T> {
    const out: RWLock<T> = {
        waiting: new Set<{
            type: "reader" | "writer"
            callback: () => void
        }>(),
        readersActive: 0,
        writerActive: false,
        value,
        read: function (then): {
            release: () => void
            lock: Promise<T>
        } {
            let active = false
            let resLock: (value: T) => void
            const lock = new Promise<T>((res) => {
                resLock = res
            })
            const give = () => {
                active = true
                this.readersActive++
                resLock(value)
                const v = then(value)
                if (v && "then" in v) {
                    v.then(() => {
                        release()
                    })
                }
            }
            const release = () => {
                if (active) {
                    this.readersActive--
                }
                active = false
                maybeGiveNext(this)
            }
            this.waiting.add({ type: "reader", callback: give })
            maybeGiveNext(this)
            return {
                release,
                lock,
            }
        },
        write: function (then): {
            release: () => void
            lock: Promise<T>
        } {
            let active = false
            let resLock: (val: T) => void
            const lock = new Promise<T>((res) => (resLock = res))
            const give = () => {
                active = true
                this.writerActive = true
                resLock(this.value)
                const v = then(value)
                if (v && "then" in v) {
                    v.then(() => {
                        release()
                    })
                }
            }
            const release = () => {
                if (active) {
                    this.writerActive = false
                }
                maybeGiveNext(this)
            }
            this.waiting.add({ type: "writer", callback: give })
            maybeGiveNext(this)
            return {
                release,
                lock,
            }
        },
    } satisfies RWLock<T>
    return out
}
