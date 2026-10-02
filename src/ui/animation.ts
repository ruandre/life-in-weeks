export const easeOutExpo = (t: number): number => (t === 1 ? 1 : 1 - 2 ** (-10 * t))
