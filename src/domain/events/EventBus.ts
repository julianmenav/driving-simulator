export type Unsubscribe = () => void;

type Handler<P> = (payload: P) => void;
type WildcardHandler<Events> = <K extends keyof Events>(type: K, payload: Events[K]) => void;
type ErrorReporter = (error: unknown, eventType: PropertyKey) => void;

/**
 * Bus de eventos de dominio, tipado sobre un mapa nombre → payload.
 *
 * Un handler que lanza una excepción no interrumpe al resto de suscriptores:
 * el game loop publica eventos cada tick y no puede depender de que todos
 * los suscriptores sean correctos.
 */
export class EventBus<Events extends Record<keyof Events, unknown>> {
  private readonly handlers = new Map<keyof Events, Set<Handler<unknown>>>();
  private readonly wildcardHandlers = new Set<WildcardHandler<Events>>();

  constructor(
    private readonly reportError: ErrorReporter = (error, eventType) => {
      console.error(`Error en un handler del evento "${String(eventType)}"`, error);
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

  /** Se suscribe a todos los eventos; recibe también el tipo. */
  subscribeAll(handler: WildcardHandler<Events>): Unsubscribe {
    this.wildcardHandlers.add(handler);
    return () => {
      this.wildcardHandlers.delete(handler);
    };
  }

  /** Como subscribe, pero el handler se ejecuta una sola vez. */
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
      // Copia: un handler puede (des)suscribir durante la publicación.
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

  /** Elimina todas las suscripciones (cambio de modo, teardown de tests…). */
  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }
}
