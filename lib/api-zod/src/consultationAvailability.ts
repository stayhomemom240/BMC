const timeZone = "America/Los_Angeles";

type AvailabilityWindow = readonly [startMinute: number, endMinute: number];

const windowsByWeekday: Partial<Record<number, readonly AvailabilityWindow[]>> = {
  0: [[11 * 60, 15 * 60]],
  1: [
    [8 * 60, 9 * 60 + 30],
    [14 * 60, 19 * 60],
  ],
  2: [
    [8 * 60, 9 * 60 + 30],
    [14 * 60, 19 * 60],
  ],
  4: [
    [8 * 60, 9 * 60 + 30],
    [14 * 60, 19 * 60],
  ],
  5: [
    [8 * 60, 9 * 60 + 30],
    [14 * 60, 19 * 60],
  ],
  6: [[11 * 60, 15 * 60]],
};

const datePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

const dateLabelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone,
  weekday: "long",
  month: "long",
  day: "numeric",
});

const timeLabelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone,
  hour: "numeric",
  minute: "2-digit",
});

export interface ConsultationSlot {
  startsAt: string;
  date: string;
  dateLabel: string;
  timeLabel: string;
}

function getNumericPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  const part = parts.find((value) => value.type === type);
  if (!part) {
    throw new Error(`Missing ${type} part in formatted date.`);
  }
  return Number(part.value);
}

function getLocalDateParts(date: Date) {
  const parts = datePartsFormatter.formatToParts(date);
  return {
    year: getNumericPart(parts, "year"),
    month: getNumericPart(parts, "month"),
    day: getNumericPart(parts, "day"),
  };
}

function toUtcDate(dateKey: string, minuteOfDay: number): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetUtc = Date.UTC(
    year,
    month - 1,
    day,
    Math.floor(minuteOfDay / 60),
    minuteOfDay % 60,
  );
  let candidateUtc = targetUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = datePartsFormatter.formatToParts(new Date(candidateUtc));
    const observedUtc = Date.UTC(
      getNumericPart(parts, "year"),
      getNumericPart(parts, "month") - 1,
      getNumericPart(parts, "day"),
      getNumericPart(parts, "hour"),
      getNumericPart(parts, "minute"),
    );
    const adjustedUtc = candidateUtc + targetUtc - observedUtc;
    if (adjustedUtc === candidateUtc) {
      break;
    }
    candidateUtc = adjustedUtc;
  }

  return new Date(candidateUtc);
}

function dateKeyFromUtcDate(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function getConsultationSlots(
  now: Date = new Date(),
  days = 14,
): ConsultationSlot[] {
  if (!Number.isInteger(days) || days < 1) {
    throw new RangeError("Consultation availability days must be a positive integer.");
  }

  const localToday = getLocalDateParts(now);
  const firstDayUtc = new Date(
    Date.UTC(localToday.year, localToday.month - 1, localToday.day),
  );
  const slots: ConsultationSlot[] = [];

  for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
    const date = new Date(firstDayUtc);
    date.setUTCDate(date.getUTCDate() + dayOffset);
    const dateKey = dateKeyFromUtcDate(date);
    const windows = windowsByWeekday[date.getUTCDay()] ?? [];

    for (const [windowStart, windowEnd] of windows) {
      for (let minute = windowStart; minute < windowEnd; minute += 15) {
        const startsAt = toUtcDate(dateKey, minute);
        if (startsAt <= now) {
          continue;
        }

        slots.push({
          startsAt: startsAt.toISOString(),
          date: dateKey,
          dateLabel: dateLabelFormatter.format(startsAt),
          timeLabel: timeLabelFormatter.format(startsAt),
        });
      }
    }
  }

  return slots;
}

export function isAvailableConsultationSlot(
  startsAt: string | Date,
  now: Date = new Date(),
): boolean {
  const timestamp =
    startsAt instanceof Date ? startsAt.getTime() : Date.parse(startsAt);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return getConsultationSlots(now).some(
    (slot) => Date.parse(slot.startsAt) === timestamp,
  );
}
