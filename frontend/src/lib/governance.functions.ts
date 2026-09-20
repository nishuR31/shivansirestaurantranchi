import { fetchAPI } from "./db";

export type GovernanceVote = {
  id: string;
  voter: {
    id: string;
    name: string;
    email: string;
  };
  vote: "APPROVE" | "REJECT";
  created_at: string;
};

export type GovernanceRequest = {
  id: string;
  requester: {
    id: string;
    name: string;
    email: string;
  };
  action_type: string;
  target_id: string | null;
  status: string;
  approvals: number;
  required_approvals: number;
  expires_at: string;
  votes: GovernanceVote[];
  display_payload?: unknown;
};

export type GovernanceApiResponse = {
  success: boolean;
  message: string;
  data: {
    requests: GovernanceRequest[];
  };
};

export const getGovernanceRequests = async (opts?: { signal?: AbortSignal }) => {
  const res = await fetchAPI<GovernanceApiResponse>("/governance/", { signal: opts?.signal });
  return res.data?.requests || [];
};

export const proposeGovernanceAction = async (payload: { action_type: string, target_id?: string, payload?: unknown }) => {
  const res = await fetchAPI<{ success: boolean; data: { request: GovernanceRequest } }>("/governance/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res;
};

export const voteGovernanceAction = async (requestId: string, vote: "APPROVE" | "REJECT") => {
  const res = await fetchAPI<{ success: boolean; data: { executed: boolean; rejected: boolean } }>(`/governance/${requestId}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vote })
  });
  return res;
};
