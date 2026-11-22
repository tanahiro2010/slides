CREATE TABLE activity_events (
  event_id TEXT NOT NULL PRIMARY KEY, event_type TEXT NOT NULL,
  parent_pr_id TEXT, occurred_at INTEGER NOT NULL, meta TEXT NOT NULL);
CREATE INDEX activity_events_occurred ON activity_events(occurred_at);
CREATE INDEX activity_events_parent_pr ON activity_events(parent_pr_id) WHERE parent_pr_id IS NOT NULL;
CREATE TABLE account_events (
  account_id INTEGER NOT NULL, event_id TEXT NOT NULL,
  PRIMARY KEY (account_id, event_id)) WITHOUT ROWID;
CREATE INDEX account_events_event ON account_events(event_id);
WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i+1 FROM n WHERE i < 99999)
INSERT INTO activity_events
SELECT 'EV_'||i, CASE WHEN i%5=0 THEN 'commit' ELSE 'review' END,
       CASE WHEN i%5=0 THEN NULL ELSE 'PR_'||(i%2000) END,
       1700000000 + i*315, '{}' FROM n;
INSERT INTO account_events SELECT 1, event_id FROM activity_events;
