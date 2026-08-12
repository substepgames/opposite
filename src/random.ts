export const random = (seed: number): number => {
    const m = 8239451023
    return ((1839567234 * seed * m + 972348567) % m) / m
}
