import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sensorEventsTable, assignmentsTable, usersTable, medicinesTable } from "@workspace/db/schema";
import { eq, and, gte, desc, inArray } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ESP32 posts events — no auth required for device
router.post("/", async (req, res) => {
  const { deviceId, patientId, eventType, sensor, metadata } = req.body;

  if (!deviceId || !patientId || !eventType) {
    res.status(400).json({ error: "Validation error", message: "deviceId, patientId, and eventType are required" });
    return;
  }

  const [event] = await db.insert(sensorEventsTable).values({
    deviceId,
    patientId,
    eventType,
    sensor,
    metadata,
    timestamp: new Date(),
  }).returning();

  // Send push notifications to caretakers
  await notifyCaretakers(patientId, eventType, event.id);

  res.status(201).json(event);
});

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const { patientId, limit = "20" } = req.query;
  const role = req.userRole;
  const userId = req.userId!;
  const queryLimit = Math.min(parseInt(limit as string) || 20, 100);

  let patientIds: number[] = [];

  if (role === "admin") {
    if (patientId) {
      patientIds = [parseInt(patientId as string)];
    } else {
      const events = await db.select().from(sensorEventsTable).orderBy(desc(sensorEventsTable.timestamp)).limit(queryLimit);
      res.json(events);
      return;
    }
  } else if (role === "caretaker") {
    const assignments = await db.select().from(assignmentsTable).where(eq(assignmentsTable.caretakerId, userId));
    patientIds = assignments.map(a => a.patientId);
    if (patientId) patientIds = patientIds.filter(id => id === parseInt(patientId as string));
  } else {
    patientIds = [userId];
  }

  if (patientIds.length === 0) {
    res.json([]);
    return;
  }

  const events = await db.select()
    .from(sensorEventsTable)
    .where(inArray(sensorEventsTable.patientId, patientIds))
    .orderBy(desc(sensorEventsTable.timestamp))
    .limit(queryLimit);

  res.json(events);
});

async function notifyCaretakers(patientId: number, eventType: string, eventId: number) {
  try {
    const [patient] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, patientId));
    const assignments = await db.select({
      caretaker: {
        id: usersTable.id,
        fcmToken: usersTable.fcmToken,
        name: usersTable.name,
      }
    })
    .from(assignmentsTable)
    .leftJoin(usersTable, eq(assignmentsTable.caretakerId, usersTable.id))
    .where(eq(assignmentsTable.patientId, patientId));

    const tokens = assignments.map(a => a.caretaker?.fcmToken).filter(Boolean) as string[];

    if (tokens.length === 0) return;

    const eventMessages: Record<string, string> = {
      motion_detected: `Motion detected near ${patient?.name ?? "patient"}'s medicine box`,
      box_opened: `${patient?.name ?? "Patient"} opened the medicine box`,
      box_closed: `${patient?.name ?? "Patient"} closed the medicine box`,
      alarm_triggered: `Medication alarm triggered for ${patient?.name ?? "patient"}`,
      alarm_acknowledged: `${patient?.name ?? "Patient"} acknowledged the medicine alarm`,
    };

    const message = eventMessages[eventType] || `New sensor event from ${patient?.name ?? "patient"}`;
    logger.info({ patientId, eventType, tokenCount: tokens.length }, "Sending FCM notifications");

    // FCM sending via Firebase Admin SDK (if configured)
    // In production, use firebase-admin to send multicast messages
    // For now we log — the mobile app polls in real-time via React Query
  } catch (err) {
    logger.error({ err }, "Failed to send notifications");
  }
}

export default router;
