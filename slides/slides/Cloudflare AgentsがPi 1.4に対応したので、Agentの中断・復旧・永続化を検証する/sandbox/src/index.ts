/**
 * シナリオの入口。
 *
 * エンドポイントは claims.md の C 番号に対応させている。
 * 対照は**同じシナリオの中**に並べる。別々に叩くと条件が揃わない。
 *
 * ここから触れるのは `RecoveryLab` が明示的に生やした RPC メソッドだけ。
 * ネストしたプロパティ越しの呼び出しは DO の RPC を通らない。
 */

import { RecoveryLab } from "./agent.ts";

export { RecoveryLab };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // 実験ごとに Durable Object を分ける。
    // C41（Pi 1.4 のマイグレーションは一方向）があるので、名前を使い回さない。
    const lab = env.LAB.getByName(url.searchParams.get("lab") ?? "default");
    const body =
      request.method === "POST"
        ? ((await request.json().catch(() => ({}))) as Record<string, unknown>)
        : {};

    try {
      switch (url.pathname) {
        // --- 土台 ---
        case "/info":
          return json(await lab.info());
        case "/events":
          return json(await lab.readEvents(url.searchParams.get("exp") ?? undefined));
        case "/counters":
          return json(await lab.readCounters());
        case "/tables": // C04
          return json(await lab.readTables());
        case "/reset":
          return json(await lab.resetLab());

        // --- 障害注入 ---
        case "/arm":
          return json(
            await lab.armFault({
              id: String(body.id ?? "f1"),
              at: String(body.at),
              mode: String(body.mode ?? "abort"),
              times: Number(body.times ?? 1),
            }),
          );
        case "/disarm":
          return json(await lab.disarmFault(body.id ? String(body.id) : undefined));
        case "/settings":
          return json(
            await lab.putSettings(
              Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v)])),
            ),
          );
        case "/scenario":
          return json(await lab.setScenario(body));
        case "/real-model": // C20。実モデルに切り替える
          return json(await lab.useRealModel(body.model ? String(body.model) : undefined));

        // --- 土台の検証 ---
        case "/c01":
          // 戻らない。呼び出し側には例外として見える。
          await lab.probeC01(url.searchParams.get("sync") !== "off");
          return json({ unreachable: true });
        case "/c02":
          return json(await lab.probeC02());

        // --- Pi の操作 ---
        case "/submit":
          return json(
            await lab.piSubmit(
              String(body.text ?? "go"),
              body.operationId ? String(body.operationId) : undefined,
            ),
          );
        case "/wait": {
          const op = url.searchParams.get("op");
          if (!op) return json({ error: "op required" }, 400);
          return json(await lab.piWait(op));
        }
        case "/pending":
          return json(await lab.piPending());
        case "/messages":
          return json(await lab.piMessages());
        case "/transcript":
          return json(await lab.piTranscript());
        case "/retry": // C27
          return json(await lab.piRetry());
        case "/abort": // C28
          return json(await lab.piAbort());

        default:
          return json({ error: "unknown route", path: url.pathname }, 404);
      }
    } catch (error) {
      // 例外も観測結果なので握りつぶさずに返す。
      // リセットを撃った直後は、ここに来るのが正しい挙動。
      return json(
        {
          threw: true,
          name: error instanceof Error ? error.name : "unknown",
          message: error instanceof Error ? error.message : String(error),
        },
        200,
      );
    }
  },
} satisfies ExportedHandler<Env>;
