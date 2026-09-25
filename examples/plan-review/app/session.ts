// The signed-in person for a server component, from the session cookie.
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "../lib/axe";
import { store } from "../lib/store";
import type { Session } from "../lib/store";

export async function currentSession(): Promise<Session | undefined> {
  const jar = await cookies();
  return store.session(jar.get(SESSION_COOKIE)?.value);
}
