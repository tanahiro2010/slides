/**
 * 検証用ツール。
 *
 * PRD の Tool A / Tool B に、C19 の対照を 2 本足した 4 本。
 *
 * | ツール | replay | 冪等 | 何を見るため |
 * | --- | --- | --- | --- |
 * | `write_record`        | safe   | はい   | C17: safe は再実行される |
 * | `bump_unsafe`         | 未指定 | いいえ | C16/C18: 既定は unsafe、再実行されない |
 * | `bump_safe_unguarded` | safe   | いいえ | **C19: safe を付けたが冪等でないツール** |
 * | `bump_safe_guarded`   | safe   | はい   | C19 の対照: 冪等キーがあれば 1 回に収まる |
 *
 * どのツールも「実行開始」「副作用の確定」「終了」を別々に数える。
 * 実行回数と副作用回数が食い違う瞬間が、この検証の中心にある。
 */

import { Type } from "@earendil-works/pi-ai";
import type { ToolRegistration } from "@earendil-works/pi-durable";
import type { Evidence } from "./evidence.ts";
import type { LabState } from "./state.ts";

const Args = Type.Object({
  /** 同じ呼び出しを識別する値。モデルに渡させる。 */
  key: Type.String(),
});

export type ToolDeps = {
  state: LabState;
  evidence: Evidence;
  /** `ctx.abort()` を撃つための口。DO 本体から渡す。 */
  abort: (reason: string) => void;
};

/**
 * 発火点で障害を撃つ。
 *
 * 撃つ前に発火回数を確定させてから撃つ。
 * `abort` のあとに走るコードは無いので、順番を逆にすると回数が残らない。
 */
async function maybeFault(deps: ToolDeps, at: string): Promise<void> {
  const fault = await deps.state.claimFault(at);
  if (!fault) return;

  await deps.evidence.record("fault_injected", { at, mode: fault.mode, fired: fault.fired });

  switch (fault.mode) {
    case "abort":
      // catch できない本物のリセット。例外送出とは別物。
      deps.abort(`fault:${fault.id}:${at}`);
      // ここには到達しない
      throw new Error("unreachable");
    case "throw":
      throw new Error(`injected throw at ${at}`);
    default:
      // ストレージ系はここでは撃たない（storage.ts が持つ）
      return;
  }
}

export function createLabTools(deps: ToolDeps): ToolRegistration<typeof Args>[] {
  const { state, evidence } = deps;

  /** 冪等な書き込み。何度やっても結果が同じ。 */
  const writeRecord: ToolRegistration<typeof Args> = {
    name: "write_record",
    description: "Write a fixed record. Running it twice leaves the same result.",
    parameters: Args,
    replay: "safe",
    async execute({ key }) {
      await state.bump("write_record:started");
      await evidence.record("tool_started", { tool: "write_record", key });
      await maybeFault(deps, "write_record:before_commit");

      state.put(`record:${key}`, "written");
      await state.bump("write_record:committed");
      await evidence.record("tool_committed", { tool: "write_record", key });
      await maybeFault(deps, "write_record:after_commit");

      await state.bump("write_record:finished");
      await evidence.record("tool_finished", { tool: "write_record", key });
      return { output: [{ type: "text", text: `written:${key}` }] };
    },
  };

  /** 既定の unsafe。`replay` を書かないことが unsafe の指定そのもの。 */
  const bumpUnsafe: ToolRegistration<typeof Args> = {
    name: "bump_unsafe",
    description: "Add one to a counter. Running it twice changes the result.",
    parameters: Args,
    // replay を書かない = unsafe（C16）
    async execute({ key }) {
      await state.bump("bump_unsafe:started");
      await evidence.record("tool_started", { tool: "bump_unsafe", key });
      await maybeFault(deps, "bump_unsafe:before_commit");

      const value = await state.bump("side_effect:bump_unsafe");
      await evidence.record("tool_committed", { tool: "bump_unsafe", key, value });
      await maybeFault(deps, "bump_unsafe:after_commit");

      await state.bump("bump_unsafe:finished");
      await evidence.record("tool_finished", { tool: "bump_unsafe", key, value });
      return { output: [{ type: "text", text: `counter=${value}` }] };
    },
  };

  /**
   * C19 の本命。
   * safe を宣言しているが冪等ではない。公式の言う「running it twice is harmless」を破っている。
   */
  const bumpSafeUnguarded: ToolRegistration<typeof Args> = {
    name: "bump_safe_unguarded",
    description: "Add one to a counter. Declared replay-safe even though it is not idempotent.",
    parameters: Args,
    replay: "safe",
    async execute({ key }) {
      await state.bump("bump_safe_unguarded:started");
      await evidence.record("tool_started", { tool: "bump_safe_unguarded", key });
      await maybeFault(deps, "bump_safe_unguarded:before_commit");

      const value = await state.bump("side_effect:bump_safe_unguarded");
      await evidence.record("tool_committed", { tool: "bump_safe_unguarded", key, value });
      await maybeFault(deps, "bump_safe_unguarded:after_commit");

      await state.bump("bump_safe_unguarded:finished");
      await evidence.record("tool_finished", { tool: "bump_safe_unguarded", key, value });
      return { output: [{ type: "text", text: `counter=${value}` }] };
    },
  };

  /** C19 の対照。同じ safe でも、冪等キーを見れば副作用は 1 回に収まるはず。 */
  const bumpSafeGuarded: ToolRegistration<typeof Args> = {
    name: "bump_safe_guarded",
    description: "Add one to a counter, guarded by an idempotency key.",
    parameters: Args,
    replay: "safe",
    async execute({ key }) {
      await state.bump("bump_safe_guarded:started");
      await evidence.record("tool_started", { tool: "bump_safe_guarded", key });
      await maybeFault(deps, "bump_safe_guarded:before_commit");

      const guard = `guard:bump_safe_guarded:${key}`;
      let value = state.counter("side_effect:bump_safe_guarded");
      if (state.get(guard) === undefined) {
        state.put(guard, "done");
        value = await state.bump("side_effect:bump_safe_guarded");
        await evidence.record("tool_committed", { tool: "bump_safe_guarded", key, value });
      } else {
        await evidence.record("observed", {
          tool: "bump_safe_guarded", key, note: "guard hit: side effect skipped",
        });
      }
      await maybeFault(deps, "bump_safe_guarded:after_commit");

      await state.bump("bump_safe_guarded:finished");
      await evidence.record("tool_finished", { tool: "bump_safe_guarded", key, value });
      return { output: [{ type: "text", text: `counter=${value}` }] };
    },
  };

  return [writeRecord, bumpUnsafe, bumpSafeUnguarded, bumpSafeGuarded];
}
