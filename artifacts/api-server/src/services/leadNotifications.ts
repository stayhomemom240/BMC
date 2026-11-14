import { Resend } from "resend";
import { logger } from "../lib/logger";

interface LeadNotification {
  name: string;
  email: string;
  company: string | null;
  serviceType: string;
  goals: string;
  challenge: string;
  timeline: string;
}

export async function sendLeadNotification(
  lead: LeadNotification,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const to = process.env.RESEND_TO_EMAIL?.trim();
  if (!apiKey || !from || !to) {
    const missing = [
      !apiKey && "RESEND_API_KEY",
      !from && "RESEND_FROM_EMAIL",
      !to && "RESEND_TO_EMAIL",
    ].filter((value): value is string => Boolean(value));
    logger.warn(
      { event: "lead_notification_not_configured", missing },
      "Resend lead notifications are not configured.",
    );
    return;
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      subject: `New lead: ${lead.name}`,
      text: [
        `Name: ${lead.name}`,
        `Email: ${lead.email}`,
        `Company: ${lead.company || "Not provided"}`,
        `Service: ${lead.serviceType}`,
        "",
        "Goals:",
        lead.goals,
        "",
        "Current challenge:",
        lead.challenge,
        "",
        `Timeline: ${lead.timeline}`,
      ].join("\n"),
    });

    if (error) {
      logger.error(
        { event: "lead_notification_failed", errorType: error.name },
        "Resend rejected a lead notification.",
      );
      return;
    }

    logger.info(
      { event: "lead_notification_sent" },
      "Lead notification sent through Resend.",
    );
  } catch (error) {
    logger.error(
      {
        event: "lead_notification_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
      },
      "Could not send a lead notification through Resend.",
    );
  }
}
