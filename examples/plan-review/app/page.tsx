import { redirect } from "next/navigation";
import { currentSession } from "./session";

export const dynamic = "force-dynamic";

export default async function Home() {
  redirect((await currentSession()) ? "/plan" : "/login");
}
