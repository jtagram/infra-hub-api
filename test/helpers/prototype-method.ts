/**
 * Reads a prototype method without tripping `unbound-method`: the method is
 * only inspected (decorator metadata, spies), never called detached.
 */
export function prototypeMethod<T extends object, K extends keyof T>(prototype: T, key: K): T[K] {
	return Reflect.get(prototype, key);
}
