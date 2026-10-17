import { expect, it, vi } from "vitest";
import { ServerTiming } from "@/lib/server-timing";
it("records successful and failed numeric durations without task values", async () => {
  const clock = vi.spyOn(performance, "now").mockReturnValue(10);
  const timing = new ServerTiming();
  clock.mockReturnValue(15);
  expect(await timing.measure("ownership", () => "secret-owner")).toBe("secret-owner");
  await expect(timing.measure("rpc", () => { throw new Error("secret-query"); })).rejects.toThrow("secret-query");
  expect(timing.header()).toMatch(/^ownership;dur=0.0, rpc;dur=0.0, total;dur=5.0$/);
  clock.mockRestore();
});
