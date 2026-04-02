import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import assignmentsRouter from "./assignments.js";
import medicinesRouter from "./medicines.js";
import eventsRouter from "./events.js";
import patientsRouter from "./patients.js";
import fcmRouter from "./fcm.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/assignments", assignmentsRouter);
router.use("/medicines", medicinesRouter);
router.use("/events", eventsRouter);
router.use(patientsRouter);
router.use(fcmRouter);

export default router;
