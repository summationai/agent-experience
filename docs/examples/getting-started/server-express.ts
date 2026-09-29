// #region all
import express from "express";
import { axeExpress } from "@summationai/axe-express";
import { axe } from "./axe";

const app = express();

// Serves /.well-known/axe.json and every /axe/* endpoint. Everything else falls through.
// Mounted before any body parser, it reads its own request bodies within maxBodyBytes and
// answers an oversized one with an AXE envelope.
app.use(axeExpress(axe));
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("Sunrise Yoga Studio");
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
// #endregion all
