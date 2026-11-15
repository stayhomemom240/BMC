import { and, desc, eq, ne } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateLeadBody,
  CreateLeadResponse,
  DeleteLeadParams,
  GetLeadParams,
  GetLeadResponse,
  GetLeadInsightsResponse,
  GetLeadSettingsResponse,
  GetPublicLeadSettingsParams,
  GetPublicLeadSettingsResponse,
  GetPublicWebsiteProfileResponse,
  ListLeadsResponse,
  RequestConsultationBody,
  RequestConsultationResponse,
  SubmitPublicLeadBody,
  SubmitPublicLeadResponse,
  UpdateLeadBody,
  UpdateLeadParams,
  UpdateLeadResponse,
  UpdateLeadSettingsBody,
  UpdateLeadSettingsResponse,
} from "@workspace/api-zod";
import { isAvailableConsultationSlot } from "@workspace/api-zod/consultationAvailability";
import {
  consultationRequestsTable,
  db,
  leadSettingsTable,
  leadsTable,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { requireNeonAuth } from "../middlewares/neonAuthMiddleware";
import {
  sendConsultationNotification,
  sendLeadNotification,
} from "../services/leadNotifications";

const router: IRouter = Router();

const serviceTypes = ["local-seo", "zero-waste", "general"] as const;

const requireAuth = requireNeonAuth;

function serviceLabel(serviceType: string): string {
  switch (serviceType) {
    case "local-seo":
      return "Local SEO / GEO audit";
    case "zero-waste":
      return "Zero-waste sustainability audit";
    default:
      return "Client needs assessment";
  }
}

function calculateBriefReadiness(input: {
  company?: string | null;
  website?: string | null;
  industry?: string | null;
  goals: string;
  challenge: string;
  timeline: string;
}): number {
  const detailPoints = (value: string) => (value.trim().length >= 60 ? 20 : 10);
  const score =
    10 +
    (input.company?.trim() ? 10 : 0) +
    (input.website?.trim() ? 10 : 0) +
    (input.industry?.trim() ? 10 : 0) +
    detailPoints(input.goals) +
    detailPoints(input.challenge) +
    (input.timeline.toLowerCase().includes("explor") ? 10 : 20);
  return Math.min(100, score);
}

function createReportSummary(
  input: {
    name: string;
    company?: string | null;
    serviceType: string;
    industry?: string | null;
    goals: string;
    challenge: string;
    timeline: string;
  },
  readinessScore: number,
): string {
  const nextStep =
    input.serviceType === "local-seo"
      ? "Review the current business profile, local listings, service-area pages, and priority search terms against a verified baseline."
      : input.serviceType === "zero-waste"
        ? "Map the main waste streams, collection routes, and material volumes before recommending reduction or reuse steps."
        : "Confirm the desired outcome, project scope, and first milestone before preparing a service proposal.";

  return [
    `Business: ${input.company?.trim() || input.name}`,
    `Service of interest: ${serviceLabel(input.serviceType)}`,
    input.industry?.trim() ? `Industry: ${input.industry.trim()}` : null,
    `Goal shared: ${input.goals.trim()}`,
    `Current challenge: ${input.challenge.trim()}`,
    `Timing: ${input.timeline}`,
    `Brief readiness: ${readinessScore}/100 (based on the completeness of these answers, not a technical audit score).`,
    `Suggested next step: ${nextStep}`,
    "This intake summary reflects the prospect's answers; it is not a completed technical or on-site audit.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function insertLead(
  ownerId: string,
  input: {
    name: string;
    email: string;
    company?: string | null;
    website?: string | null;
    serviceType: string;
    industry?: string | null;
    goals: string;
    challenge: string;
    timeline: string;
    notes?: string | null;
  },
) {
  const readinessScore = calculateBriefReadiness(input);
  const reportSummary = createReportSummary(input, readinessScore);
  const [lead] = await db
    .insert(leadsTable)
    .values({
      ownerId,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      company: input.company?.trim() || null,
      website: input.website?.trim() || null,
      serviceType: input.serviceType,
      industry: input.industry?.trim() || null,
      goals: input.goals.trim(),
      challenge: input.challenge.trim(),
      timeline: input.timeline.trim(),
      readinessScore,
      reportSummary,
      notes: input.notes?.trim() || null,
      stage: "new",
    })
    .returning();
  return lead;
}

function serializeLead<T extends { createdAt: Date }>(lead: T) {
  return { ...lead, createdAt: lead.createdAt.toISOString() };
}

router.get("/leads", requireAuth, async (_req, res): Promise<void> => {
  const ownerId = res.locals.ownerId as string;
  const leads = await db
    .select()
    .from(leadsTable)
    .where(eq(leadsTable.ownerId, ownerId))
    .orderBy(desc(leadsTable.createdAt));
  res.json(ListLeadsResponse.parse(leads.map(serializeLead)));
});

router.post("/leads", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const lead = await insertLead(res.locals.ownerId as string, parsed.data);
  await sendLeadNotification(lead);
  res.status(201).json(CreateLeadResponse.parse(serializeLead(lead)));
});

router.get("/leads/:leadId", requireAuth, async (req, res): Promise<void> => {
  const params = GetLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [lead] = await db
    .select()
    .from(leadsTable)
    .where(
      and(
        eq(leadsTable.id, params.data.leadId),
        eq(leadsTable.ownerId, res.locals.ownerId as string),
      ),
    );
  if (!lead) {
    res.status(404).json({ error: "Lead not found." });
    return;
  }
  res.json(GetLeadResponse.parse(serializeLead(lead)));
});

router.patch(
  "/leads/:leadId",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = UpdateLeadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateLeadBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (parsed.data.stage === undefined && parsed.data.notes === undefined) {
      res.status(400).json({ error: "Provide a stage or notes update." });
      return;
    }

    const [lead] = await db
      .update(leadsTable)
      .set(parsed.data)
      .where(
        and(
          eq(leadsTable.id, params.data.leadId),
          eq(leadsTable.ownerId, res.locals.ownerId as string),
        ),
      )
      .returning();
    if (!lead) {
      res.status(404).json({ error: "Lead not found." });
      return;
    }
    res.json(UpdateLeadResponse.parse(serializeLead(lead)));
  },
);

