/**
 * A tRPC router read structurally: queries become read actions, mutations need a risk in their meta.
 */
// #region router
import { fromTRPCRouter, generate } from "@summationai/axe-generate";
import type { TRPCRouterLike } from "@summationai/axe-generate";

// Your router, for example `export const appRouter = router({ classes: router({ ... }) })`.
// The adapter needs only `_def.procedures` and `createCaller`, so no tRPC types are imported here.
declare const appRouter: TRPCRouterLike<{ memberId: string | null }>;

export const generated = generate([
  fromTRPCRouter(appRouter, {
    // The tRPC context for a call, built from the AXE handler context.
    createContext: (ctx) => ({ memberId: ctx.context.onBehalfOf ?? null }),
  }),
]);
// #endregion router

// #region meta
// In the router, the procedure's meta carries what AXE needs and tRPC does not ask for:
//
//   book: publicProcedure
//     .meta({
//       description:
//         "Books one spot in a class for the signed-in member. Free cancellation until two hours before.",
//       risk: "medium",
//       reversible: true,
//     })
//     .input(z.object({ classId: z.string() }))
//     .output(z.object({ bookingId: z.string() }))
//     .mutation(({ input, ctx }) => bookClass(input.classId, ctx.memberId)),
// #endregion meta
