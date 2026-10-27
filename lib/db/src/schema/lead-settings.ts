import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const leadSettingsTable = pgTable("lead_audit_settings", {
  ownerId: text("owner_id").primaryKey(),
  businessName: text("business_name").notNull().default("Boss Mom Consulting"),
  tagline: text("tagline")
    .notNull()
    .default("Practical support for local visibility, zero-waste goals, and your next business priorities."),
  enabledServices: text("enabled_services")
    .array()
    .notNull()
    .default(["local-seo", "zero-waste", "general"]),
  publishOnWebsite: boolean("publish_on_website").notNull().default(false),
  websiteUrl: text("website_url"),
  fiverrUrl: text("fiverr_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("lead_audit_settings_single_public_site_idx")
    .on(table.publishOnWebsite)
    .where(sql`${table.publishOnWebsite} = true`),
]);

export const insertLeadSettingsSchema = createInsertSchema(
  leadSettingsTable,
).omit({
  updatedAt: true,
});

export type InsertLeadSettings = z.infer<typeof insertLeadSettingsSchema>;
export type LeadSettingsRecord = typeof leadSettingsTable.$inferSelect;
