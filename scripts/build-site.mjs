#!/usr/bin/env node
// ประกอบเว็บสำหรับ GitHub Pages: site/* + data/deals.json → dist/
import { cp, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
await rm(DIST, { recursive: true, force: true });
await cp(path.join(ROOT, "site"), DIST, { recursive: true });
await mkdir(path.join(DIST, "data"), { recursive: true });
await cp(path.join(ROOT, "data", "deals.json"), path.join(DIST, "data", "deals.json"));
console.log("built dist/ (site + data/deals.json)");
