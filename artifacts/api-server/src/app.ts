import express, { type Express } from "express";
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

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
}));
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

export default app;