router.delete(
  "/leads/:leadId",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = DeleteLeadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [deleted] = await db
      .delete(leadsTable)
      .where(
        and(
          eq(leadsTable.id, params.data.leadId),
          eq(leadsTable.ownerId, res.locals.ownerId as string),
        ),
      )
      .returning({ id: leadsTable.id });
    if (!deleted) {
      res.status(404).json({ error: "Lead not found." });
      return;
    }
    res.sendStatus(204);
  },
);

router.get(
  "/dashboard/insights",
  requireAuth,
  async (_req, res): Promise<void> => {
    const ownerId = res.locals.ownerId as string;
    const leads = await db
      .select({
        stage: leadsTable.stage,
        serviceType: leadsTable.serviceType,
        createdAt: leadsTable.createdAt,
      })
      .from(leadsTable)
      .where(eq(leadsTable.ownerId, ownerId));

    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const wonLeads = leads.filter((lead) => lead.stage === "won").length;
    const response = {
      totalLeads: leads.length,
      newLeads: leads.filter((lead) => lead.stage === "new").length,
      activeLeads: leads.filter((lead) =>
        ["contacted", "proposal"].includes(lead.stage),
      ).length,
      wonLeads,
      winRate: leads.length
        ? Math.round((wonLeads / leads.length) * 1000) / 10
        : 0,
      leadsThisMonth: leads.filter((lead) => lead.createdAt >= monthStart).length,
      serviceBreakdown: serviceTypes.map((serviceType) => ({
        serviceType,
        count: leads.filter((lead) => lead.serviceType === serviceType).length,
      })),
    };
    res.json(GetLeadInsightsResponse.parse(response));
  },
);

router.get("/settings", requireAuth, async (_req, res): Promise<void> => {
  const ownerId = res.locals.ownerId as string;
  await db
    .insert(leadSettingsTable)
    .values({ ownerId })
    .onConflictDoNothing({ target: leadSettingsTable.ownerId });
  const [settings] = await db
    .select()
    .from(leadSettingsTable)
    .where(eq(leadSettingsTable.ownerId, ownerId));
  res.json(GetLeadSettingsResponse.parse(settings));
});

router.put("/settings", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateLeadSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const ownerId = res.locals.ownerId as string;
  const settings = await db.transaction(async (tx) => {
    if (parsed.data.publishOnWebsite) {
      await tx
        .update(leadSettingsTable)
        .set({ publishOnWebsite: false })
        .where(ne(leadSettingsTable.ownerId, ownerId));
    }
    const [saved] = await tx
      .insert(leadSettingsTable)
      .values({ ownerId, ...parsed.data })
      .onConflictDoUpdate({
        target: leadSettingsTable.ownerId,
        set: { ...parsed.data, updatedAt: new Date() },
      })
      .returning();
    return saved;
  });
  res.json(UpdateLeadSettingsResponse.parse(settings));
});

