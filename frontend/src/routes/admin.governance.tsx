import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getGovernanceRequests, voteGovernanceAction, GovernanceRequest } from "@/lib/governance.functions";
import { useIsAdmin } from "@/lib/auth";

export const Route = createFileRoute("/admin/governance")({
  component: GovernanceDashboard,
});

function GovernanceDashboard() {
  const qc = useQueryClient();
  const { user } = useIsAdmin();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["governance-requests"],
    queryFn: ({ signal }) => getGovernanceRequests({ signal }),
  });

  const voteMutation = useMutation({
    mutationFn: ({ id, vote }: { id: string; vote: "APPROVE" | "REJECT" }) =>
      voteGovernanceAction(id, vote),
    onSuccess: (res) => {
      if (res.data.executed) {
        toast.success("Vote submitted and action executed!");
      } else {
        toast.success("Vote submitted successfully.");
      }
      qc.invalidateQueries({ queryKey: ["governance-requests"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to vote"),
  });

  if (isLoading) return <div className="p-4">Loading governance data...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Governance & Security</h2>
        <p className="text-muted-foreground mt-1">
          Review and vote on critical governance actions — superadmin deletions require unanimous approval from all other superadmins.
        </p>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No governance requests pending or executed.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((req: GovernanceRequest) => {
            const hasVoted = req.votes?.some((v) => v.voter.id === user?.id);
            const isRequester = req.requester.id === user?.id;

            // Redact raw payload to avoid exposing secrets like API keys
            let redactedPayload = "Redacted payload for security";
            if (req.action_type === "DELETE_SUPERADMIN") redactedPayload = `Target ID: ${req.target_id}`;
            if (req.action_type === "MODIFY_API_KEYS") redactedPayload = "API key modification request";

            return (
              <Card key={req.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {req.action_type === "DELETE_SUPERADMIN" && "Delete Superadmin"}
                      {req.action_type === "MODIFY_API_KEYS" && "Modify API Keys"}
                      {req.action_type !== "DELETE_SUPERADMIN" && req.action_type !== "MODIFY_API_KEYS" && req.action_type}
                      <Badge variant={req.status === "PENDING" ? "default" : req.status === "EXECUTED" ? "success" : "secondary"}>
                        {req.status}
                      </Badge>
                    </CardTitle>
                    <div className="text-sm text-muted-foreground">
                      Requested by: <strong>{req.requester.name}</strong>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted p-3 rounded-md text-sm font-mono">
                    {req.display_payload ? JSON.stringify(req.display_payload, null, 2) : redactedPayload}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <strong>Approvals:</strong> {req.approvals} / {req.required_approvals}
                    </div>
                    <div>
                      <strong>Expires:</strong> {new Date(req.expires_at).toLocaleString()}
                    </div>
                  </div>

                  {req.status === "PENDING" && !isRequester && !hasVoted && (
                    <div className="flex gap-2 pt-2">
                      <Button 
                        variant="default" 
                        className="bg-green-600 hover:bg-green-700"
                        disabled={voteMutation.isPending}
                        onClick={() => voteMutation.mutate({ id: req.id, vote: "APPROVE" })}
                      >
                        Approve
                      </Button>
                      <Button 
                        variant="destructive"
                        disabled={voteMutation.isPending}
                        onClick={() => voteMutation.mutate({ id: req.id, vote: "REJECT" })}
                      >
                        Reject
                      </Button>
                    </div>
                  )}

                  {req.status === "PENDING" && isRequester && (
                    <p className="text-sm text-muted-foreground">
                      You cannot vote on your own proposal. Waiting for other superadmins.
                    </p>
                  )}
                  {req.status === "PENDING" && !isRequester && hasVoted && (
                    <p className="text-sm text-muted-foreground">
                      You have already voted on this proposal.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
