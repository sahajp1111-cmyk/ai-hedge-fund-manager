import type { ScanResult } from "./schema.js";
export type Job = {
  id: string;
  key: string;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  subject: string;
  error?: string;
  result?: ScanResult;
};
export type Alert = {
  id: string;
  key: string;
  fingerprint: string;
  createdAt: string;
  result: ScanResult;
  status: "pending" | "sent" | "disabled" | "failed" | "superseded";
  attempts: number;
  nextAttemptAt?: string;
  lastError?: string;
};
