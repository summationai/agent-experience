import { redirect } from "next/navigation";
import { pageState } from "../../lib/ui-api";
import { currentSession } from "../session";
import { PlanBoard } from "./PlanBoard";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const session = await currentSession();
  if (!session) redirect("/login?next=/plan");
  return <PlanBoard initial={await pageState(session)} />;
}
