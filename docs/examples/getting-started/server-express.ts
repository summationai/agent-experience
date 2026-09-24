// #region all
import express from "express";
import { axeExpress } from "@axe/express";
import { axe } from "./axe";

const app = express();
app.use(express.json());

// Serves /.well-known/axe.json and every /axe/* endpoint. Everything else falls through.
app.use(axeExpress(axe));

app.get("/", (_req, res) => {
  res.send("Sunrise Yoga Studio");
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
// #endregion all
