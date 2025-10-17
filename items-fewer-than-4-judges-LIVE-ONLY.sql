-- Query: LIVE Items scored by fewer than 4 judges
-- This shows LIVE performances that don't have all 4 judges scored yet

WITH performance_judge_counts AS (
  SELECT
    p.id as performance_id,
    p.item_number,
    p.title as performance_title,
    p.event_id,
    e.name as event_name,
    c.name as contestant_name,
    c.studio_name,
    p.scores_published,
    ee.entry_type,
    COUNT(DISTINCT jea.judge_id) as total_judges_assigned,
    COUNT(DISTINCT s.judge_id) as judges_scored,
    (COUNT(DISTINCT jea.judge_id) - COUNT(DISTINCT s.judge_id)) as judges_missing
  FROM performances p
  JOIN events e ON p.event_id = e.id
  JOIN contestants c ON p.contestant_id = c.id
  LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
  JOIN judge_event_assignments jea ON jea.event_id = p.event_id
  LEFT JOIN scores s ON s.performance_id = p.id
  WHERE COALESCE(ee.entry_type, 'live') = 'live'
  GROUP BY p.id, p.item_number, p.title, p.event_id, e.name, c.name, c.studio_name, p.scores_published, ee.entry_type
)
SELECT 
  item_number,
  performance_id,
  performance_title,
  contestant_name,
  studio_name,
  event_name,
  total_judges_assigned,
  judges_scored,
  judges_missing,
  CASE 
    WHEN judges_scored = 0 THEN '🔴 NOT STARTED'
    WHEN judges_scored < total_judges_assigned THEN '🟡 INCOMPLETE'
    ELSE '✅ COMPLETE'
  END as status,
  scores_published
FROM performance_judge_counts
WHERE judges_scored < total_judges_assigned
ORDER BY item_number, contestant_name;

-- LIVE ENTRIES ONLY - shows incomplete scoring















