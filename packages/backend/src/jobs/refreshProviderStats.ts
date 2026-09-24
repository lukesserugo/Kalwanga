// packages/backend/src/jobs/refreshProviderStats.ts
import { paymentService } from '../services/paymentService.js';
import { logger } from '../lib/logger.js';

export async function refreshProviderStatsJob() {
  let cursor: string | undefined = undefined;
  let totalProcessed = 0;
  let totalFailed = 0;

  // Drain the stale set one batch at a time, up to a hard cap so a
  // pathological backlog can't run forever inside one tick.
  for (let round = 0; round < 20; round++) {
    const result = await paymentService.updateProviderStats({
      batchSize: 50,
      concurrency: 8,
      cursorId: cursor,
    });

    totalProcessed += result.processed;
    totalFailed += result.failed;

    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }

  logger.info(
    `[cron] provider stats refreshed: ${totalProcessed} processed, ${totalFailed} failed`,
  );
}
