import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { assignmentsTable, usersTable, medicinesTable, sensorEventsTable } from "@workspace/db/schema";
import { eq, and, gte, desc, count, inArray } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/caretaker/patients", requireAuth, requireRole("caretaker", "admin"), async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const role = req.userRole!;

  const assignmentQuery = await db.select({
    patientId: assignmentsTable.patientId,
  }).from(assignmentsTable).where(eq(assignmentsTable.caretakerId, role === "admin" ? -1 : userId));

  const patientIds = assignmentQuery.map(a => a.patientId);

  if (role !== "admin" && patientIds.length === 0) {
    res.json([]);
    return;
  }

  const patients = role === "admin"
    ? await db.select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        phone: usersTable.phone,
      }).from(usersTable).where(eq(usersTable.role, "patient"))
    : await db.select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        phone: usersTable.phone,
      }).from(usersTable).where(inArray(usersTable.id, patientIds));

  const result = await Promise.all(patients.map(async (patient) => {
    const medicines = await db.select().from(medicinesTable).where(eq(medicinesTable.patientId, patient.id));
    const [lastEvent] = await db.select().from(sensorEventsTable)
      .where(eq(sensorEventsTable.patientId, patient.id))
      .orderBy(desc(sensorEventsTable.timestamp))
      .limit(1);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentEvents = await db.select().from(sensorEventsTable)
      .where(and(
        eq(sensorEventsTable.patientId, patient.id),
        gte(sensorEventsTable.timestamp, weekAgo)
      ));

    const boxOpenEvents = recentEvents.filter(e => e.eventType === "box_opened").length;
    const totalExpected = medicines.filter(m => m.isActive).reduce((sum, m) => sum + m.times.length * 7, 0);
    const adherenceRate = totalExpected > 0 ? Math.min(100, (boxOpenEvents / totalExpected) * 100) : 0;

    return {
      ...patient,
      medicines,
      lastEvent: lastEvent || null,
      adherenceRate: Math.round(adherenceRate),
    };
  }));

  res.json(result);
});

router.get("/dashboard/summary", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const role = req.userRole!;

  let patientIds: number[] = [];

  if (role === "admin") {
    const patients = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "patient"));
    patientIds = patients.map(p => p.id);
  } else if (role === "caretaker") {
    const assignments = await db.select().from(assignmentsTable).where(eq(assignmentsTable.caretakerId, userId));
    patientIds = assignments.map(a => a.patientId);
  } else {
    patientIds = [userId];
  }

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const activeMeds = patientIds.length > 0
    ? await db.select().from(medicinesTable).where(and(
        inArray(medicinesTable.patientId, patientIds),
        eq(medicinesTable.isActive, true)
      ))
    : [];

  const todayEventsResult = patientIds.length > 0
    ? await db.select().from(sensorEventsTable).where(and(
        inArray(sensorEventsTable.patientId, patientIds),
        gte(sensorEventsTable.timestamp, dayStart)
      ))
    : [];

  const recentEvents = patientIds.length > 0
    ? await db.select().from(sensorEventsTable)
        .where(inArray(sensorEventsTable.patientId, patientIds))
        .orderBy(desc(sensorEventsTable.timestamp))
        .limit(10)
    : [];

  const boxOpenEvents = todayEventsResult.filter(e => e.eventType === "box_opened").length;
  const totalExpectedToday = activeMeds.reduce((sum, m) => sum + m.times.length, 0);
  const adherenceRate = totalExpectedToday > 0 ? Math.min(100, (boxOpenEvents / totalExpectedToday) * 100) : 0;

  res.json({
    totalPatients: patientIds.length,
    activeMedicines: activeMeds.length,
    todayEvents: todayEventsResult.length,
    adherenceRate: Math.round(adherenceRate),
    recentEvents,
  });
});

router.get("/patients/:patientId/adherence", requireAuth, async (req: AuthRequest, res) => {
  const patientId = parseInt(req.params.patientId);
  const [patient] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, patientId));

  const medicines = await db.select().from(medicinesTable).where(eq(medicinesTable.patientId, patientId));

  const weeklyData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const events = await db.select().from(sensorEventsTable).where(and(
      eq(sensorEventsTable.patientId, patientId),
      eq(sensorEventsTable.eventType, "box_opened"),
      gte(sensorEventsTable.timestamp, date)
    ));

    const taken = events.filter(e => e.timestamp < nextDate).length;
    const total = medicines.filter(m => m.isActive).reduce((sum, m) => sum + m.times.length, 0);

    weeklyData.push({
      date: date.toISOString().split("T")[0],
      taken: Math.min(taken, total),
      total,
    });
  }

  const totalDoses = weeklyData.reduce((s, d) => s + d.total, 0);
  const takenDoses = weeklyData.reduce((s, d) => s + d.taken, 0);
  const adherenceRate = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;

  res.json({
    patientId,
    patientName: patient?.name ?? "Unknown",
    totalDoses,
    takenDoses,
    adherenceRate,
    weeklyData,
  });
});

export default router;
