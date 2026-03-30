const UNDO_WINDOW_MS = 30_000;
const pendingDeletes = new Map();

export function scheduleSoftDelete(fullName, executeFn, undoFn) {
  cancelSoftDelete(fullName);

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timer = setTimeout(async () => {
      pendingDeletes.delete(fullName);
      try {
        await executeFn();
        resolve(true);
      } catch (err) {
        reject(err);
      }
    }, UNDO_WINDOW_MS);

    pendingDeletes.set(fullName, { timer, startTime, undoFn, resolve, reject });
  });
}

export function cancelSoftDelete(fullName) {
  const pending = pendingDeletes.get(fullName);
  if (!pending) return false;

  clearTimeout(pending.timer);
  pendingDeletes.delete(fullName);
  if (pending.undoFn) pending.undoFn();
  return true;
}

export function cancelAllPending() {
  for (const [, pending] of pendingDeletes) {
    clearTimeout(pending.timer);
    if (pending.undoFn) pending.undoFn();
  }
  pendingDeletes.clear();
}

export function getPendingCount() {
  return pendingDeletes.size;
}

export function isPending(fullName) {
  return pendingDeletes.has(fullName);
}

export function getRemainingMs(fullName) {
  const pending = pendingDeletes.get(fullName);
  if (!pending) return 0;
  const elapsed = Date.now() - pending.startTime;
  return Math.max(0, UNDO_WINDOW_MS - elapsed);
}

export { UNDO_WINDOW_MS };
