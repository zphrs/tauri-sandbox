import "vitest"

interface CustomMatchers<R = unknown> {
    toBeFoo: () => R
}

declare module "vitest" {
    interface Matchers<T = any> extends CustomMatchers<T> {}
}
