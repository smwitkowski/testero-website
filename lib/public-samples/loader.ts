import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { publicSamplesSchema } from "./schema";

export function getPublicSamples() {
  const file = join(process.cwd(), "content/public-samples/pmle.json");
  return publicSamplesSchema.parse(existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : []);
}
