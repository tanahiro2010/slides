/**
 * 偽モデルの応答スクリプト。
 *
 * pi-ai が同梱する `fauxProvider` を使う。
 * 自作の Provider より、ベンダー自身のテスト用実装に乗せた方が主張が強い。
 *
 * 応答は**耐久状態から組み立てる**。
 * メモリ上の位置に依存させると、Durable Object が再起動した時点で
 * スクリプトが頭に戻ってしまい、何を測っているのか分からなくなる。
 */

import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
  type FauxProviderHandle,
  type FauxResponseFactory,
} from "@earendil-works/pi-ai/providers/faux";
import type { Evidence } from "./evidence.ts";
import type { LabState } from "./state.ts";

export const FAUX_MODEL_ID = "faux/recovery-lab";

/** C20 用。Workers AI 経由の実モデル。 */
export const REAL_MODEL_ID = "@cf/zai-org/glm-4.7-flash";

/**
 * `agents@0.29.0` と `0.30.x` が実際に投げるストリーム断の文言。
 * C11 のバージョン対照は、この 2 つを撃ち分けて作る。
 */
export const STREAM_ERRORS = {
  /** 0.29.0。pi-ai の再試行判定に当たらない */
  old: "The stream ended before the model finished its answer.",
  /** 0.30.x。"ended without" に当たるので再試行される */
  new: "The stream ended without the model finishing its answer.",
  /** 0.29.0 のアイドル検出 */
  oldIdle: "Model stream stalled: no data received for 60s.",
  /** 0.30.x のアイドル検出。"timed? out" に当たる */
  newIdle: "Model stream timed out: no data received for 60s.",
  /** 対照: 明確に再試行対象外のもの */
  terminal: "insufficient_quota: the account has no remaining credit.",
} as const;

export type Scenario =
  | { kind: "answer"; text: string }
  | { kind: "call_tool"; tool: string; key: string; then: string }
  | { kind: "stream_error"; errorMessage: string; failures: number; then: string };

export function createFaux(deps: { state: LabState; evidence: Evidence }): FauxProviderHandle {
  const faux = fauxProvider({
    provider: "faux",
    api: "faux",
    models: [{ id: FAUX_MODEL_ID, name: "Recovery Lab", contextWindow: 128_000, maxTokens: 4096 }],
  });

  // 応答を 1 本の関数で決める。呼ばれるたびに耐久状態を読み直す。
  //
  // `setResponses` はキューなので、1 回呼ばれると空になる。
  // 1 ターンで終わらないシナリオ（ツール呼び出し → 結果 → 締め）を回すため、
  // 毎回自分を積み直して尽きないようにする。
  const step = async (
    _context: Parameters<FauxResponseFactory>[0],
    _options: Parameters<FauxResponseFactory>[1],
    state: Parameters<FauxResponseFactory>[2],
  ) => {
    faux.appendResponses([step]);
    {
      const raw = deps.state.get("scenario");
      const scenario: Scenario = raw ? JSON.parse(raw) : { kind: "answer", text: "ok" };
      const turn = await deps.state.bump("model:requests");

      await deps.evidence.record("model_request", {
        turn,
        fauxCallCount: state.callCount,
        scenario: scenario.kind,
      });

      switch (scenario.kind) {
        case "answer":
          return fauxAssistantMessage(scenario.text);

        case "call_tool": {
          // 1 回目はツールを呼び、ツール結果が戻ったら締める
          const calls = deps.state.counter(`model:called:${scenario.tool}`);
          if (calls === 0) {
            await deps.state.bump(`model:called:${scenario.tool}`);
            return fauxAssistantMessage(
              [fauxToolCall(scenario.tool, { key: scenario.key }, { id: `call-${scenario.key}` })],
              // `fauxAssistantMessage` の既定は "stop"。
              // ツール呼び出しブロックを積んでも、"toolUse" にしないと Pi は実行せずにターンを終える。
              { stopReason: "toolUse" },
            );
          }
          return fauxAssistantMessage(scenario.then);
        }

        case "stream_error": {
          const failed = deps.state.counter("model:failures");
          if (failed < scenario.failures) {
            await deps.state.bump("model:failures");
            await deps.evidence.record("model_error", {
              turn, failed: failed + 1, errorMessage: scenario.errorMessage,
            });
            return fauxAssistantMessage("", {
              stopReason: "error",
              errorMessage: scenario.errorMessage,
            });
          }
          return fauxAssistantMessage(scenario.then);
        }
      }
    }
  };

  faux.setResponses([step]);

  return faux;
}
