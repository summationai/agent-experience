import { createAXE, action, z } from "@axe/core";

export const axe = createAXE({
  name: "Sunrise Yoga Studio",
  description: "Search upcoming yoga classes by date and style; signed-in members can book a spot.",
  baseUrl: "https://sunriseyoga.example",
  auth: { modes: ["none"] },
  secret: process.env.AXE_SECRET,
});

axe.register(
  action("classes.search", {
    title: "Search upcoming classes",
    description: "Find classes by date and style. Returns up to 50 classes with start time, instructor, and spots left.",
    readOnly: true,
    risk: "none",
    input: z.object({ from: z.string().date().describe("Earliest date, YYYY-MM-DD") }),
    output: z.object({ classes: z.array(z.object({ id: z.string(), title: z.string(), startsAt: z.string() })) }),
    handler: async ({ input }) => ({ classes: await findClasses(input.from) }),
  }),
);

export const handler = axe.fetchHandler(); // (Request) => Promise<Response>

// #region support
async function findClasses(from: string) {
  return [{ id: "c_101", title: "Morning Vinyasa", startsAt: `${from}T14:00:00Z` }];
}
// #endregion support
