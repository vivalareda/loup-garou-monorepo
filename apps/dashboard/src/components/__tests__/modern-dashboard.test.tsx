import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ModernDashboard } from '../modern-dashboard';

describe('ModernDashboard', () => {
  it('exports a component', () => {
    expect(ModernDashboard).toBeDefined();
  });

  it('is a function component', () => {
    expect(typeof ModernDashboard).toBe('function');
  });

  it('has a name', () => {
    expect(ModernDashboard.name).toBe('ModernDashboard');
  });

  it('renders without crashing', () => {
    const mockAddPlayer = () => {
      /* no op */
    };
    const mockBatchAddPlayers = () => {
      /* no op */
    };
    const mockSetDarkMode = () => {
      /* no op */
    };
    expect(() => {
      render(
        <BrowserRouter>
          <ModernDashboard
            isDarkMode={true}
            mockSegment={undefined}
            onAddPlayer={mockAddPlayer}
            onBatchAddPlayers={mockBatchAddPlayers}
            onModernSegmentClick={() => {}}
            setIsDarkMode={mockSetDarkMode}
          />
        </BrowserRouter>
      );
    }).not.toThrow();
  });
});
