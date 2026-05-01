import { promises as fs } from "fs";
import path from "path";

const dir = process.env.AUDIO_STORAGE_DIR ?? "./.audio";

export async function saveAudio(filename: string, buf: ArrayBuffer) {
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, Buffer.from(buf));
  return filePath;
}

export async function readAudio(filename: string): Promise<Buffer> {
  return fs.readFile(path.join(dir, filename));
}

export async function audioExists(filename: string) {
  try {
    await fs.access(path.join(dir, filename));
    return true;
  } catch {
    return false;
  }
}
