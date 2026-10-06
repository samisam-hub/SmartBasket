import type { LocalStorage } from './preference-store';
import { rowChecked, type ShoppingRow } from './basket/shopping-list';

export const shoppingListKey = (owner: string | null, basketId: string) =>
  `smartbasket.shopping-list.v1:${JSON.stringify([owner, basketId])}`;

/** Checks are local to an account and basket. Changing a package or quantity reopens that row. */
export class ShoppingListStore {
  private state = { ready: false, blocked: false, error: null as string | null, checked: {} as Record<string, string> };
  private listeners = new Set<() => void>();
  private initialization: Promise<void> | null = null;
  private writes: Promise<void> = Promise.resolve();
  private revision = 0;
  constructor(private storage: LocalStorage, private key: string) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<typeof this.state>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }
  initialize = () => { this.initialization ??= this.load(); return this.initialization; };
  private async load() {
    try {
      const raw = await this.storage.getItem(this.key);
      if (raw) {
        const value = JSON.parse(raw);
        if (value?.version !== 1 || !value.checked || typeof value.checked !== 'object' || Array.isArray(value.checked) ||
            !Object.values(value.checked).every(signature => typeof signature === 'string')) throw Error('Invalid checklist');
        this.publish({ checked: value.checked });
      }
    } catch {
      this.publish({ blocked: true, error: 'Saved checkmarks could not be read. They have not been overwritten. Reopen the list to retry.' });
    }
    this.publish({ ready: true });
  }
  private save(checked: Record<string, string>) {
    this.publish({ checked });
    const revision = ++this.revision;
    const json = JSON.stringify({ version: 1, checked });
    this.writes = this.writes.catch(() => {}).then(() => this.storage.setItem(this.key, json));
    void this.writes.then(() => {
      if (revision === this.revision) this.publish({ error: null });
    }).catch(() => {
      if (revision === this.revision) this.publish({ error: 'Checkmarks could not be saved on this device. Retry before closing.' });
    });
  }
  toggle = (row: ShoppingRow) => {
    if (!this.state.ready || this.state.blocked) return;
    const checked = { ...this.state.checked };
    if (rowChecked(row, checked)) delete checked[row.id]; else checked[row.id] = row.signature;
    this.save(checked);
  };
  reconcile = (rows: ShoppingRow[]) => {
    if (!this.state.ready || this.state.blocked) return;
    const checked = Object.fromEntries(rows.filter(row => rowChecked(row, this.state.checked)).map(row => [row.id, row.signature]));
    if (Object.keys(checked).length !== Object.keys(this.state.checked).length) this.save(checked);
  };
  retry = () => { if (this.state.ready && !this.state.blocked) this.save(this.state.checked); };
  flush = async () => { await this.writes; };
}
