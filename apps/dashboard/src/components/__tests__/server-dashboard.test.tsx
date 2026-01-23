import { describe, expect, it } from 'vitest';
import { ServerDashboard } from '../server-dashboard';

describe('ServerDashboard', () => {
  it('exports a component', () => {
    expect(ServerDashboard).toBeDefined();
  });

  it('is a function component', () => {
    expect(typeof ServerDashboard).toBe('function');
  });

  it('has a name', () => {
    expect(ServerDashboard.name).toBe('ServerDashboard');
  });
});
