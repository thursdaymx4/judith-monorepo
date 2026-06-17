import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const allowedOrigins = [
  "https://judith.thursday.mx",
  "https://www.judith.thursday.mx",
];

const strictCors = cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
});

// /api/public/* is intentionally open — skip strict CORS entirely for that
// prefix and apply wide-open headers instead.
app.use((req, res, next) => {
  if (req.path.startsWith("/api/public")) {
    res.set("Access-Control-Allow-Origin",  "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.sendStatus(204); return; }
    return next();
  }
  strictCors(req, res, next);
});
// Most endpoints handle small JSON payloads; only the vision-based parse routes
// need room for a screenshot. Path-routed limits cap ingress on every other
// endpoint to a few MB so attackers can't bloat unrelated requests.
const parseJsonStandard = express.json({ limit: "3mb" });
const parseJsonLarge = express.json({ limit: "8mb" });
const PARSE_PATHS = new Set([
  "/api/judith/parse-bill",
  "/api/judith/parse-subscription-screenshot",
]);
app.use((req, res, next) =>
  PARSE_PATHS.has(req.path) ? parseJsonLarge(req, res, next) : parseJsonStandard(req, res, next),
);
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", router);

// Global error handler. The 4-arg signature (err, req, res, next) is what
// makes Express treat this as an error-handling middleware. Without it, an
// unhandled throw or rejected promise inside a route would leave the response
// hanging until the client timed out (or worse, with newer Node versions,
// crash the process via unhandledRejection). Every route handler already
// wraps its body in try/catch, so this is a backstop — but the cost of one
// missed `next(err)` somewhere in the codebase shouldn't be a hung request.
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err, path: req.path, method: req.method }, "unhandled route error");
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: "Server error" });
});

export default app;
