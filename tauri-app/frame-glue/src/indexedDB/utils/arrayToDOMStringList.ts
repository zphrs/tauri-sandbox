export function arrayToDOMStringList(array: string[]): DOMStringList {
    return {
        get length() {
            return array.length
        },

        contains(value: string) {
            return array.includes(value)
        },

        item(index: number) {
            return array[index]
        },

        [Symbol.iterator]: array[Symbol.iterator],
    }
}
