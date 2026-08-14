import { Hono } from "hono";
import { cors } from "hono/cors";
import { optionalAuth, type AppVariables } from "./lib/auth";
import {
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  uploadBackground,
  uploadLogo,
} from "./routes/templates";
import { generateBatch, generateSingle } from "./routes/certificates";
import { verifyCertificate } from "./routes/verify";

type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};

const app = new Hono<AppEnv>();

app.use("/api/*", cors({
  origin: "*",
  exposeHeaders: [
    "Content-Disposition",
    "X-Certify-Policy",
    "X-Certify-Count",
    "X-Certify-Failed",
    "X-Certify-Elapsed-Ms",
  ],
}));
app.use("/api/*", optionalAuth);

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "the-cert-maker",
    auth: c.get("userId") ? "user" : "anonymous",
    storage_default: "ephemeral",
  }),
);

app.get("/api/templates", listTemplates);
app.get("/api/templates/:id", getTemplate);
app.post("/api/templates", createTemplate);
app.put("/api/templates/:id", updateTemplate);
app.post("/api/templates/upload-bg", uploadBackground);
app.post("/api/templates/upload-logo", uploadLogo);

app.post("/api/certificates/generate-single", generateSingle);
app.post("/api/certificates/batch", generateBatch);

app.get("/api/verify/:cert_id", verifyCertificate);

app.get("/api/assets/*", async (c) => {
  const key = c.req.path.replace(/^\/api\/assets\//, "");
  if (!key || key.includes("..")) {
    return c.json({ error: "Invalid asset key" }, 400);
  }

  const obj = await c.env.BUCKET.get(key);
  if (!obj) return c.json({ error: "Not found" }, 404);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Cache-Control", "public, max-age=3600");

  return new Response(obj.body, { headers });
});

export default app;
