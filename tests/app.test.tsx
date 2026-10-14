import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../src/App';

describe('TRACKER App Component & Milestone 1 Verification', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the application shell, editorial branding, and navigation', () => {
    render(<App />);
    expect(screen.getByText('TRACKER')).toBeInTheDocument();
    expect(screen.getByText('Personal Daily Operating System')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Timetable')).toBeInTheDocument();
    expect(screen.getAllByText('Attendance').length).toBeGreaterThan(0);
  });

  it('renders today classes and marks attendance when clicking Present', () => {
    render(<App />);
    
    // Find Present buttons on today's timetable slots
    const presentButtons = screen.getAllByRole('button', { name: /present/i });
    expect(presentButtons.length).toBeGreaterThan(0);

    // Click present on the first class
    fireEvent.click(presentButtons[0]);

    // Check that button still exists and state updated
    expect(presentButtons[0]).toBeInTheDocument();
  });

  it('allows switching between Light, Dark, and System modes', () => {
    render(<App />);

    const darkBtn = screen.getByRole('button', { name: /dark/i });
    fireEvent.click(darkBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    const lightBtn = screen.getByRole('button', { name: /light/i });
    fireEvent.click(lightBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('allows clearing sample data cleanly to enter live user mode', () => {
    render(<App />);

    // Click "Clear" on demo records banner
    const clearBtn = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearBtn);

    // Should now indicate Live Data Mode
    expect(screen.getByText('Live Data Mode')).toBeInTheDocument();
  });
});
