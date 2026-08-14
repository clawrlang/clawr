export function mapFilter<T, U>(
    input: T[],
    callbackfn: (value: T, index: number, array: T[]) => U | null | undefined,
    thisArg?: any,
): U[] {
    return input
        .map(callbackfn, thisArg)
        .filter((output): output is U => !!output)
}
