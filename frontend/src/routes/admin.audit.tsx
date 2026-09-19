import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, Loader2 } from "lucide-react";
import { fetchAPI } from "@/lib/db";
import { useIsAdmin } from "@/lib/auth";
import { useState } from "react";

export const Route = createFileRoute("/admin/audit")({
  component: AuditLogsPage,
});

function AuditLogsPage() {
  const { isSuperAdmin } = useIsAdmin();
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page],
    queryFn: () => fetchAPI(`/audit-logs?page=${page}`),
    enabled: isSuperAdmin,
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  if (!isSuperAdmin) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <ShieldAlert className="size-12 text-destructive" />
        <h2 className="font-display text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">Only Superadmins can view the audit logs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold">Audit Logs</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor destructive actions and important configuration changes.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="glass overflow-x-auto rounded-3xl">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Table / Entity</th>
                <th className="px-4 py-3">Record ID</th>
                <th className="px-4 py-3">Admin</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => (
                  <tr
                    key={log.id}
                    className="border-t border-border/60 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 font-medium text-destructive">
                      {log.action}
                    </td>
                    <td className="px-4 py-3">{log.table}</td>
                    <td className="px-4 py-3 font-mono text-xs opacity-75">{log.recordId}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span>{log.adminEmail}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md bg-secondary px-3 py-1 text-sm font-medium disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md bg-secondary px-3 py-1 text-sm font-medium disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
