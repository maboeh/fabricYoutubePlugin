// Shared messaging helpers for popup / options pages
import { api } from './browser-api.js';
import { TIMEOUTS } from './constants.js';

/**
 * Send a message to the background service worker with a timeout.
 * Resolves with an error object instead of rejecting, so callers can
 * always branch on success / valid flags.
 *
 * @param {object} message - Payload for runtime.sendMessage
 * @param {number} [timeoutMs=TIMEOUTS.MESSAGE_DEFAULT_MS]
 * @returns {Promise<object>}
 */
export function sendMessageWithTimeout(message, timeoutMs = TIMEOUTS.MESSAGE_DEFAULT_MS) {
  return new Promise((resolve) => {
    const timeoutError = 'Zeitüberschreitung. Bitte Extension neu laden.';
    const unreachableError = 'Hintergrund-Skript nicht erreichbar. Bitte Extension neu laden.';

    const timer = setTimeout(() => {
      resolve({ success: false, valid: false, error: timeoutError });
    }, timeoutMs);

    api.runtime.sendMessage(message, (response) => {
      clearTimeout(timer);
      if (api.runtime.lastError) {
        resolve({ success: false, valid: false, error: unreachableError });
        return;
      }
      resolve(response || { success: false, valid: false, error: 'Keine Antwort vom Background Script' });
    });
  });
}
