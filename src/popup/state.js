export function createState() {
  let state = {
    token: '',
    user: null,
    allRepos: [],
    selected: new Set(),
    busyRepos: new Set(),
    search: '',
    visibility: 'all',
    type: 'all',
    sort: 'updated',
    loading: false,
    settingsOpen: false,
  };

  const listeners = new Set();

  function notify() {
    for (const fn of listeners) fn(state);
  }

  return {
    get() { return state; },

    set(patch) {
      state = { ...state, ...patch };
      notify();
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    toggleSelect(fullName) {
      const next = new Set(state.selected);
      next.has(fullName) ? next.delete(fullName) : next.add(fullName);
      this.set({ selected: next });
    },

    selectAll(fullNames) {
      this.set({ selected: new Set(fullNames) });
    },

    deselectAll() {
      this.set({ selected: new Set() });
    },

    markBusy(fullName) {
      const next = new Set(state.busyRepos);
      next.add(fullName);
      this.set({ busyRepos: next });
    },

    unmarkBusy(fullName) {
      const next = new Set(state.busyRepos);
      next.delete(fullName);
      this.set({ busyRepos: next });
    },

    removeRepo(fullName) {
      const next = state.allRepos.filter((r) => r.full_name !== fullName);
      const sel = new Set(state.selected);
      sel.delete(fullName);
      const busy = new Set(state.busyRepos);
      busy.delete(fullName);
      this.set({ allRepos: next, selected: sel, busyRepos: busy });
    },

    updateRepo(fullName, patch) {
      const next = state.allRepos.map((r) =>
        r.full_name === fullName ? { ...r, ...patch } : r
      );
      this.set({ allRepos: next });
    },

    getFiltered() {
      const { allRepos, search, visibility, type, sort } = state;
      const q = search.toLowerCase();

      let filtered = allRepos.filter((r) => {
        if (q && !r.name.toLowerCase().includes(q) && !(r.description || '').toLowerCase().includes(q)) {
          return false;
        }
        if (visibility === 'public' && r.private) return false;
        if (visibility === 'private' && !r.private) return false;
        if (type === 'source' && r.fork) return false;
        if (type === 'fork' && !r.fork) return false;
        if (type === 'archived' && !r.archived) return false;
        return true;
      });

      const sortFns = {
        updated: (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
        name: (a, b) => a.name.localeCompare(b.name),
        stars: (a, b) => b.stargazers_count - a.stargazers_count,
        created: (a, b) => new Date(b.created_at) - new Date(a.created_at),
        size: (a, b) => b.size - a.size,
      };

      filtered.sort(sortFns[sort] || sortFns.updated);
      return filtered;
    },
  };
}
