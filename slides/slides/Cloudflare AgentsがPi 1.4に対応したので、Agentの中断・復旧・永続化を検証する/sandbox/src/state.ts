/**
 * 耐久状態。
 *
 * 障害注入の計画とカウンタを、Pi の replay の外側に置く。
 * Pi のテーブル（`pi_` 接頭辞）とは別の表に入れるので、
 * タスクが巻き戻っても、ここの数字は巻き戻らない。
 * **「何回実行されたか」と「副作用が何回確定したか」を別々に数えるのが目的。**
 */

const DDL = `
CREATE TABLE IF NOT EXISTS exp_faults (
  id      TEXT PRIMARY KEY,
  at      TEXT NOT NULL,
  mode    TEXT NOT NULL,
  times   INTEGER NOT NULL,
  fired   INTEGER NOT NULL DEFAULT 0,
  armed   INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS exp_counters (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS exp_kv (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`;

/** 障害注入の種類。例外送出と本物のリセットを区別するために分けている。 */
export type FaultMode =
  | "abort"                 // ctx.abort(): 本物のリセット。catch できない
  | "throw"                 // 単なる例外。対照用（これでは parked にならないはず）
  | "storage_commit_error"  // commit() から投げる。仕様上は致命的
  | "storage_read_error";   // 読み取りから投げる。仕様上はその読みだけ失敗

export type FaultPlan = {
  id: string;
  /** 発火点のラベル。ツール側・ストレージ側が自分で名乗る。 */
  at: string;
  mode: FaultMode;
  /** 何回まで発火させるか。`restartLimit` の検証で効く。 */
  times: number;
  fired: number;
  armed: boolean;
};

export class LabState {
  #sql: SqlStorage;
  #storage: DurableObjectStorage;

  constructor(storage: DurableObjectStorage) {
    this.#storage = storage;
    this.#sql = storage.sql;
    this.#sql.exec(DDL);
  }

  // --- 障害注入 ---

  arm(plan: Omit<FaultPlan, "fired" | "armed">): void {
    this.#sql.exec(
      `INSERT INTO exp_faults (id, at, mode, times, fired, armed) VALUES (?, ?, ?, ?, 0, 1)
       ON CONFLICT(id) DO UPDATE SET at = excluded.at, mode = excluded.mode,
                                     times = excluded.times, fired = 0, armed = 1`,
      plan.id, plan.at, plan.mode, plan.times,
    );
  }

  /** 障害条件を解除する。C27（retry 後に完了するか）で使う。 */
  disarm(id?: string): void {
    if (id) this.#sql.exec(`UPDATE exp_faults SET armed = 0 WHERE id = ?`, id);
    else this.#sql.exec(`UPDATE exp_faults SET armed = 0`);
  }

  plans(): FaultPlan[] {
    return [...this.#sql.exec(`SELECT * FROM exp_faults ORDER BY id`)].map((r) => ({
      id: String(r.id),
      at: String(r.at),
      mode: String(r.mode) as FaultMode,
      times: Number(r.times),
      fired: Number(r.fired),
      armed: Number(r.armed) === 1,
    }));
  }

  /**
   * この発火点で撃つべき障害を 1 つ返し、発火回数を**先に**確定させる。
   *
   * 先に数えるのが肝心で、`ctx.abort()` のあとに数える経路は存在しない。
   * 数えてから `sync()` し、そのあとで撃つ。
   */
  async claimFault(at: string): Promise<FaultPlan | undefined> {
    const row = [...this.#sql.exec(
      `SELECT * FROM exp_faults WHERE at = ? AND armed = 1 AND fired < times LIMIT 1`,
      at,
    )][0];
    if (!row) return undefined;

    this.#sql.exec(`UPDATE exp_faults SET fired = fired + 1 WHERE id = ?`, String(row.id));
    await this.#storage.sync();

    return {
      id: String(row.id),
      at: String(row.at),
      mode: String(row.mode) as FaultMode,
      times: Number(row.times),
      fired: Number(row.fired) + 1,
      armed: true,
    };
  }

  // --- カウンタ ---

  /** 加算して、確定後の値を返す。`sync` を挟むので、クラッシュしても残る。 */
  async bump(name: string, by = 1): Promise<number> {
    this.#sql.exec(
      `INSERT INTO exp_counters (name, value) VALUES (?, ?)
       ON CONFLICT(name) DO UPDATE SET value = value + ?`,
      name, by, by,
    );
    await this.#storage.sync();
    return this.counter(name);
  }

  counter(name: string): number {
    const row = [...this.#sql.exec(`SELECT value FROM exp_counters WHERE name = ?`, name)][0];
    return row ? Number(row.value) : 0;
  }

  counters(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const r of this.#sql.exec(`SELECT name, value FROM exp_counters ORDER BY name`)) {
      out[String(r.name)] = Number(r.value);
    }
    return out;
  }

  // --- 小さな KV（冪等キーなど） ---

  put(key: string, value: string): void {
    this.#sql.exec(
      `INSERT INTO exp_kv (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key, value,
    );
  }

  get(key: string): string | undefined {
    const row = [...this.#sql.exec(`SELECT value FROM exp_kv WHERE key = ?`, key)][0];
    return row ? String(row.value) : undefined;
  }

  /** 実験ごとの作り直し。Pi のテーブルには触らない。 */
  reset(): void {
    this.#sql.exec(`DELETE FROM exp_faults`);
    this.#sql.exec(`DELETE FROM exp_counters`);
    this.#sql.exec(`DELETE FROM exp_kv`);
  }

  /** `pi_` で始まる表を数える。C04 の確認に使う。 */
  tables(): { pi: string[]; own: string[] } {
    const names = [...this.#sql.exec(
      `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    )].map((r) => String(r.name));
    return {
      pi: names.filter((n) => n.startsWith("pi_")),
      own: names.filter((n) => !n.startsWith("pi_")),
    };
  }
}
