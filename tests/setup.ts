import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';

beforeEach(() => {
  window.location.hash = '';
});
