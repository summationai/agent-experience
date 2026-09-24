// #region all
import { createAXE, action, z } from "@axe/core";

export const axe = createAXE({
  name: "Sunrise Yoga Studio",
  description:
    "Search upcoming yoga classes by date and style, see instructor names and spots left, and (once signed in) book or cancel a spot.",
  baseUrl: process.env.AXE_BASE_URL ?? "http://localhost:3000",
  humanFallbackUrl: "http://localhost:3000",
  auth: { modes: ["none"] },
  policies: { rateLimit: { requestsPerMinute: 60 }, termsUrl: "http://localhost:3000/terms" },
  contact: { email: "hello@sunriseyoga.example" },
  // Signs continuation and resume tokens. Set AXE_SECRET in production (docs/deploying.md).
  secret: process.env.AXE_SECRET ?? "development-only-secret-change-me",
});

// #region schema
const ClassSchema = z.object({
  id: z.string(),
  title: z.string(),
  style: z.enum(["vinyasa", "yin", "hatha"]),
  startsAt: z.string().datetime(),
  instructor: z.string(),
  spotsLeft: z.number().int(),
  url: z.string(),
});
// #endregion schema

// In a real integration this is your database or your existing service layer.
const CLASSES: z.infer<typeof ClassSchema>[] = [
  {
    id: "c_101",
    title: "Morning Vinyasa",
    style: "vinyasa",
    startsAt: "2026-10-01T14:00:00Z",
    instructor: "Priya N.",
    spotsLeft: 6,
    url: "http://localhost:3000/classes/c_101",
  },
  {
    id: "c_102",
    title: "Candlelight Yin",
    style: "yin",
    startsAt: "2026-10-01T03:00:00Z",
    instructor: "Marcus L.",
    spotsLeft: 2,
    url: "http://localhost:3000/classes/c_102",
  },
  {
    id: "c_103",
    title: "Hatha Basics",
    style: "hatha",
    startsAt: "2026-10-02T17:00:00Z",
    instructor: "Priya N.",
    spotsLeft: 10,
    url: "http://localhost:3000/classes/c_103",
  },
];

// #region action
axe.register(
  action("classes.search", {
    title: "Search upcoming classes",
    description:
      "Find upcoming classes by date range and style. Returns up to 50 classes with start time, instructor, and spots left. Does not book anything.",
    readOnly: true,
    risk: "none",
    input: z.object({
      from: z.string().date().describe("Earliest class date, YYYY-MM-DD"),
      to: z.string().date().optional().describe("Latest class date, YYYY-MM-DD"),
      style: z.enum(["vinyasa", "yin", "hatha"]).optional().describe("Yoga style"),
    }),
    output: z.object({ classes: z.array(ClassSchema) }),
    display: {
      kind: "list",
      items: "/classes",
      item: {
        id: "/id",
        title: "/title",
        subtitle: "/instructor",
        url: "/url",
        attributes: [
          { label: "Starts", path: "/startsAt", format: "datetime", compare: "lower-better" },
          { label: "Style", path: "/style", format: "text" },
          { label: "Spots left", path: "/spotsLeft", format: "number", compare: "higher-better" },
        ],
      },
      suggestedComparison: ["Starts", "Spots left"],
      disclaimer:
        "Availability changes quickly. Confirm on the class page before planning around it.",
    },
    examples: [{ input: { from: "2026-10-01" }, output: { classes: CLASSES } }],
    handler: async ({ input }) => ({
      classes: CLASSES.filter(
        (c) =>
          c.startsAt.slice(0, 10) >= input.from &&
          (!input.to || c.startsAt.slice(0, 10) <= input.to) &&
          (!input.style || c.style === input.style),
      ),
    }),
  }),
);
// #endregion action
// #endregion all
