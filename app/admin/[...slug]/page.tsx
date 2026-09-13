import { notFound } from 'next/navigation'

/** Unknown /admin/... paths render the admin 404 inside the sidebar layout. */
export default function AdminUnknownRoute() {
  notFound()
}
