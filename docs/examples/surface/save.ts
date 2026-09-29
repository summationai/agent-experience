// A planning grid disables its cells while a save is in flight. The surface has to say so at the
// same moment, or an agent acts into a frozen UI. `freeze` reports every entry unavailable with the
// reason and moves the revision; `thaw` restores them and moves it again.
// #region freeze
import { surface } from "./board";

export async function save(persist: () => Promise<void>): Promise<void> {
  const thaw = surface.freeze("saving");
  try {
    await persist();
  } finally {
    thaw();
  }
}
// #endregion freeze
