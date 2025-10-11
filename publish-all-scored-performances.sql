-- This will publish ALL performances where all judges have scored
-- Run this to make them visible in rankings

UPDATE performances
SET scores_published = true
WHERE id IN (
  SELECT p.id
  FROM performances p
  JOIN judge_event_assignments jea ON jea.event_id = p.event_id
  LEFT JOIN scores s ON s.performance_id = p.id
  GROUP BY p.id
  HAVING COUNT(DISTINCT jea.judge_id) = COUNT(DISTINCT s.judge_id)
    AND COUNT(DISTINCT s.judge_id) > 0
    AND p.scores_published = false
);

-- After running this, all fully-scored performances will appear in rankings

