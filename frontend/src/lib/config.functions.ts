import { z } from "zod";
import { fetchAPI } from "@/lib/db";

const saveSchema = z.object({
  ownerEmail: z.string().trim().email().max(120),
  whatsappToken: z.string().trim().max(600).optional(),
  whatsappPhoneNumberId: z.string().trim().max(60),
});

export const getAppConfig = async (opts?: { signal?: AbortSignal }) => {
  const data = await fetchAPI<{
    ownerEmail: string;
    whatsappPhoneNumberId: string;
    whatsappToken: string;
  }>("/settings/owner", { signal: opts?.signal });
  return {
    ownerEmail: data.ownerEmail,
    whatsappPhoneNumberId: data.whatsappPhoneNumberId,
    whatsappTokenSet: Boolean(data.whatsappToken),
  };
};

export const saveAppConfig = async (input: unknown) => {
  const data = saveSchema.parse(input);
  await fetchAPI("/settings/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return { ok: true };
};

const settingsSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  tagline: z.string().trim().max(200),
  address: z.string().trim().max(300),
  phone: z.string().trim().max(30),
  gst_number: z.string().trim().max(40),
  upi_id: z.string().trim().max(120),
  opening_time: z.string().trim().max(10),
  closing_time: z.string().trim().max(10),
  tax_percent: z.number().min(0).max(50),
  packing_charge: z.number().min(0).max(10000),
  delivery_charge: z.number().min(0).max(10000),
  currency: z.string().trim().max(4),
});

export const getOwnerSettings = async (opts?: { signal?: AbortSignal }) => {
  const settings = await fetchAPI<any>("/settings", { signal: opts?.signal });
  return settings;
};

export const saveOwnerSettings = async (input: unknown) => {
  const data = settingsSchema.parse(input);
  await fetchAPI("/crud/restaurant_settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return { ok: true };
};

/* ── Lockdown API ── */

export const enableLockdown = async (payload: {
  shutdown_code: number;
  shutdown_message: string;
  lockdown_password: string;
}) => {
  const res = await fetchAPI<{ success: boolean; message: string }>("/settings/lockdown/enable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res;
};

export const disableLockdown = async (payload: {
  lockdown_password: string;
}) => {
  const res = await fetchAPI<{ success: boolean; message: string }>("/settings/lockdown/disable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res;
};
