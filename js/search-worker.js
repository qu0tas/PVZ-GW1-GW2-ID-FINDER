/**
 * Search worker. Keeps the brute-force off the main thread so the UI never
 * freezes and "Stop" is always responsive (cancellation = worker.terminate()).
 */

import { search } from './search-core.js';

self.onmessage = (event) => {
  const { cmd, payload } = event.data || {};
  if (cmd !== 'search') return;

  const started = performance.now();
  let lastPost = 0;

  try {
    const iterator = search(payload);
    let step = iterator.next();
    while (!step.done) {
      const now = performance.now();
      // Throttle progress messages to ~20/s; posting per block floods the bus.
      if (now - lastPost > 50) {
        lastPost = now;
        self.postMessage(step.value);
      }
      step = iterator.next();
    }
    self.postMessage({ type: 'done', ...step.value, ms: performance.now() - started });
  } catch (error) {
    self.postMessage({ type: 'error', message: String(error && error.message || error) });
  }
};
