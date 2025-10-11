-- Query: LIVE Items not approved or missing in rankings
-- This shows LIVE performances that ARE fully scored by all judges but NOT PUBLISHED

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
    SUM(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) as total_score,
    AVG(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) as average_score
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
  ROUND(average_score, 2) as average_score,
  ROUND((average_score / 100.0 * 100), 1) as percentage,
  scores_published,
  '❌ READY TO PUBLISH - Missing from Rankings' as status,
  'Go to /admin/scoring-approval to publish' as action_needed
FROM performance_judge_counts
WHERE judges_scored > 0 
  AND judges_scored = total_judges_assigned
  AND scores_published = false
ORDER BY item_number, contestant_name;

-- LIVE ENTRIES ONLY
-- These are items that:
-- ✓ Are LIVE entries (not virtual)
-- ✓ Have all judges scored
-- ✗ Are NOT published yet
-- Result: Show on approval dashboard but NOT in rankings

