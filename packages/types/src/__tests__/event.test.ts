import { describe, expect, it } from 'vitest';
import type {
  DebugClientToServerEvents,
  DebugServerToClientEvents,
} from '../event';

describe('DebugServerToClientEvents', () => {
  it('should support debug:log event', () => {
    const eventHandler: DebugServerToClientEvents['debug:log'] = (
      message,
      data
    ) => {
      expect(message).toBe('Test message');
      expect(data).toBeUndefined();
    };

    eventHandler('Test message');
  });

  it('should support debug:log event with data', () => {
    const eventHandler: DebugServerToClientEvents['debug:log'] = (
      message,
      data
    ) => {
      expect(message).toBe('Test message');
      expect(data).toEqual({ key: 'value' });
    };

    eventHandler('Test message', { key: 'value' });
  });

  it('should support debug:error event', () => {
    const eventHandler: DebugServerToClientEvents['debug:error'] = (
      error,
      data
    ) => {
      expect(error).toBe('Test error');
      expect(data).toBeUndefined();
    };

    eventHandler('Test error');
  });

  it('should support debug:error event with data', () => {
    const eventHandler: DebugServerToClientEvents['debug:error'] = (
      error,
      data
    ) => {
      expect(error).toBe('Test error');
      expect(data).toEqual({ context: 'test' });
    };

    eventHandler('Test error', { context: 'test' });
  });

  it('should support debug:state event', () => {
    const eventHandler: DebugServerToClientEvents['debug:state'] = (state) => {
      expect(state).toEqual({ status: 'active', count: 5 });
    };

    eventHandler({ status: 'active', count: 5 });
  });

  it('should support debug:players event', () => {
    const eventHandler: DebugServerToClientEvents['debug:players'] = (
      players
    ) => {
      expect(players).toHaveLength(2);
      expect(players[0]).toEqual({ name: 'Alice' });
      expect(players[1]).toEqual({ name: 'Bob' });
    };

    eventHandler([{ name: 'Alice' }, { name: 'Bob' }]);
  });

  it('should support debug:game-state event', () => {
    const eventHandler: DebugServerToClientEvents['debug:game-state'] = (
      gameState
    ) => {
      expect(gameState).toEqual({ phase: 'night', round: 1 });
    };

    eventHandler({ phase: 'night', round: 1 });
  });
});

describe('DebugClientToServerEvents', () => {
  it('should support debug:get-state event', () => {
    const eventHandler: DebugClientToServerEvents['debug:get-state'] = () => {
      expect(true).toBe(true);
    };

    eventHandler();
  });

  it('should support debug:get-players event', () => {
    const eventHandler: DebugClientToServerEvents['debug:get-players'] = () => {
      expect(true).toBe(true);
    };

    eventHandler();
  });

  it('should support debug:get-game-state event', () => {
    const eventHandler: DebugClientToServerEvents['debug:get-game-state'] =
      () => {
        expect(true).toBe(true);
      };

    eventHandler();
  });

  it('should support debug:trigger-event event without data', () => {
    const eventHandler: DebugClientToServerEvents['debug:trigger-event'] = (
      eventName,
      data
    ) => {
      expect(eventName).toBe('test-event');
      expect(data).toBeUndefined();
    };

    eventHandler('test-event');
  });

  it('should support debug:trigger-event event with data', () => {
    const eventHandler: DebugClientToServerEvents['debug:trigger-event'] = (
      eventName,
      data
    ) => {
      expect(eventName).toBe('test-event');
      expect(data).toEqual({ value: 42 });
    };

    eventHandler('test-event', { value: 42 });
  });

  it('should support debug:reset-game event', () => {
    const eventHandler: DebugClientToServerEvents['debug:reset-game'] = () => {
      expect(true).toBe(true);
    };

    eventHandler();
  });
});
