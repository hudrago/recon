"use server";

import { apiFetch } from "@/lib/api";

export async function deleteOrganization(orgId: string, confirmation: string) {
  const response = await apiFetch(`/orgs/${encodeURIComponent(orgId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation }),
  });
  if (response.ok) return {};
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
  };
  return { error: body.message ?? `HTTP ${response.status}` };
}

export interface CarrierCsvResult {
  accepted: number;
  exceptionsCreated: number;
  errors: string[];
}

export async function uploadCarrierCsv(
  orgId: string,
  csv: string,
): Promise<{ data?: CarrierCsvResult; error?: string }> {
  const response = await apiFetch(
    `/orgs/${encodeURIComponent(orgId)}/ingest/carrier-csv`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    },
  );
  if (!response.ok) return { error: `HTTP ${response.status}` };
  return { data: (await response.json()) as CarrierCsvResult };
}