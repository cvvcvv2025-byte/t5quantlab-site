// Each paid attempt has a durable reservation. D1 batches are transactional.
export async function ensureBuilderLifecycle(env) {
  await env.BUILDER_DB.batch([
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS builder_operations (
      operation_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, action TEXT NOT NULL,
      grant_id TEXT NOT NULL, state TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
    env.BUILDER_DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_builder_operation_running
      ON builder_operations(project_id, action) WHERE state = 'reserved'`)
  ]);
}

export async function reserveOperation(env, access, projectId, action) {
  await ensureBuilderLifecycle(env);
  const column = action === 'modify' ? 'modify_remaining' : 'analyze_remaining';
  const id = crypto.randomUUID(), now = new Date().toISOString();
  // Both the project lock and debit are acquired in one transaction.
  const result = await env.BUILDER_DB.batch([
    env.BUILDER_DB.prepare(`INSERT INTO builder_operations
      (operation_id, project_id, action, grant_id, state, created_at, updated_at)
      SELECT ?, ?, ?, ?, 'reserved', ?, ? WHERE EXISTS (
        SELECT 1 FROM builder_access_grants WHERE grant_id = ? AND status = 'active'
        AND ${column} > 0 AND (expires_at IS NULL OR expires_at > ?))
      AND NOT EXISTS (SELECT 1 FROM builder_operations WHERE project_id = ? AND action = ? AND state IN ('reserved','completed'))`)
      .bind(id, projectId, action, access.grant_id, now, now, access.grant_id, now, projectId, action),
    env.BUILDER_DB.prepare(`UPDATE builder_access_grants SET ${column} = ${column} - 1, updated_at = ?
      WHERE grant_id = ? AND EXISTS (SELECT 1 FROM builder_operations WHERE operation_id = ? AND state = 'reserved')`)
      .bind(now, access.grant_id, id)
  ]);
  if (Number(result[0]?.meta?.changes || 0) === 1) return { id, projectId, action };
  const busy = await env.BUILDER_DB.prepare(`SELECT state FROM builder_operations
    WHERE project_id = ? AND action = ? AND state IN ('reserved','completed')`).bind(projectId, action).first();
  return { blocked: busy?.state || 'quota' };
}

export async function settleOperation(env, operation, success) {
  const now = new Date().toISOString();
  if (success) {
    await env.BUILDER_DB.prepare(`UPDATE builder_operations SET state = 'completed', updated_at = ?
      WHERE operation_id = ? AND state = 'reserved'`).bind(now, operation.id).run();
    return;
  }
  const column = operation.action === 'modify' ? 'modify_remaining' : 'analyze_remaining';
  await env.BUILDER_DB.batch([
    env.BUILDER_DB.prepare(`UPDATE builder_operations SET state = 'refunding', updated_at = ?
      WHERE operation_id = ? AND state = 'reserved'`).bind(now, operation.id),
    env.BUILDER_DB.prepare(`UPDATE builder_access_grants SET ${column} = ${column} + 1, updated_at = ?
      WHERE grant_id = (SELECT grant_id FROM builder_operations WHERE operation_id = ? AND state = 'refunding')`)
      .bind(now, operation.id),
    env.BUILDER_DB.prepare(`UPDATE builder_operations SET state = 'refunded', updated_at = ?
      WHERE operation_id = ? AND state = 'refunding'`).bind(now, operation.id)
  ]);
}

export async function reconcileBuilderOperations(env) {
  if (!env.BUILDER_DB) return;
  await ensureBuilderLifecycle(env);
  const cutoff = new Date(Date.now() - 15 * 60000).toISOString();
  const rows = await env.BUILDER_DB.prepare(`SELECT operation_id, project_id, action FROM builder_operations
    WHERE state = 'reserved' AND created_at < ? ORDER BY created_at LIMIT 40`).bind(cutoff).all();
  for (const row of rows.results || []) {
    const project = await env.BUILDER_DB.prepare(`SELECT r2_analysis_key, r2_modified_key, status FROM projects WHERE project_id = ?`)
      .bind(row.project_id).first();
    const key = row.action === 'analyze' ? project?.r2_analysis_key : project?.r2_modified_key;
    // Successful output survives a disconnected browser or a failed accounting response.
    const delivered = key && env.USER_CODE_BUCKET ? Boolean(await env.USER_CODE_BUCKET.head(key)) : false;
    await settleOperation(env, { id: row.operation_id, action: row.action }, delivered);
  }
}
