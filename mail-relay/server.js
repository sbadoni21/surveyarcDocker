import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { router } from "./src/routes.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_, res) => res.json({ ok: true }));
app.use("/", router);

const port = Number(process.env.PORT || 4001);
app.listen(port, () => console.log(`Mail relay listening on :${port}`));
