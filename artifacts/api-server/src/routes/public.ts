import { Router } from "express";
import { ipLimiter, globalLimiter } from "../middleware/rateLimit";
import { getSampleAudio } from "../lib/audioCache";
import { logger } from "../lib/logger";

const router = Router();

const VALID_PERSONAS = new Set([
  "professional",
  "funny",
  "sarcastic",
  "mom",
  "marites",
  "britney",
]);

const perIpLimiter   = ipLimiter(60 * 1000,      10);   // 10 req/min per IP
const globalCap      = globalLimiter(60 * 60 * 1000, 600); // 600/hr global

function setCors(res: import("express").Response) {
  res.set("Access-Control-Allow-Origin",  "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

router.options("/persona-sample", (_req, res) => {
  setCors(res);
  res.sendStatus(204);
});

/**
 * GET /api/public/persona-sample?persona=<id>
 *
 * Returns the public GCS URL for the pre-generated en-US persona voice sample.
 * No authentication required. No ElevenLabs call — only serves cached audio.
 * If the sample hasn't been pre-generated yet, returns 404.
 */
router.get(
  "/persona-sample",
  perIpLimiter,
  globalCap,
  async (req, res) => {
    setCors(res);

    const persona =
      typeof req.query["persona"] === "string" ? req.query["persona"] : "";

    if (!VALID_PERSONAS.has(persona)) {
      res.status(400).json({ error: "invalid_persona" });
      return;
    }

    try {
      const audio = await getSampleAudio(persona, "en-US");
      if (!audio) {
        res.status(404).json({ error: "not_cached" });
        return;
      }
      res.set("Cache-Control", "public, max-age=3600");
      res.set("Content-Type", "audio/mpeg");
      res.send(Buffer.from(audio.base64, "base64"));
    } catch (err) {
      logger.error({ err }, "public/persona-sample failed");
      res.status(500).json({ error: "failed" });
    }
  },
);

export default router;
