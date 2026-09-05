import {
  defaultDraft,
  steps,
  type OnboardingStep,
  type PreferenceDraft,
  type UserPreferences,
} from "../types/preferences";
import { isDraft, isSaved, normalizedValues } from "./preference-domain";

export interface LocalStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export interface RemotePreferences {
  load(): Promise<UserPreferences | null>;
  save(value: UserPreferences): Promise<UserPreferences>;
}
interface Cache {
  version: 1;
  draft: PreferenceDraft;
  saved: UserPreferences | null;
  step: OnboardingStep;
  editing: boolean;
  pendingSync: boolean;
}
export interface PreferenceState extends Cache {
  ready: boolean;
  saving: boolean;
  localError: string | null;
  remoteError: string | null;
  configured: boolean;
}
const fresh = (): Cache => ({
  version: 1,
  draft: { ...defaultDraft, dietaryPreferences: ["none"], allergens: [] },
  saved: null,
  step: "welcome",
  editing: false,
  pendingSync: false,
});
export class PreferenceStore {
  private state: PreferenceState;
  private listeners = new Set<() => void>();
  private writes: Promise<void> = Promise.resolve();
  private initialization: Promise<void> | null = null;
  private storageReadable = true;
  constructor(
    private storage: LocalStorage,
    private key: string,
    private remote: RemotePreferences | null,
  ) {
    this.state = {
      ...fresh(),
      ready: false,
      saving: false,
      localError: null,
      remoteError: null,
      configured: !!remote,
    };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<PreferenceState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private persist(value: Cache = this.state): Promise<void> {
    if (!this.storageReadable)
      return Promise.reject(
        new Error(
          "Local storage could not be read. Restart the app to retry safely.",
        ),
      );
    const { version, draft, saved, step, editing, pendingSync } = value;
    const json = JSON.stringify({
      version,
      draft,
      saved,
      step,
      editing,
      pendingSync,
    });
    const write = this.writes
      .catch(() => {})
      .then(() => this.storage.setItem(this.key, json));
    this.writes = write;
    return write;
  }
  private autosave() {
    void this.persist()
      .then(() => this.publish({ localError: null }))
      .catch(() =>
        this.publish({
          localError:
            "Changes could not be saved on this device. Free some storage and retry before closing.",
        }),
      );
  }
  retryLocal = async () => {
    try {
      await this.persist();
      this.publish({ localError: null });
    } catch {
      this.publish({
        localError: "Local storage is unavailable. Restart the app to retry.",
      });
    }
  };
  flushDraft = async (): Promise<boolean> => {
    try {
      await this.persist();
      this.publish({ localError: null });
      return true;
    } catch {
      this.publish({
        localError: "Progress could not be saved. Please retry before leaving.",
      });
      return false;
    }
  };
  initialize = () => {
    this.initialization ??= this.load();
    return this.initialization;
  };
  private async load() {
    try {
      const raw = await this.storage.getItem(this.key);
      if (raw) {
        const c = JSON.parse(raw) as Cache;
        if (
          c.version !== 1 ||
          !isDraft(c.draft) ||
          (c.saved !== null && !isSaved(c.saved)) ||
          !steps.includes(c.step) ||
          typeof c.editing !== "boolean" ||
          typeof c.pendingSync !== "boolean"
        )
          throw new Error("Invalid local data");
        this.publish({
          draft: c.draft,
          saved: c.saved,
          step: c.step,
          editing: c.editing,
          pendingSync: c.pendingSync,
        });
      }
    } catch {
      this.storageReadable = false;
      this.publish({
        localError:
          "Stored preferences could not be read. They have not been overwritten. Restart the app to retry.",
      });
    }
    this.publish({ ready: true });
    if (!this.remote || !this.storageReadable) return;
    const initialSaved = this.state.saved;
    try {
      const saved = await this.remote.load();
      // Never replace a pending local completion or an in-progress edit with a late response.
      if (
        saved &&
        !this.state.pendingSync &&
        this.state.saved === initialSaved &&
        !this.state.saving
      ) {
        this.publish({
          saved,
          ...(!this.state.editing
            ? { draft: saved, step: "review" as const }
            : {}),
        });
        this.autosave();
      }
    } catch {
      this.publish({
        remoteError:
          "Cloud preferences could not be loaded. Your local progress is available; check your connection and backend setup.",
      });
    }
  }
  update = (patch: Partial<PreferenceDraft>) => {
    if (!this.state.ready || this.state.saving) return;
    this.publish({ draft: { ...this.state.draft, ...patch }, editing: true });
    this.autosave();
  };
  goTo = (step: OnboardingStep) => {
    if (!this.state.ready || this.state.saving) return;
    this.publish({ step, editing: true });
    this.autosave();
  };
  begin = (requested?: OnboardingStep): OnboardingStep => {
    if (!this.state.ready || this.state.saving) return this.state.step;
    const step =
      requested ??
      (this.state.editing
        ? this.state.step
        : this.state.saved
          ? "review"
          : "welcome");
    this.publish({
      step,
      editing: true,
      draft: this.state.editing
        ? this.state.draft
        : (this.state.saved ?? this.state.draft),
    });
    this.autosave();
    return step;
  };
  /** Returns success only after local durability. Remote failure remains explicitly pending. */
  save = async (): Promise<boolean> => {
    if (this.state.saving || !this.state.ready) return false;
    let values;
    try {
      values = normalizedValues(this.state.draft);
    } catch {
      return false;
    }
    this.publish({ saving: true, remoteError: null });
    const now = new Date().toISOString();
    const saved: UserPreferences = {
      ...values,
      id: this.state.saved?.id ?? null,
      userId: this.state.saved?.userId ?? null,
      onboardingCompleted: true,
      createdAt: this.state.saved?.createdAt ?? now,
      updatedAt: now,
    };
    const completion: Cache = {
      ...this.state,
      saved,
      draft: saved,
      pendingSync: true,
      editing: false,
      step: "review",
    };
    try {
      await this.persist(completion);
    } catch {
      this.publish({
        saving: false,
        localError:
          "Preferences could not be saved on this device. Please retry; your answers are still here.",
      });
      return false;
    }
    this.publish({ ...completion, localError: null });
    await this.upload(saved);
    this.publish({ saving: false });
    return true;
  };
  private async upload(saved: UserPreferences) {
    if (!this.remote) return;
    try {
      const uploaded = await this.remote.save(saved);
      // Persist acknowledgement before calling the local copy synced. Repeating upsert is safe.
      const next = { ...this.state, saved: uploaded, pendingSync: false };
      await this.persist(next);
      this.publish({ saved: uploaded, pendingSync: false, remoteError: null });
    } catch {
      this.publish({
        remoteError:
          "Saved on this device only. Cloud sync failed. Check your connection, anonymous sign-in, and database setup, then retry.",
      });
    }
  }
  retryRemote = async () => {
    if (!this.remote || this.state.saving || !this.state.ready) return;
    if (this.state.saved && this.state.pendingSync) {
      this.publish({ saving: true });
      await this.upload(this.state.saved);
      this.publish({ saving: false });
    } else {
      this.publish({ saving: true, remoteError: null });
      try {
        const saved = await this.remote.load();
        if (saved) {
          this.publish({
            saved,
            ...(!this.state.editing
              ? { draft: saved, step: "review" as const }
              : {}),
          });
          await this.persist();
        }
      } catch {
        this.publish({
          remoteError:
            "Cloud preferences could not be loaded. Your local progress is still available.",
        });
      } finally {
        this.publish({ saving: false });
      }
    }
  };
}
