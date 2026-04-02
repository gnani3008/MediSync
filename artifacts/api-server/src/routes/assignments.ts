import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { assignmentsTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { alias } from "drizzle-orm/pg-core";

const router: IRouter = Router();

router.get("/", requireAuth, requireRole("admin"), async (_req, res) => {
  const patient = alias(usersTable, "patient");
  const caretaker = alias(usersTable, "caretaker");

  const assignments = await db.select({
    id: assignmentsTable.id,
    patientId: assignmentsTable.patientId,
    caretakerId: assignmentsTable.caretakerId,
    createdAt: assignmentsTable.createdAt,
    patient: {
      id: patient.id,
      name: patient.name,
      email: patient.email,
      role: patient.role,
      phone: patient.phone,
      createdAt: patient.createdAt,
    },
    caretaker: {
      id: caretaker.id,
      name: caretaker.name,
      email: caretaker.email,
      role: caretaker.role,
      phone: caretaker.phone,
      createdAt: caretaker.createdAt,
    },
  })
  .from(assignmentsTable)
  .leftJoin(patient, eq(assignmentsTable.patientId, patient.id))
  .leftJoin(caretaker, eq(assignmentsTable.caretakerId, caretaker.id));

  res.json(assignments);
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const { patientId, caretakerId } = req.body;
  if (!patientId || !caretakerId) {
    res.status(400).json({ error: "Bad request", message: "patientId and caretakerId required" });
    return;
  }

  const patient = alias(usersTable, "patient");
  const caretaker = alias(usersTable, "caretaker");

  const [assignment] = await db.insert(assignmentsTable)
    .values({ patientId, caretakerId })
    .returning();

  const [full] = await db.select({
    id: assignmentsTable.id,
    patientId: assignmentsTable.patientId,
    caretakerId: assignmentsTable.caretakerId,
    createdAt: assignmentsTable.createdAt,
    patient: {
      id: patient.id,
      name: patient.name,
      email: patient.email,
      role: patient.role,
      phone: patient.phone,
      createdAt: patient.createdAt,
    },
    caretaker: {
      id: caretaker.id,
      name: caretaker.name,
      email: caretaker.email,
      role: caretaker.role,
      phone: caretaker.phone,
      createdAt: caretaker.createdAt,
    },
  })
  .from(assignmentsTable)
  .leftJoin(patient, eq(assignmentsTable.patientId, patient.id))
  .leftJoin(caretaker, eq(assignmentsTable.caretakerId, caretaker.id))
  .where(eq(assignmentsTable.id, assignment.id));

  res.status(201).json(full);
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(assignmentsTable).where(eq(assignmentsTable.id, id));
  res.json({ success: true, message: "Assignment removed" });
});

export default router;
