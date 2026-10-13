/** Shallow copy of `source` without the given keys (typed `Omit`). */
export function omit<T extends object, K extends keyof T>(source: T, ...keys: K[]): Omit<T, K> {
	const copy = { ...source };
	for (const key of keys) {
		delete copy[key];
	}
	return copy;
}
