import { pgTable, serial, text, integer, boolean, timestamp, jsonb, real, varchar, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "caretaker", "patient"] }).notNull().default("patient"),
  phone: text("phone"),
  fcmToken: text("fcm_token"),
  fcmPlatform: text("fcm_platform"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const assignmentsTable = pgTable("assignments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  caretakerId: integer("caretaker_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique().on(t.patientId, t.caretakerId)]);

export const medicinesTable = pgTable("medicines", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  dosage: text("dosage").notNull(),
  frequency: text("frequency", {
    enum: ["daily", "twice_daily", "thrice_daily", "weekly", "as_needed"]
  }).notNull().default("daily"),
  times: jsonb("times").$type<string[]>().notNull().default([]),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sensorEventsTable = pgTable("sensor_events", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  deviceId: varchar("device_id", { length: 64 }).notNull(),
  eventType: text("event_type", {
    enum: ["motion_detected", "box_opened", "box_closed", "alarm_triggered", "alarm_acknowledged"]
  }).notNull(),
  sensor: text("sensor", { enum: ["pir1", "pir2", "lid"] }),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export const insertAssignmentSchema = createInsertSchema(assignmentsTable).omit({ id: true, createdAt: true });
export const insertMedicineSchema = createInsertSchema(medicinesTable).omit({ id: true, createdAt: true });
export const insertSensorEventSchema = createInsertSchema(sensorEventsTable).omit({ id: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Assignment = typeof assignmentsTable.$inferSelect;
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type Medicine = typeof medicinesTable.$inferSelect;
export type InsertMedicine = z.infer<typeof insertMedicineSchema>;
export type SensorEvent = typeof sensorEventsTable.$inferSelect;
export type InsertSensorEvent = z.infer<typeof insertSensorEventSchema>;