router.get("/public/website-profile", async (_req, res): Promise<void> => {
  const [settings] = await db
    .select()
    .from(leadSettingsTable)
    .where(eq(leadSettingsTable.publishOnWebsite, true))
    .orderBy(desc(leadSettingsTable.updatedAt))
    .limit(1);
  if (!settings) {
    res.status(404).json({ error: "No business profile is published on this website." });
    return;
  }
  res.json(
    GetPublicWebsiteProfileResponse.parse({
      ownerId: settings.ownerId,
      businessName: settings.businessName,
      tagline: settings.tagline,
      enabledServices: settings.enabledServices,
      websiteUrl: settings.websiteUrl,
      fiverrUrl: settings.fiverrUrl,
    }),
  );
});

router.get(
  "/public/owners/:ownerId",
  async (req, res): Promise<void> => {
    const params = GetPublicLeadSettingsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [settings] = await db
      .select()
      .from(leadSettingsTable)
      .where(eq(leadSettingsTable.ownerId, params.data.ownerId));
    if (!settings) {
      res.status(404).json({ error: "This assessment link is not available." });
      return;
    }
    const publicSettings = {
      ownerId: params.data.ownerId,
      businessName: settings.businessName,
      tagline: settings.tagline,
      enabledServices: settings.enabledServices,
      websiteUrl: settings.websiteUrl,
      fiverrUrl: settings.fiverrUrl,
    };
    res.json(GetPublicLeadSettingsResponse.parse(publicSettings));
  },
);

router.post("/public/leads", async (req, res): Promise<void> => {
  const parsed = SubmitPublicLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const input = parsed.data;
  const [settings] = await db
    .select({
      businessName: leadSettingsTable.businessName,
      enabledServices: leadSettingsTable.enabledServices,
    })
    .from(leadSettingsTable)
    .where(eq(leadSettingsTable.ownerId, input.ownerId));
  if (!settings) {
    res.status(404).json({ error: "This assessment link is not available." });
    return;
  }
  if (!settings.enabledServices.includes(input.serviceType)) {
    res.status(400).json({ error: "That service is not currently offered." });
    return;
  }

  const lead = await insertLead(input.ownerId, input);
  await sendLeadNotification(lead);
  const result = {
    id: lead.id,
    bookingToken: lead.publicBookingToken,
    businessName: settings.businessName,
    serviceType: lead.serviceType,
    readinessScore: lead.readinessScore,
    reportTitle: `${serviceLabel(lead.serviceType)} discovery brief`,
    reportSummary: lead.reportSummary,
  };
  res.status(201).json(SubmitPublicLeadResponse.parse(result));
});

router.post("/public/consultation-requests", async (req, res): Promise<void> => {
  const parsed = RequestConsultationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const input = parsed.data;
  const [lead] = await db
    .select({
      id: leadsTable.id,
      name: leadsTable.name,
      email: leadsTable.email,
      company: leadsTable.company,
      serviceType: leadsTable.serviceType,
    })
    .from(leadsTable)
    .where(eq(leadsTable.publicBookingToken, input.bookingToken));
  if (!lead) {
    res.status(404).json({ error: "This assessment link is not available." });
    return;
  }

  const slotStartValue: unknown = input.startsAt;
  const slotStart =
    slotStartValue instanceof Date
      ? slotStartValue
      : new Date(String(slotStartValue));
  if (!isAvailableConsultationSlot(slotStart)) {
    res.status(409).json({
      error: "That time is no longer available. Please choose another slot.",
    });
    return;
  }

  const phone = input.phone?.trim() || null;
  if (input.meetingType === "phone" && (!phone || phone.length < 7)) {
    res.status(400).json({
      error: "Enter a phone number with at least 7 characters for a phone consultation.",
    });
    return;
  }

  const [consultation] = await db
    .insert(consultationRequestsTable)
    .values({
      leadId: lead.id,
      slotStart,
      meetingType: input.meetingType,
      phone: input.meetingType === "phone" ? phone : null,
    })
    .onConflictDoUpdate({
      target: consultationRequestsTable.leadId,
      set: {
        slotStart,
        meetingType: input.meetingType,
        phone: input.meetingType === "phone" ? phone : null,
        createdAt: new Date(),
      },
    })
    .returning({ id: consultationRequestsTable.id });

  const notificationSent = await sendConsultationNotification({
    leadName: lead.name,
    leadEmail: lead.email,
    company: lead.company,
    serviceType: serviceLabel(lead.serviceType),
    startsAt: slotStart,
    meetingType: input.meetingType,
    phone: input.meetingType === "phone" ? phone : null,
  });

  const result = { id: consultation.id, notificationSent };
  res.status(201).json(RequestConsultationResponse.parse(result));
});

export default router;
