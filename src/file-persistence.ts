import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";

const defaultPath = "./cfg/";

export function read<T>(fromFile: string): T {
  try {
    const file = readFileSync(`${defaultPath}${fromFile}`);
    const content = JSON.parse(String(file));
    return content;
  } catch (e) {
    return null;
  }
}

export function write<T>(content: T, toFile: string): void {
  try {
    mkdirSync(defaultPath, { recursive: true });
    writeFileSync(
      `${defaultPath}${toFile}`,
      JSON.stringify(content, undefined, 2)
    );
  } catch (e) {
    // noting to do..
  }
}

export function removeFile(file: string): void {
  try {
    unlinkSync(`${defaultPath}${file}`);
  } catch (e) {
    // noting to do..
  }
}
