import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/plan";
  return (
    <main className="narrow">
      <h1>Plan Review</h1>
      <p>
        A local demo with two people and two teams. Sign in as one of them. Each has a role per
        team: an approver can lock and reopen the plan; a planner can edit and submit it.
      </p>
      <LoginForm next={safeNext} />
    </main>
  );
}
