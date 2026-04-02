import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { medicinesTable, assignmentsTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const { patientId } = req.query;
  const role = req.userRole;
  const userId = req.userId!;

  let patientIds: number[] = [];

  if (role === "admin") {
    if (patientId) {
      patientIds = [parseInt(patientId as string)];
    } else {
      const all = await db.select().from(medicinesTable);
      res.json(all);
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

  const medicines = await db.select().from(medicinesTable).where(inArray(medicinesTable.patientId, patientIds));
  res.json(medicines);
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { patientId, name, dosage, frequency, times, notes, isActive } = req.body;

  if (!patientId || !name || !dosage || !frequency || !times) {
    res.status(400).json({ error: "Validation error", message: "Required fields missing" });
    return;
  }

  const [medicine] = await db.insert(medicinesTable).values({
    patientId,
    name,
    dosage,
    frequency,
    times,
    notes,
    isActive: isActive !== false,
  }).returning();

  res.status(201).json(medicine);
});

router.put("/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { name, dosage, frequency, times, notes, isActive } = req.body;

  const [medicine] = await db.update(medicinesTable).set({
    ...(name && { name }),
    ...(dosage && { dosage }),
    ...(frequency && { frequency }),
    ...(times && { times }),
    ...(notes !== undefined && { notes }),
    ...(isActive !== undefined && { isActive }),
  }).where(eq(medicinesTable.id, id)).returning();

  if (!medicine) {
    res.status(404).json({ error: "Not found", message: "Medicine not found" });
    return;
  }
  res.json(medicine);
});

router.delete("/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(medicinesTable).where(eq(medicinesTable.id, id));
  res.json({ success: true, message: "Medicine deleted" });
});

export default router;
