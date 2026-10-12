/** A tiny typed event bus. Systems talk through it instead of importing each other. */
export class Bus<Events extends object> {
  private handlers = new Map<keyof Events, Set<(payload: never) => void>>();

  /** Subscribe; returns a function that unsubscribes. */
  on<K extends keyof Events>(type: K, handler: (payload: Events[K]) => void): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as (payload: never) => void);
    return () => set.delete(handler as (payload: never) => void);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const handler of set) (handler as (payload: Events[K]) => void)(payload);
  }
}
