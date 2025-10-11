-- Query to find performances that are on approval dashboard but not in rankings
-- These are performances with all judges scored but NOT PUBLISHED

WITH performance_judge_counts AS (
  SELECT
    p.id as performance_id,
    p.title as performance_title,
    p.event_id,
    p.scores_published,
    c.name as contestant_name,
    COUNT(DISTINCT jea.judge_id) as total_judges,
    COUNT(DISTINCT s.judge_id) as scored_judges
  FROM performances p
  JOIN contestants c ON p.contestant_id = c.id
  JOIN judge_event_assignments jea ON jea.event_id = p.event_id
  LEFT JOIN scores s ON s.performance_id = p.id
  GROUP BY p.id, p.title, p.event_id, p.scores_published, c.name
)
SELECT 
  performance_id,
  performance_title,
  contestant_name,
  event_id,
  total_judges,
  scored_judges,
  scores_published,
  CASE 
    WHEN scores_published = false THEN '❌ NOT PUBLISHED (missing from rankings)'
    WHEN scores_published = true THEN '✅ PUBLISHED (in rankings)'
  END as status
FROM performance_judge_counts
WHERE scored_judges > 0 AND scored_judges = total_judges
ORDER BY scores_published ASC, contestant_name;

-- SOLUTION: If scores_published = false, go to /admin/scoring-approval and click "Publish Scores"

