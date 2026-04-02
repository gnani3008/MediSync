import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, ne } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/", requireAuth, requireRole("admin"), async (_req, res) => {
  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    phone: usersTable.phone,
    createdAt: usersTable.createdAt,
  }).from(usersTable);
  res.json(users);
});

router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    phone: usersTable.phone,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.id, id));

  if (!user) {
    res.status(404).json({ error: "Not found", message: "User not found" });
    return;
  }
  res.json(user);
});

router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, phone, role } = req.body;
  const [user] = await db.update(usersTable)
    .set({ ...(name && { name }), ...(phone && { phone }), ...(role && { role }) })
    .where(eq(usersTable.id, id))
    .returning({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      phone: usersTable.phone,
      createdAt: usersTable.createdAt,
    });

  if (!user) {
    res.status(404).json({ error: "Not found", message: "User not found" });
    return;
  }
  res.json(user);
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ success: true, message: "User deleted" });
});

export default router;
