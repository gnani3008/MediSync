# Workspace

## Overview

MediCare Reminder — A full-stack medicine reminder system integrating ESP32 hardware with a mobile patient-caretaker-admin application.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Mobile app**: Expo (React Native) — artifacts/med-reminder
- **Validation**: Zod, drizzle-zod
- **Auth**: bcryptjs + jsonwebtoken (JWT, 30-day expiry)
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)

## Architecture

```
Mobile App (Expo)  ←→  API Server (Express)  ←→  PostgreSQL
                              ↑
                         ESP32 device (HTTP POST)
```

## User Roles

- **Admin**: Manages all users, assigns patients to caretakers
- **Caretaker**: Monitors assigned patients, receives motion/alarm events in real-time
- **Patient**: Views and manages own medicine reminders, sees box activity

## Mobile App Screens

- `/` — Role selection home screen
- `/auth?role=<role>` — Login/Register for each role
- `/admin` — Admin: user management + patient-caretaker assignments
- `/caretaker` — Caretaker: dashboard (stats, adherence), patient list, activity log
- `/patient` — Patient: medicine CRUD, alarm times, box activity feed

## API Endpoints

- `POST /api/auth/login` — Login
- `POST /api/auth/register` — Register
- `GET /api/users` — All users (admin)
- `GET/POST/PUT/DELETE /api/medicines` — Medicine management
- `GET/POST/DELETE /api/assignments` — Patient-caretaker assignments (admin)
- `GET /api/caretaker/patients` — Patients for caretaker
- `POST /api/events` — ESP32 posts sensor events (no auth)
- `GET /api/events` — View events (authenticated)
- `GET /api/dashboard/summary` — Dashboard stats
- `GET /api/patients/:id/adherence` — Weekly adherence data
- `POST /api/fcm-token` — Save push notification token

## Database Tables

- `users` — id, name, email, passwordHash, role, phone, fcmToken
- `assignments` — id, patientId, caretakerId (unique pair)
- `medicines` — id, patientId, name, dosage, frequency, times[], notes, isActive
- `sensor_events` — id, patientId, deviceId, eventType, sensor, metadata, timestamp

## ESP32 Firmware

File: `ESP32_MedicineReminder.ino`

Hardware:
- 2× PIR sensors (GPIO 13, 14)
- 1× Passive buzzer (GPIO 25)
- 1× SSD1306 OLED 128×64 (I2C: GPIO 21/22)

**Why Arduino (not MicroPython)**: Arduino's non-blocking millis()-based loop prevents the 20-second display lag that MicroPython's GIL causes.

## Structure

```
artifacts/
  api-server/     — Express API backend
  med-reminder/   — Expo mobile app
lib/
  api-spec/       — OpenAPI spec + Orval codegen
  api-client-react/ — Generated React Query hooks
  api-zod/        — Generated Zod schemas
  db/             — Drizzle ORM schema + DB connection
ESP32_MedicineReminder.ino — Arduino sketch for ESP32
```

## Running

- API server starts automatically (workflow: artifacts/api-server)
- Mobile app starts automatically (workflow: artifacts/med-reminder)
- DB schema: `pnpm --filter @workspace/db run push`
- API codegen: `pnpm --filter @workspace/api-spec run codegen`
