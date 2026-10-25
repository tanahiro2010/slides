/**
 * Storage のラッパ。EXP-06（C30〜C34）用。
 *
 * `Storage` は 17 メソッドの構造的インターフェースなので、同じ形のオブジェクトを返せば通る。
 * ここで撃ち分けるのは 3 つの境界。
 *
 * | 撃つ場所 | 仕様上の扱い |
 * | --- | --- |
 * | `commit()` から任意のエラー | 致命的。Session が死ぬ |
 * | 読み取りから `StorageRequestError` | その読みだけ失敗。Session は生きる |
 * | 読み取りから任意のエラー | 致命的。Session が死ぬ |
 *
 * 3 つを別々に撃てないと、C31 と C34 が区別できない。
 */

import { StorageRequestError } from "@earendil-works/pi-durable";
import type { Storage } from "@earendil-works/pi-durable";
import type { Evidence } from "./evidence.ts";
import type { LabState } from "./state.ts";

const READ_METHODS = new Set([
  "conversation", "scanConversations", "entry", "findLatestHeadMarker",
  "scanEntries", "task", "scanTasks", "submission", "scanSubmissions",
  "submissionByRequest", "findDocument", "document", "scanDocuments",
]);

export function wrapStorage(
  inner: Storage,
  deps: { state: LabState; evidence: Evidence },
): Storage {
  return new Proxy(inner, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function" || typeof prop !== "string") return value;

      return async (...args: unknown[]) => {
        const isRead = READ_METHODS.has(prop);
        const at = `storage:${prop}`;

        // 発火点は「メソッド名」と「読み書きの別」の両方で引ける
        const fault =
          (await deps.state.claimFault(at)) ??
          (await deps.state.claimFault(isRead ? "storage:read" : "storage:write"));

        if (fault) {
          await deps.evidence.record("fault_injected", {
            at, method: prop, isRead, mode: fault.mode, fired: fault.fired,
          });
          if (fault.mode === "storage_read_error") {
            // 仕様上はこの読みだけが失敗し、Session は生き残るはず（C34）
            throw new StorageRequestError(`injected read fault at ${prop}`);
          }
          if (fault.mode === "storage_commit_error") {
            // 仕様上は致命的（C31）
            throw new Error(`injected storage fault at ${prop}`);
          }
        }

        try {
          return await (value as (...a: unknown[]) => Promise<unknown>).apply(target, args);
        } catch (error) {
          await deps.evidence.record("storage_error", {
            method: prop,
            isRead,
            message: error instanceof Error ? error.message : String(error),
            name: error instanceof Error ? error.name : "unknown",
          });
          throw error;
        }
      };
    },
  }) as Storage;
}
