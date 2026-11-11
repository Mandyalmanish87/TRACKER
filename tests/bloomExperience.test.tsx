import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BodyMap } from '../src/components/bloom/widgets/BodyMap';
import { Breathing } from '../src/components/bloom/widgets/Breathing';

describe('Bloom comfort interactions', () => {
  it('lets a user select a body region from the illustration and its labeled control', () => {
    const onSelectZone = vi.fn();
    render(<BodyMap selected={[]} onSelectZone={onSelectZone} />);

    const headControls = screen.getAllByRole('button', { name: 'Head' });
    expect(headControls).toHaveLength(2);
    fireEvent.click(headControls[0]);
    fireEvent.click(headControls[1]);

    expect(onSelectZone).toHaveBeenNthCalledWith(1, 'Head');
    expect(onSelectZone).toHaveBeenNthCalledWith(2, 'Head');
  });

  it('starts and pauses the optional breathing pace', () => {
    render(<Breathing />);

    fireEvent.click(screen.getByRole('button', { name: 'Begin breathing' }));
    expect(screen.getAllByText('Breathe in')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Pause exercise' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Pause exercise' }));
    expect(screen.getByText('Breathing exercise paused.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Begin breathing' })).toHaveAttribute('aria-pressed', 'false');
  });
});
