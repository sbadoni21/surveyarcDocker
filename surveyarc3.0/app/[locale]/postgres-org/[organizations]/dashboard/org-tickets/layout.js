'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useMemo, useEffect } from 'react'
import { useUser } from '@/providers/postGresPorviders/UserProvider'

export default function OrgTicketsLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useUser()
  const role = user?.role?.toLowerCase() || null

  // Extract base path (language + postgres-org + orgId + dashboard)
  const basePath = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean)
    const dashboardIndex = segments.findIndex(s => s === 'dashboard')
    if (dashboardIndex !== -1) {
      return '/' + segments.slice(0, dashboardIndex + 1).join('/')
    }
    return ''
  }, [pathname])

  const allTabs = [
    { name: 'Business Calendars', path: 'business-calendars', roles: ['owner', 'admin', 'manager'] },
    { name: 'Tickets', path: 'tickets', roles: ['owner', 'admin', 'manager','user', 'team_lead'] },
    { name: 'Category Management', path: 'category-management', roles: ['owner', 'admin', 'manager'] },
    { name: 'My Group Tickets', path: 'my-group-tickets', roles: ['owner', 'admin', 'manager', 'team_lead'] },
    { name: 'Routing', path: 'routing', roles: ['owner', 'admin', 'manager'] },
    { name: 'SLA', path: 'sla', roles: ['owner', 'admin'] },
    { name: 'Support Groups', path: 'support-groups', roles: ['owner', 'admin'] },
    { name: 'Tags', path: 'tags', roles: ['owner', 'admin', 'manager'] },
    { name: 'External Apis', path: 'create-apis', roles: ['owner', 'admin', 'manager'] },
    { name: 'Agent Tickets', path: 'agent-tickets', roles: ['owner', 'admin', 'manager', 'team_lead', 'agent'] },
    { name: 'Team Lead', path: 'team-lead', roles: ['owner', 'admin', 'team_lead'] },
  ]

  const visibleTabs = useMemo(() => {
    if (!role) return []
    return allTabs.filter(tab => tab.roles.includes(role.toLowerCase()))
  }, [role])

  // Find the segment immediately after "org-tickets"
  const tabSegment = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean)
    const idx = segments.findIndex(s => s === 'org-tickets')
    if (idx !== -1) {
      return segments.length > idx + 1 ? segments[idx + 1] : '' // '' means no tab segment present
    }
    // if 'org-tickets' not found, fallback to last segment
    const last = segments[segments.length - 1] || ''
    return last
  }, [pathname])

  // Heuristic to detect an "id" (ticket id / calendar id). Adjust regex if you have strict formats.
  const looksLikeId = useMemo(() => {
    if (!tabSegment) return false
    // common patterns: contains underscore (tkt_...), long random hex, or purely numeric id
    if (tabSegment.includes('_')) return true
    if (/^[0-9a-f]{8,}$/i.test(tabSegment)) return true
    if (/^\d{4,}$/.test(tabSegment)) return true
    return false
  }, [tabSegment])

  useEffect(() => {
    // Only decide to redirect after we know role and visibleTabs
    if (!role) return

    // If there's no tab segment after org-tickets (user navigated to /org-tickets),
    // redirect to the first visible tab.
    if (tabSegment === '') {
      if (visibleTabs.length > 0) {
        router.replace(`${basePath}/org-tickets/${visibleTabs[0].path}`)
      }
      return
    }

    // If the segment looks like an id (detail page), don't redirect.
    if (looksLikeId) return

    // Now the segment is a candidate tab (like 'tickets' or 'business-calendars').
    // If the user does not have access to that tab, redirect to first visible tab.
    const hasAccess = visibleTabs.some(tab => tab.path === tabSegment)
    if (!hasAccess) {
      if (visibleTabs.length > 0) {
        router.replace(`${basePath}/org-tickets/${visibleTabs[0].path}`)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, tabSegment, visibleTabs, basePath, router, looksLikeId])

  // Show loading while we resolve the user's role
  if (!role) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1A1A1E] flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  // If agent, keep things simple (no tabs)
  if (role === 'agent') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1A1A1E]">
        <main className="mx-auto px-4 py-6">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1A1A1E]">
      <div className="bg-white dark:bg-[#242428] border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="mx-auto px-4">
          <nav className="flex space-x-1 overflow-x-auto">
            {visibleTabs.map((tab) => {
              const fullPath = `${basePath}/org-tickets/${tab.path}`
              const isActive = tabSegment === tab.path
              return (
                <button
                  key={tab.path}
                  onClick={() => router.push(fullPath)}
                  className={`
                    px-4 py-3 text-sm font-medium whitespace-nowrap
                    border-b-2 transition-colors
                    ${
                      isActive
                        ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  {tab.name}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      <main className="mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
