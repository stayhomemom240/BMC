import { createInsertSchema } from "drizzle-zod";
import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const leadsTable = pgTable(
  "lead_audit_leads",
  {
    id: serial("id").primaryKey(),
    publicBookingToken: uuid("public_booking_token").notNull().defaultRandom(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    company: text("company"),
    website: text("website"),
    serviceType: text("service_type").notNull(),
    industry: text("industry"),
    goals: text("goals").notNull(),
    challenge: text("challenge").notNull(),
    timeline: text("timeline").notNull(),
    readinessScore: integer("readiness_score").notNull(),
    reportSummary: text("report_summary").notNull(),
    notes: text("notes"),
    stage: text("stage").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("lead_audit_leads_owner_created_idx").on(
      table.ownerId,
      table.createdAt,
    ),
    uniqueIndex("lead_audit_leads_public_booking_token_uidx").on(
      table.publicBookingToken,
    ),
  ],
);

export const insertLeadSchema = createInsertSchema(leadsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type LeadRecord = typeof leadsTable.$inferSelect;
