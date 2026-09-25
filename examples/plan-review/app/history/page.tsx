// A second page. Navigating here unmounts the plan board, so every browser-local control it
// registered leaves the page's surface; the server's plan and its revision are untouched.
import Link from "next/link";
import { redirect } from "next/navigation";
import { store } from "../../lib/store";
import { currentSession } from "../session";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const session = await currentSession();
  if (!session) redirect("/login?next=/history");
  const entries = store.audit(session.tenant).reverse();
  const plan = store.plan(session.tenant)!;
  return (
    <main>
      <nav>
        <Link href="/plan">Back to the plan</Link>
      </nav>
      <h1>History of {plan.name}</h1>
      <p data-testid="history-rev">Plan revision {plan.rev}</p>
      <ol className="history">
        {entries.map((e) => (
          <li key={e.seq}>
            <strong>{e.actor}</strong> {e.summary}
            {e.revAfter !== null ? ` (revision ${e.revBefore} → ${e.revAfter})` : ""}
            <span className="muted"> {new Date(e.at).toLocaleTimeString()}</span>
          </li>
        ))}
      </ol>
    </main>
  );
}
