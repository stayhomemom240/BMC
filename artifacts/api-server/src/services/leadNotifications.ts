import { Resend } from "resend";
import { logger } from "../lib/logger";

interface LeadNotification {
  name: string;
  email: string;
  company: string | null;
  website: string | null;
  serviceType: string;
  industry: string | null;
  goals: string;
  challenge: string;
  timeline: string;
}

interface ConsultationNotification {
  leadName: string;
  leadEmail: string;
  company: string | null;
  serviceType: string;
  startsAt: Date;
  meetingType: "zoom" | "phone";
  phone: string | null;
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
        `1. Name: ${lead.name}`,
        `2. Email: ${lead.email}`,
        `3. Company: ${lead.company || "Not provided"}`,
        `4. Website: ${lead.website || "Not provided"}`,
        `5. Service: ${lead.serviceType}`,
        `6. Industry: ${lead.industry || "Not provided"}`,
        `7. Goal: ${lead.goals}`,
        `8. Current challenge: ${lead.challenge}`,
        `9. Timeline: ${lead.timeline}`,
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

export async function sendConsultationNotification(
  consultation: ConsultationNotification,
): Promise<boolean> {
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
      { event: "consultation_notification_not_configured", missing },
      "Resend consultation notifications are not configured.",
    );
    return false;
  }

  const requestedTime = formatConsultationTime(consultation.startsAt);
  const meetingDetails =
    consultation.meetingType === "phone"
      ? `Phone call: ${consultation.phone ?? "No phone number provided"}`
      : "Zoom: please include a meeting link when confirming.";

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      subject: `Consultation request: ${consultation.leadName}`,
      text: [
        `Lead: ${consultation.leadName}`,
        `Email: ${consultation.leadEmail}`,
        `Company: ${consultation.company || "Not provided"}`,
        `Service: ${consultation.serviceType}`,
        `Requested time: ${requestedTime}`,
        meetingDetails,
        "",
        "This is a time request, not a confirmed appointment. Use the owner workspace to confirm, decline, or suggest another time; the prospect will receive an email response.",
      ].join("\n"),
    });

    if (error) {
      logger.error(
        { event: "consultation_notification_failed", errorType: error.name },
        "Resend rejected a consultation notification.",
      );
      return false;
    }

    logger.info(
      { event: "consultation_notification_sent" },
      "Consultation notification sent through Resend.",
    );
    return true;
  } catch (error) {
    logger.error(
      {
        event: "consultation_notification_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
      },
      "Could not send a consultation notification through Resend.",
    );
    return false;
  }
}

function formatConsultationTime(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(value);
}

interface ConsultationResponseNotification {
  lead: {
    name: string;
    email: string;
  };
  consultation: {
    status: "confirmed" | "declined" | "reschedule_proposed";
    slotStart: Date;
    meetingType: "zoom" | "phone";
    phone: string | null;
    responseMessage: string | null;
    responseSlotStart: Date | null;
    meetingUrl: string | null;
  };
}

export async function sendConsultationResponseNotification({
  lead,
  consultation,
}: ConsultationResponseNotification): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const ownerEmail = process.env.RESEND_TO_EMAIL?.trim();
  if (!apiKey || !from || !ownerEmail) {
    const missing = [
      !apiKey && "RESEND_API_KEY",
      !from && "RESEND_FROM_EMAIL",
      !ownerEmail && "RESEND_TO_EMAIL",
    ].filter((value): value is string => Boolean(value));
    logger.warn(
      { event: "consultation_response_email_not_configured", missing },
      "Resend consultation response emails are not configured.",
    );
    return false;
  }

  const subject =
    consultation.status === "confirmed"
      ? "Your consultation is confirmed"
      : consultation.status === "declined"
        ? "Update about your consultation request"
        : "A new time for your consultation";
  const offeredTime =
    consultation.status === "reschedule_proposed" &&
    consultation.responseSlotStart
      ? consultation.responseSlotStart
      : consultation.slotStart;
  const lines = [
    `Hello ${lead.name},`,
    "",
    consultation.status === "confirmed"
      ? `Your consultation is confirmed for ${formatConsultationTime(offeredTime)}.`
      : consultation.status === "declined"
        ? `I’m unable to confirm the consultation time you requested (${formatConsultationTime(consultation.slotStart)}).`
        : `I’m unable to meet at your requested time (${formatConsultationTime(consultation.slotStart)}), but can offer ${formatConsultationTime(offeredTime)} instead.`,
    consultation.status === "confirmed"
      ? consultation.meetingType === "zoom"
        ? `Zoom link: ${consultation.meetingUrl}`
        : `Phone call: ${consultation.phone ?? "the number you provided"}`
      : null,
    consultation.responseMessage,
    "",
    "Please reply to this email if you have any questions.",
  ].filter((line): line is string => line !== null);

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: lead.email,
      replyTo: ownerEmail,
      subject,
      text: lines.join("\n"),
    });

    if (error) {
      logger.error(
        {
          event: "consultation_response_email_failed",
          errorType: error.name,
        },
        "Resend rejected a consultation response email.",
      );
      return false;
    }

    logger.info(
      { event: "consultation_response_email_sent" },
      "Consultation response email sent through Resend.",
    );
    return true;
  } catch (error) {
    logger.error(
      {
        event: "consultation_response_email_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
      },
      "Could not send a consultation response email through Resend.",
    );
    return false;
  }
}
