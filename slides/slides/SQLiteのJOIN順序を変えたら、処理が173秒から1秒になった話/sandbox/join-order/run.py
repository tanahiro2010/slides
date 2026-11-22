import sqlite3, sys, time, shutil
OLD="SELECT e.* FROM activity_events e JOIN account_events ae ON ae.event_id = e.event_id WHERE ae.account_id = ?1 AND e.parent_pr_id = ?2"
NEW="SELECT e.* FROM activity_events e CROSS JOIN account_events ae ON ae.event_id = e.event_id WHERE e.parent_pr_id = ?2 AND ae.account_id = ?1"
db=sys.argv[1]; analyze=len(sys.argv)>2
c=sqlite3.connect(db)
print("sqlite", sqlite3.sqlite_version, "analyze" if analyze else "no-stats")
if analyze: c.execute("ANALYZE")
else: c.execute("DROP TABLE IF EXISTS sqlite_stat1")
for name,q in (("old",OLD),("new",NEW)):
    plan=[r[3] for r in c.execute("EXPLAIN QUERY PLAN "+q,(1,"PR_7"))]
    for _ in range(2):
        t=time.perf_counter(); n=0
        for p in range(2000):
            n+=len(c.execute(q,(1,f"PR_{p}")).fetchall())
        dt=time.perf_counter()-t
    print(f"{name}: {dt:.2f}s rows={n} plan={plan}")
