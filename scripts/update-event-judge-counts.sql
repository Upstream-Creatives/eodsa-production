-- Migration script to add number_of_judges column and update existing events
-- Run this manually if the column doesn't exist yet

-- Add the column if it doesn't exist
ALTER TABLE events ADD COLUMN IF NOT EXISTS number_of_judges INTEGER DEFAULT 4;

-- Update existing events based on their current judge assignments
-- This sets number_of_judges to the count of assigned judges, or keeps default 4
UPDATE events e
SET number_of_judges = COALESCE(
  (
    SELECT COUNT(*)
    FROM judge_event_assignments jea
    WHERE jea.event_id = e.id
      AND (jea.status = 'active' OR jea.status IS NULL)
  ),
  4
)
WHERE number_of_judges IS NULL OR number_of_judges = 4;

-- For the specific "Testing virtual event November" event, set it to 3 if it exists
UPDATE events
SET number_of_judges = 3
WHERE name LIKE '%Testing virtual event November%'
  AND number_of_judges != 3;

-- Verify the updates
SELECT id, name, number_of_judges, 
  (SELECT COUNT(*) FROM judge_event_assignments jea 
   WHERE jea.event_id = events.id 
   AND (jea.status = 'active' OR jea.status IS NULL)) as current_judges
FROM events
ORDER BY created_at DESC;


