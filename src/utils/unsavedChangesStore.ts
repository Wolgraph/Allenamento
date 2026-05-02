/**
 * Store globale per gestire la presenza di modifiche non salvate.
 * Usato da AggiungiEsercizioScreen per intercettare i tab press nel navigator.
 */

type DiscardHandler = (onProceed: () => void) => void;

let _handler: DiscardHandler | null = null;

export function registerUnsavedChanges(handler: DiscardHandler): void {
  _handler = handler;
}

export function unregisterUnsavedChanges(): void {
  _handler = null;
}

export function hasUnsavedChanges(): boolean {
  return _handler !== null;
}

/** Restituisce true se ha mostrato il prompt, false se non c'erano modifiche. */
export function promptUnsavedChanges(onProceed: () => void): boolean {
  if (_handler) {
    _handler(onProceed);
    return true;
  }
  return false;
}
