import React, { useEffect, useState } from 'react';

const phases = ['Breathe in', 'Pause softly', 'Breathe out', 'Rest'];

export const Breathing: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setPhase((current) => (current + 1) % phases.length), 4000);
    return () => window.clearInterval(timer);
  }, [running]);

  return (
    <section className="bloom-breathing" aria-label="Optional paced breathing exercise">
      <div className={`breathing-circle${running ? ` phase-${phase}` : ''}`} aria-hidden="true">
        <span>{running ? phases[phase] : 'Breathe'}</span>
      </div>
      <p className="bloom-breathing-caption">Four gentle steps · about 4 seconds each</p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {running ? phases[phase] : 'Breathing exercise paused.'}
      </p>
      <button
        type="button"
        className="bloom-breathing-control"
        aria-pressed={running}
        onClick={() => setRunning((current) => !current)}
      >
        {running ? 'Pause exercise' : 'Begin breathing'}
      </button>
      <small>Follow a pace that feels comfortable. Skip any pause or stop whenever you like.</small>
    </section>
  );
};
