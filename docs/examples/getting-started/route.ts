// app/axe/[...axe]/route.ts — and the same three exports from app/.well-known/axe.json/route.ts
// #region all
import { axeNext } from "@summationai/axe-next";
import { axe } from "./axe";

export const { GET, POST, OPTIONS } = axeNext(axe);
// #endregion all
