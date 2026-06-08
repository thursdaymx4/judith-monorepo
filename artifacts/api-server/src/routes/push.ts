import { Router, type IRouter } from "express";
import { isExpoPushToken, sendExpoPush } from "../lib/expoPush";
import { bearerToken, getUserFromToken } from "../lib/supabaseAdmin";

const router: IRouter = Router();

router.post("/send", async (req, res) => {
  try {
    const token = bearerToken(req.header("authorization"));
    const user = await getUserFromToken(token);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const title =
      typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const body =
      typeof req.body?.body === "string" ? req.body.body.trim() : "";
    const data =
      req.body?.data && typeof req.body.data === "object" && !Array.isArray(req.body.data)
        ? (req.body.data as Record<string, unknown>)
        : {};

    if (!title || !body) {
      res.status(400).json({ error: "title and body are required" });
      return;
    }

    const metadata = user.user_metadata ?? {};
    const registration =
      metadata["judithPushNotifications"] &&
      typeof metadata["judithPushNotifications"] === "object"
        ? (metadata["judithPushNotifications"] as Record<string, unknown>)
        : null;

    const expoPushToken = registration?.["expoPushToken"];
    if (!isExpoPushToken(expoPushToken)) {
      res.status(400).json({ error: "No valid Expo push token found for user" });
      return;
    }

    const result = await sendExpoPush({
      to: expoPushToken,
      title,
      body,
      data,
      sound: "default",
    });

    res.json({
      ok: true,
      expoPushToken,
      result,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Push send failed",
    });
  }
});

export default router;
