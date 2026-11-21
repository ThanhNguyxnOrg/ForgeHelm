const UNDO_WINDOW_MS = 30_000;
const pendingDeletes = new Map();

export function scheduleSoftDelete(key, executeFn, undoFn) {
  cancelSoftDelete(key);

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timer = setTimeout(async () => {
      pendingDeletes.delete(key);
      try {
        await executeFn();
        resolve(true);
      } catch (err) {
        reject(err);
      }
    }, UNDO_WINDOW_MS);

    pendingDeletes.set(key, { timer, startTime, undoFn, resolve });
  });
}

export function cancelSoftDelete(key) {
  const pending = pendingDeletes.get(key);
  if (!pending) return false;

  clearTimeout(pending.timer);
  pendingDeletes.delete(key);
  if (pending.undoFn) pending.undoFn();
  pending.resolve(false);
  return true;
}

export function cancelAllPending() {
  for (const key of pendingDeletes.keys()) cancelSoftDelete(key);
}

export function getPendingCount() {
  return pendingDeletes.size;
}

export function isPending(key) {
  return pendingDeletes.has(key);
}

export function getRemainingMs(key) {
  const pending = pendingDeletes.get(key);
  if (!pending) return 0;
  const elapsed = Date.now() - pending.startTime;
  return Math.max(0, UNDO_WINDOW_MS - elapsed);
}

export { UNDO_WINDOW_MS };
