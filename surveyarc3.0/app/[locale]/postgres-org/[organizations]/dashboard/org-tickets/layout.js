'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useMemo, useEffect } from 'react'
import { useUser } from '@/providers/postGresPorviders/UserProvider'
import BusinessCalendarsProvider from "@/providers/BusinessCalendarsProvider";
import { SupportGroupProvider } from "@/providers/postGresPorviders/SupportGroupProvider";
import { SupportTeamProvider } from "@/providers/postGresPorviders/SupportTeamProvider";
import { TagProvider } from "@/providers/postGresPorviders/TagProvider";
import { TicketCategoryProvider } from "@/providers/postGresPorviders/TicketCategoryProvider";
import { TicketTaxonomyProvider } from "@/providers/postGresPorviders/TicketTaxonomyProvider";
import { TicketProvider } from "@/providers/ticketsProvider";

const ALL_TABS = [
  { name: 'Dashboard',            path: 'dashboard',            roles: ['owner', 'admin'] },
  { name: 'Tickets',            path: 'tickets',            roles: ['owner', 'admin'] },
  { name: 'Business Calendars', path: 'business-calendars', roles: ['owner', 'admin', 'manager'] },
  { name: 'Category Management',path: 'category-management',roles: ['owner', 'admin', 'manager'] },
  { name: 'My Group Tickets',   path: 'my-group-tickets',   roles: [ 'admin', 'manager'] },
  { name: 'SLA',                path: 'sla',                roles: ['owner', 'admin'] },
  { name: 'Support Groups',     path: 'support-groups',     roles: ['owner', 'admin'] },
  { name: 'External Apis',      path: 'create-apis',        roles: ['owner', 'admin', 'manager'] },
  { name: 'Agent Tickets',      path: 'agent-tickets',      roles: ['agent'] },
  { name: 'Team Lead',          path: 'team-lead',          roles: [ 'team_lead'] },
]

export default function OrgTicketsLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useUser()
  const role = user?.role?.toLowerCase() || null
  const basePath = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean)
    const dashboardIndex = segments.findIndex(s => s === 'dashboard')
    if (dashboardIndex !== -1) {
      return '/' + segments.slice(0, dashboardIndex + 1).join('/')
    }
    return ''
  }, [pathname])
  const visibleTabs = useMemo(() => {
    if (!role) return []
    return ALL_TABS.filter(tab => tab.roles.includes(role))
  }, [role])
  const tabSegment = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean)
    const idx = segments.findIndex(s => s === 'org-tickets')
    if (idx !== -1) {
      return segments.length > idx + 1 ? segments[idx + 1] : ''
    }
    return segments[segments.length - 1] || ''
  }, [pathname])

  // Heuristic to detect detail pages like /org-tickets/tickets/tkt_xxx
  const looksLikeId = useMemo(() => {
    if (!tabSegment) return false
    if (tabSegment.includes('_')) return true
    if (/^[0-9a-f]{8,}$/i.test(tabSegment)) return true
    if (/^\d{4,}$/.test(tabSegment)) return true
    return false
  }, [tabSegment])

  useEffect(() => {
    if (!role) return

    // If user just hits /org-tickets → send to first allowed tab
    if (tabSegment === '') {
      if (visibleTabs.length > 0) {
        router.replace(`${basePath}/org-tickets/${visibleTabs[0].path}`)
      }
      return
    }

    // Detail page like /tickets/tkt_xxx → allow, don't redirect
    if (looksLikeId) return

    // Check if user can see this tab
    const hasAccess = visibleTabs.some(tab => tab.path === tabSegment)
    if (!hasAccess && visibleTabs.length > 0) {
      router.replace(`${basePath}/org-tickets/${visibleTabs[0].path}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, tabSegment, visibleTabs, basePath, router, looksLikeId])

  // Still resolving user
  if (!role) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1A1A1E] flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  // Pure agent view → no tabs
  if (role === 'agent') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1A1A1E]">
        <main className="mx-auto px-4 py-6">
          {children}
        </main>
      </div>
    )
  }

  // If some weird role has no allowed tabs
  if (visibleTabs.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1A1A1E] flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400 text-sm">
          You don’t have access to any ticket modules. Please contact your admin.
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1A1A1E]">
      {/* Top tab bar (only tabs allowed for this role) */}
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

      {/* Providers + page content */}
      <TagProvider>
        <TicketCategoryProvider>
          <TicketTaxonomyProvider>
            <TicketProvider>
              <SupportGroupProvider>
                <SupportTeamProvider>
                  <BusinessCalendarsProvider>
                    <main className="mx-auto px-4 py-6">
                      {children}
                    </main>
                  </BusinessCalendarsProvider>
                </SupportTeamProvider>
              </SupportGroupProvider>
            </TicketProvider>
          </TicketTaxonomyProvider>
        </TicketCategoryProvider>
      </TagProvider>
    </div>
  )
}
