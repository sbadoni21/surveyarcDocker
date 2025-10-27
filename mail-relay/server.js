import express from "express";
import { router } from "./src/routes.js";
import 'dotenv/config'

const app = express();
app.use(express.json({ limit: "2mb" }));

// 🔊 request logger
app.use((req, _res, next) => {
  console.log(`[relay] ${req.method} ${req.url}`);
  next();
});

app.get("/health", (_, res) => res.json({ ok: true }));

// mount your routes
app.use("/", router);

// 🔊 404 catcher so you see bad paths
app.use((req, res) => {
  console.log(`[relay] 404 ${req.method} ${req.url}`);
  res.status(404).json({ error: "not found" });
});

const port = Number(process.env.PORT || 4001);
app.listen(port, () => console.log(`Mail relay listening on :${port}`));
