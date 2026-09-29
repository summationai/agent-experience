/**
 * Sunrise Yoga Studio: server functions that already exist, exposed as actions through a table.
 */
import { createAXE, z } from "@summationai/axe-core";
import { fromFunctions, generate, registerGenerated } from "@summationai/axe-generate";

// The studio's existing service layer.
declare function findClasses(
  from: string,
): Promise<{ id: string; title: string; startsAt: string }[]>;
declare function bookClass(classId: string, memberId: string): Promise<{ bookingId: string }>;

export const axe = createAXE({
  name: "Sunrise Yoga Studio",
  description: "Search upcoming yoga classes by date and style; signed-in members can book a spot.",
  baseUrl: "https://sunriseyoga.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://sunriseyoga.example/login" },
  secret: process.env.AXE_SECRET,
});

// #region table
const Class = z.object({ id: z.string(), title: z.string(), startsAt: z.string() });

const generated = generate([
  fromFunctions({
    "classes.search": {
      title: "Search upcoming classes",
      description:
        "Find classes on or after a date. Returns up to 50 classes with start time, instructor, and spots left.",
      readOnly: true,
      input: z.object({ from: z.string().date().describe("Earliest date, YYYY-MM-DD") }),
      output: z.object({ classes: z.array(Class) }),
      handler: async ({ from }) => ({ classes: await findClasses(from) }),
    },
    "classes.book": {
      description:
        "Books one spot in a class for the signed-in member. Free cancellation until two hours before the class starts.",
      risk: "medium",
      reversible: true,
      auth: "user",
      input: z.object({ classId: z.string().describe("Class id from classes.search") }),
      output: z.object({ bookingId: z.string() }),
      handler: ({ classId }, ctx) => bookClass(classId, ctx.context.onBehalfOf!),
    },
  }),
]);

registerGenerated(axe, generated);
// #endregion table
