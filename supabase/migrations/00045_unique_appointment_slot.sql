-- Guarantee one receptionist appointment per slot.
--
-- The Retell voice agent fires book_appointment several times per call, and the
-- in-app conflict check is read-then-write, so two concurrent calls could race
-- past it and create a true duplicate booking. This partial unique index makes a
-- same-slot double-booking impossible at the database level: the second insert
-- fails with a unique violation (23505), which lib/booking.ts handles gracefully
-- (idempotent success if it's the same caller, otherwise "that time was taken").
--
-- Partial (type = 'appointment') so it only constrains receptionist bookings and
-- never interferes with other event types (e.g. Google-synced or manual events).

CREATE UNIQUE INDEX IF NOT EXISTS uniq_appointment_slot
  ON events (organization_id, start_at)
  WHERE type = 'appointment';
