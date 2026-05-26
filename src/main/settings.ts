import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface AppSettings {
  lastOpenDir: string;
  lastSaveDir: string;
}

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

function load(): AppSettings {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    return { lastOpenDir: '', lastSaveDir: '', ...JSON.parse(raw) };
  } catch {
    return { lastOpenDir: '', lastSaveDir: '' };
  }
}

function save(data: AppSettings): void {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Non-critical — silently ignore write errors
  }
}

export function getLastOpenDir(): string {
  return load().lastOpenDir;
}

export function setLastOpenDir(dir: string): void {
  const data = load();
  data.lastOpenDir = dir;
  save(data);
}

export function getLastSaveDir(): string {
  return load().lastSaveDir;
}

export function setLastSaveDir(dir: string): void {
  const data = load();
  data.lastSaveDir = dir;
  save(data);
}
