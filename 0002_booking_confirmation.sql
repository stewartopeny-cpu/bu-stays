ALTER TABLE bookings ADD COLUMN offer_expires_at TEXT;
ALTER TABLE bookings ADD COLUMN updated_at TEXT;

UPDATE bookings
SET status = CASE WHEN status = 'confirmed' THEN 'completed' ELSE status END,
    updated_at = COALESCE(updated_at, created_at);

CREATE TABLE IF NOT EXISTS booking_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

CREATE INDEX IF NOT EXISTS idx_booking_events_booking ON booking_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_reference_phone ON bookings(reference, phone);
PRAGMA optimize;
