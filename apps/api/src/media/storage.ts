import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface StoredObject {
  url: string;
  backend: "local" | "s3" | "telegram";
}

export async function storeObject(input: {
  id: string;
  bytes: Buffer;
  telegram?: { token?: string; chatId?: string };
  s3?: { endpoint?: string };
}): Promise<StoredObject> {
  if (input.telegram?.token && input.telegram.chatId) {
    return { url: `tg://${input.telegram.chatId}/${input.id}`, backend: "telegram" };
  }
  if (input.s3?.endpoint) {
    return { url: `${input.s3.endpoint.replace(/\/$/, "")}/${input.id}`, backend: "s3" };
  }
  const dir = join(tmpdir(), "lume-uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, input.id), input.bytes);
  return { url: `/uploads/${input.id}`, backend: "local" };
}
