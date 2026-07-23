import { requirePermission } from '@/lib/session'
import { APP_VERSION } from '@/lib/app-version'
import { UpdatesPanel } from '@/components/updates/updates-panel'

export const dynamic = 'force-dynamic'

const REPO = 'vasdko4/universal-crm-ua'

type LatestRelease = {
  version: string
  htmlUrl: string
} | null

async function fetchLatestRelease(): Promise<LatestRelease> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      // Releases are cut a few times a week at most — a short cache keeps
      // repeat page loads from hammering the GitHub API.
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { tag_name?: string; html_url?: string }
    if (!data.tag_name) return null
    return { version: data.tag_name, htmlUrl: data.html_url ?? `https://github.com/${REPO}/releases` }
  } catch {
    return null
  }
}

export default async function UpdatesPage() {
  await requirePermission('system_updates')

  const currentVersion = APP_VERSION
  const latest = await fetchLatestRelease()
  const updaterConfigured = Boolean(process.env.UPDATER_URL && process.env.UPDATER_SECRET)

  return (
    <UpdatesPanel
      currentVersion={currentVersion}
      latestVersion={latest?.version ?? null}
      changelogUrl={latest?.htmlUrl ?? `https://github.com/${REPO}/releases`}
      updaterConfigured={updaterConfigured}
    />
  )
}
