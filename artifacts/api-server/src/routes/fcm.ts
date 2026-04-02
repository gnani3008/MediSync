import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();

router.post("/fcm-token", requireAuth, async (req: AuthRequest, res) => {
  const { token, platform } = req.body;
  if (!token) {
    res.status(400).json({ error: "Validation error", message: "token is required" });
    return;
  }

  await db.update(usersTable)
    .set({ fcmToken: token, fcmPlatform: platform })
    .where(eq(usersTable.id, req.userId!));

  res.json({ success: true, message: "FCM token saved" });
});

export default router;
