-- Add google_event_id column to track Google Calendar event mapping
ALTER TABLE events
ADD COLUMN google_event_id TEXT,
ADD CONSTRAINT events_google_event_id_unique UNIQUE(organization_id, google_event_id);

-- Index for efficient lookups when syncing
CREATE INDEX idx_events_google_event_id ON events(organization_id, google_event_id)
WHERE google_event_id IS NOT NULL;
