import React from 'react';
import { WorkoutSession } from '../../types';
import { Interactive3DAnatomy } from './Interactive3DAnatomy';

interface MuscleHeatmapProps {
  sessions?: WorkoutSession[];
  bodyModelPreference?: 'male' | 'female';
  onSelectExercise?: (exerciseId: string) => void;
}

export const MuscleHeatmap: React.FC<MuscleHeatmapProps> = ({
  sessions = [],
  bodyModelPreference = 'male',
  onSelectExercise,
}) => {
  return (
    <Interactive3DAnatomy
      sessions={sessions}
      bodyModelPreference={bodyModelPreference}
      onSelectExercise={onSelectExercise}
    />
  );
};
