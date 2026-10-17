/**
 * Cron job registry for the admin Cron tab and the in-process scheduler.
 *
 * The 6 jobs below are also declared in vercel.json (for Vercel Cron) and
 * exposed as GET /api/cron/<id> endpoints (CRON_SECRET protected). On the
 * Docker VPS there is no Vercel Cron, so lib/cron/scheduler.ts ticks every
 * minute and triggers due jobs over HTTP to localhost.
 *
 * prom-sync is NOT in this registry: it has its own settings-driven
 * scheduler (lib/prom/scheduler.ts) with a user-configurable interval and
 * token check. The admin Cron tab shows it as a linked read-only row.
 */

export type CronJobDef = {
  /** Matches the /api/cron/<id> route and the cron_jobs.id row. */
  id: string
  /** How often the job should run. */
  intervalMs: number
  /** i18n keys under admin.cronJobs.<id> */
  nameKey: string
  descKey: string
}

const HOUR = 3_600_000
const DAY = 24 * HOUR

export const CRON_JOBS: CronJobDef[] = [
  {
    id: 'delivery-sync',
    intervalMs: DAY,
    nameKey: 'deliverySyncName',
    descKey: 'deliverySyncDesc',
  },
  {
    id: 'analytics-retention',
    intervalMs: DAY,
    nameKey: 'analyticsRetentionName',
    descKey: 'analyticsRetentionDesc',
  },
  {
    id: 'expire-pending',
    intervalMs: DAY,
    nameKey: 'expirePendingName',
    descKey: 'expirePendingDesc',
  },
  {
    id: 'anomaly-alert',
    intervalMs: DAY,
    nameKey: 'anomalyAlertName',
    descKey: 'anomalyAlertDesc',
  },
  {
    id: 'db-backup',
    intervalMs: DAY,
    nameKey: 'dbBackupName',
    descKey: 'dbBackupDesc',
  },
]

export const CRON_JOB_IDS = CRON_JOBS.map((j) => j.id)
