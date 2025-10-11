-- COMPLETE SCORING REPORT - LIVE ENTRIES ONLY
-- Shows all LIVE performances with their scoring status (excludes virtual)

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
  contestant_name,
  studio_name,
  performance_title,
  event_name,
  total_judges_assigned,
  judges_scored,
  (total_judges_assigned - judges_scored) as judges_missing,
  ROUND(average_score, 2) as avg_score,
  scores_published,
  CASE 
    -- Not started
    WHEN judges_scored = 0 THEN '🔴 NOT STARTED'
    
    -- Incomplete scoring
    WHEN judges_scored < total_judges_assigned THEN '🟡 INCOMPLETE (' || judges_scored || '/' || total_judges_assigned || ' judges)'
    
    -- Complete but not published (MISSING FROM RANKINGS)
    WHEN judges_scored = total_judges_assigned AND scores_published = false THEN '🟠 READY TO PUBLISH ❌'
    
    -- Complete and published (IN RANKINGS)
    WHEN judges_scored = total_judges_assigned AND scores_published = true THEN '✅ PUBLISHED ✓'
    
    ELSE 'UNKNOWN'
  END as status,
  CASE 
    WHEN judges_scored = 0 THEN 'Judges need to score'
    WHEN judges_scored < total_judges_assigned THEN 'Wait for ' || (total_judges_assigned - judges_scored) || ' more judge(s)'
    WHEN judges_scored = total_judges_assigned AND scores_published = false THEN '👉 PUBLISH NOW via /admin/scoring-approval'
    WHEN judges_scored = total_judges_assigned AND scores_published = true THEN 'Visible in rankings'
    ELSE '-'
  END as action_needed
FROM performance_judge_counts
ORDER BY 
  CASE 
    WHEN judges_scored = total_judges_assigned AND scores_published = false THEN 1  -- Ready to publish first
    WHEN judges_scored < total_judges_assigned THEN 2  -- Incomplete second
    WHEN judges_scored = 0 THEN 3  -- Not started third
    ELSE 4  -- Published last
  END,
  item_number;

-- LIVE ENTRIES ONLY - Virtual entries excluded
-- 🔴 NOT STARTED - No judges have scored yet
-- 🟡 INCOMPLETE - Some judges scored, waiting for others
-- 🟠 READY TO PUBLISH - All judges scored BUT NOT PUBLISHED (missing from rankings)
-- ✅ PUBLISHED - All judges scored AND published (visible in rankings)

