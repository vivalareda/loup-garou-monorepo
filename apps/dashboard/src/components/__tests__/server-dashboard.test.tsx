import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
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

  it('renders without crashing', () => {
    expect(() => {
      render(
        <BrowserRouter>
          <ServerDashboard />
        </BrowserRouter>
      );
    }).not.toThrow();
  });
});
