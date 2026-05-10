/**
 * src/tui/event-bus.ts — Event Bus for TUI Components
 *
 * Provides a typed event system for decoupled communication
 * between TUI components. Components emit events and subscribe
 * without direct references to each other.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** All event types in the TUI */
export type TuiEventType =
  | 'command:submit'
  | 'command:history'
  | 'phase:change'
  | 'budget:update'
  | 'model:change'
  | 'tool:action'
  | 'task:add'
  | 'task:complete'
  | 'test:update'
  | 'safety:update'
  | 'session:health'
  | 'resize';

/** Event payload shapes */
export interface TuiEventMap {
  'command:submit': { command: string; timestamp: number };
  'command:history': { commands: string[] };
  'phase:change': { phase: string; detail: string; status: string };
  'budget:update': { used: number; limit: number; warning: boolean; blocked: boolean };
  'model:change': { model: string; provider: string };
  'tool:action': { tool: string; detail: string; timestamp: number };
  'task:add': { id: string; name: string; status: string };
  'task:complete': { id: string; success: boolean };
  'test:update': { passed: number; failed: number; total: number };
  'safety:update': { score: number; status: string };
  'session:health': { status: string; uptime: number };
  'resize': { width: number; height: number };
}

/** Generic TUI event */
export interface TuiEvent<K extends TuiEventType = TuiEventType> {
  type: K;
  payload: TuiEventMap[K];
}

/** Event handler function */
export type TuiEventHandler<K extends TuiEventType> = (event: TuiEvent<K>) => void;

// ─── EventBus ─────────────────────────────────────────────────────────────────

export class EventBus {
  private listeners: Map<string, Set<TuiEventHandler<any>>> = new Map();

  /** Subscribe to an event type */
  on<K extends TuiEventType>(type: K, handler: TuiEventHandler<K>): () => void {
    const handlers = this.listeners.get(type);
    if (!handlers) {
      this.listeners.set(type, new Set([handler]));
    } else {
      handlers.add(handler);
    }

    // Return unsubscribe function
    return () => {
      const set = this.listeners.get(type);
      if (set) {
        set.delete(handler);
        if (set.size === 0) {
          this.listeners.delete(type);
        }
      }
    };
  }

  /** Subscribe once — auto-unsubscribes after first event */
  once<K extends TuiEventType>(type: K, handler: TuiEventHandler<K>): void {
    const wrapper: TuiEventHandler<K> = (event) => {
      unsubscribe();
      handler(event);
    };
    const unsubscribe = this.on(type, wrapper);
  }

  /** Emit an event to all subscribers */
  emit<K extends TuiEventType>(type: K, payload: TuiEventMap[K]): void {
    const handlers = this.listeners.get(type);
    if (!handlers) return;

    const event: TuiEvent<K> = { type, payload };
    for (const handler of handlers) {
      try {
        handler(event);
      } catch {
        // Swallow handler errors
      }
    }
  }

  /** Remove all listeners for a type */
  clear(type?: TuiEventType): void {
    if (type) {
      this.listeners.delete(type);
    } else {
      this.listeners.clear();
    }
  }

  /** Get the number of subscribers for a type */
  subscriberCount(type: TuiEventType): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/** Global event bus instance */
export const eventBus = new EventBus();
