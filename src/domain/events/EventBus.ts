export type Unsubscribe = () => void;

type Handler<P> = (payload: P) => void;
type WildcardHandler<Events> = <K extends keyof Events>(type: K, payload: Events[K]) => void;
type ErrorReporter = (error: unknown, eventType: PropertyKey) => void;

/**
 * Domain event bus, typed over a name → payload map.
 *
 * A handler that throws does not interrupt the remaining subscribers: the
 * game loop publishes events every tick and cannot depend on every
 * subscriber being well behaved.
 */
export class EventBus<Events extends Record<keyof Events, unknown>> {
  private readonly handlers = new Map<keyof Events, Set<Handler<unknown>>>();
  private readonly wildcardHandlers = new Set<WildcardHandler<Events>>();

  constructor(
    private readonly reportError: ErrorReporter = (error, eventType) => {
      console.error(`Error in a handler for event "${String(eventType)}"`, error);
    },
  ) {}

  subscribe<K extends keyof Events>(type: K, handler: Handler<Events[K]>): Unsubscribe {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as Handler<unknown>);
    return () => {
      set.delete(handler as Handler<unknown>);
    };
  }

  /** Subscribes to every event; the handler also receives the type. */
  subscribeAll(handler: WildcardHandler<Events>): Unsubscribe {
    this.wildcardHandlers.add(handler);
    return () => {
      this.wildcardHandlers.delete(handler);
    };
  }

  /** Like subscribe, but the handler runs only once. */
  once<K extends keyof Events>(type: K, handler: Handler<Events[K]>): Unsubscribe {
    const unsubscribe = this.subscribe(type, (payload) => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }

  publish<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.handlers.get(type);
    if (set) {
      // Copy: a handler may (un)subscribe during publication.
      for (const handler of [...set]) {
        try {
          handler(payload);
        } catch (error) {
          this.reportError(error, type);
        }
      }
    }
    for (const handler of [...this.wildcardHandlers]) {
      try {
        handler(type, payload);
      } catch (error) {
        this.reportError(error, type);
      }
    }
  }

  /** Removes every subscription (game-mode change, test teardown...). */
  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }
}
