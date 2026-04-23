import { AdminAgentEditor } from "./AdminAgentEditor";
import styles from "./admin.module.css";
import { listEditableEntries } from "@/lib/admin-agents";
import { env } from "@/lib/config";
import { getPipelineConfig } from "@/lib/pipeline-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminPageProps = {
  searchParams?: Promise<{ token?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const token = params?.token ?? "";
  const hasAccess = env.adminToken ? token === env.adminToken : env.pipelineEnv !== "prod";
  const initialAgents = hasAccess ? await listEditableEntries() : [];
  const initialFlows = hasAccess ? getPipelineConfig() : [];
  return (
    <main className={styles.admin}>
      <header className={styles.hero}>
        <p>Agent Control</p>
        <h1>Edit landing agents from the web.</h1>
        <span>
          Agent Markdown and system prompts (including Roxom Editorial + Stitch Design System) are saved outside the compiled app and applied to new runs immediately.
        </span>
      </header>
      <AdminAgentEditor initialToken={token} initialAgents={initialAgents} initialFlows={initialFlows} />
    </main>
  );
}
