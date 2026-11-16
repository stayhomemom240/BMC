import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { leadsTable } from "./leads";

export const consultationRequestsTable = pgTable(
  "lead_audit_consultation_requests",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leadsTable.id, { onDelete: "cascade" }),
    slotStart: timestamp("slot_start", { withTimezone: true }).notNull(),
    meetingType: text("meeting_type").notNull(),
    phone: text("phone"),
    status: text("status").notNull().default("requested"),
    responseMessage: text("response_message"),
    responseSlotStart: timestamp("response_slot_start", { withTimezone: true }),
    meetingUrl: text("meeting_url"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("lead_audit_consultation_requests_lead_uidx").on(table.leadId),
    index("lead_audit_consultation_requests_slot_idx").on(table.slotStart),
  ],
);
