/**
 * 証跡レコーダ。
 *
 * 鉄則: ログに残らない観測は結論に使わない。
 * この検証で観測したいものは「何が起きたか」の遷移なので、
 * ここが唯一の記録口になる。`record()` を通らない観測を作らない。
 *
 * 書き先は Durable Object 自身の SQLite にする。
 * クラッシュさせる当人のログに見えるが、SQLite はディスクなので
 * `ctx.storage.sync()` を挟めばクラッシュを跨ぐ。
 * **その前提自体が C01 の検証対象。** 既定は sync する。
 */

export type RecoveryEventName =
  | "instance_started"
  | "submitted"
  | "model_request"
  | "model_error"
  | "retry_scheduled"
  | "tool_started"
  | "tool_committed"
  | "tool_finished"
  | "tool_interrupted"
  | "fault_injected"
  | "storage_call"
  | "storage_error"
  | "session_failed"
  | "harness_opened"
  | "wake"
  | "report"
  | "parked"
  | "retried"
  | "completed"
  | "observed";

export type RecoveryEvent = {
  seq: number;
  experimentId: string;
  operationId: string | null;
  instanceId: string;
  timestamp: string;
  event: RecoveryEventName;
  metadata: Record<string, unknown>;
};

const DDL = `
CREATE TABLE IF NOT EXISTS exp_events (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  experimentId TEXT NOT NULL,
  operationId  TEXT,
  instanceId   TEXT NOT NULL,
  timestamp    TEXT NOT NULL,
  event        TEXT NOT NULL,
  metadata     TEXT NOT NULL
);`;

export class Evidence {
  #sql: SqlStorage;
  #storage: DurableObjectStorage;
  #instanceId: string;
  #experimentId = "unset";

  constructor(storage: DurableObjectStorage, instanceId: string) {
    this.#storage = storage;
    this.#sql = storage.sql;
    this.#instanceId = instanceId;
    this.#sql.exec(DDL);
  }

  get instanceId() {
    return this.#instanceId;
  }

  setExperiment(id: string) {
    this.#experimentId = id;
  }

  /**
   * 記録する。
   *
   * `durable: false` は **C01 の対照専用**。
   * それ以外で false を渡さない。渡した瞬間に、その観測は結論に使えなくなる。
   */
  async record(
    event: RecoveryEventName,
    metadata: Record<string, unknown> = {},
    options: { operationId?: string | null; durable?: boolean } = {},
  ): Promise<void> {
    const row = {
      experimentId: this.#experimentId,
      operationId: options.operationId ?? null,
      instanceId: this.#instanceId,
      timestamp: new Date().toISOString(),
      event,
      metadata: JSON.stringify(metadata),
    };

    this.#sql.exec(
      `INSERT INTO exp_events (experimentId, operationId, instanceId, timestamp, event, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      row.experimentId,
      row.operationId,
      row.instanceId,
      row.timestamp,
      row.event,
      row.metadata,
    );

    // wrangler tail と vitest の両方で読めるように、生の 1 行 JSON も出す。
    // 画面に出したものが、そのまま SQLite にも残る形にしている。
    console.log(JSON.stringify({ _evidence: true, ...row, metadata }));

    if (options.durable !== false) {
      // 「ディスクに書けた」ことを確定させる。
      // これを挟まずに ctx.abort() すると、直前の記録ごと消える可能性がある。
      await this.#storage.sync();
    }
  }

  /** 記録を読み出す。再起動後の検証はここから読む。 */
  read(experimentId?: string): RecoveryEvent[] {
    const cursor = experimentId
      ? this.#sql.exec(
          `SELECT * FROM exp_events WHERE experimentId = ? ORDER BY seq`,
          experimentId,
        )
      : this.#sql.exec(`SELECT * FROM exp_events ORDER BY seq`);

    return [...cursor].map((r) => ({
      seq: Number(r.seq),
      experimentId: String(r.experimentId),
      operationId: r.operationId === null ? null : String(r.operationId),
      instanceId: String(r.instanceId),
      timestamp: String(r.timestamp),
      event: String(r.event) as RecoveryEventName,
      metadata: JSON.parse(String(r.metadata)) as Record<string, unknown>,
    }));
  }

  /** 記録だけを消す。実験の作り直し用。Pi の `pi_` テーブルには触らない。 */
  reset(): void {
    this.#sql.exec(`DELETE FROM exp_events`);
  }
}
