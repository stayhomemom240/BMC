import assert from "node:assert/strict";
import test from "node:test";
import {
  getConsultationSlots,
  isAvailableConsultationSlot,
} from "./consultationAvailability.ts";

test("generates the configured Pacific-time windows without Wednesdays", () => {
  const now = new Date("2026-07-05T16:00:00.000Z");
  const slots = getConsultationSlots(now, 4);
  const monday = slots.filter((slot) => slot.date === "2026-07-06");

  assert.equal(slots.filter((slot) => slot.date === "2026-07-05").length, 16);
  assert.equal(monday.length, 26);
  assert.equal(slots.filter((slot) => slot.date === "2026-07-08").length, 0);
  assert.equal(monday[0].startsAt, "2026-07-06T15:00:00.000Z");
  assert.equal(monday[5].startsAt, "2026-07-06T16:15:00.000Z");
  assert.equal(monday[6].startsAt, "2026-07-06T21:00:00.000Z");
  assert.equal(monday.at(-1)?.startsAt, "2026-07-07T01:45:00.000Z");
});

test("adjusts Pacific slots across daylight-saving time", () => {
  const beforeSpringForward = getConsultationSlots(
    new Date("2026-03-01T00:00:00.000Z"),
    8,
  );
  const afterSpringForward = getConsultationSlots(
    new Date("2026-03-08T00:00:00.000Z"),
    8,
  );

  assert.equal(
    beforeSpringForward.find((slot) => slot.date === "2026-03-02")?.startsAt,
    "2026-03-02T16:00:00.000Z",
  );
  assert.equal(
    afterSpringForward.find((slot) => slot.date === "2026-03-09")?.startsAt,
    "2026-03-09T15:00:00.000Z",
  );
});

test("accepts only current, exact 15-minute slots", () => {
  const now = new Date("2026-07-05T16:00:00.000Z");

  assert.equal(
    isAvailableConsultationSlot("2026-07-06T15:00:00.000Z", now),
    true,
  );
  assert.equal(
    isAvailableConsultationSlot("2026-07-06T15:07:00.000Z", now),
    false,
  );
  assert.equal(
    isAvailableConsultationSlot("2026-07-05T15:00:00.000Z", now),
    false,
  );
  assert.equal(isAvailableConsultationSlot("not-a-date", now), false);
});
