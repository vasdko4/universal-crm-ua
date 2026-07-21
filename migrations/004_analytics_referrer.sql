-- Traffic sources + performance indexes for analytics.
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS referrer varchar(300);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events (created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created ON analytics_events (type, created_at);
