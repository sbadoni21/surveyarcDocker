// ==========================================
// FILE: org-tickets/layout.js
// ==========================================
'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useMemo, useEffect } from 'react'
import { useUser } from '@/providers/postGresPorviders/UserProvider'

export default function OrgTicketsLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useUser()
  const role = user?.role?.toLowerCase() || null

  // Extract the base path (language + postgres-org + orgId + dashboard)
  const basePath = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean)
    const dashboardIndex = segments.findIndex(s => s === 'dashboard')
    
    if (dashboardIndex !== -1) {
      return '/' + segments.slice(0, dashboardIndex + 1).join('/')
    }
    return ''
  }, [pathname])

  // All available tabs with role permissions
  const allTabs = [
    { name: 'Business Calendars', path: 'business-calendars', roles: ['owner', 'admin', 'manager'] },
    { name: 'Category Management', path: 'category-management', roles: ['owner', 'admin', 'manager'] },
    { name: 'My Group Tickets', path: 'my-group-tickets', roles: ['owner', 'admin', 'manager', 'team_lead'] },
    { name: 'Routing', path: 'routing', roles: ['owner', 'admin', 'manager'] },
    { name: 'SLA', path: 'sla', roles: ['owner', 'admin'] },
    { name: 'Support Groups', path: 'support-groups', roles: ['owner', 'admin'] },
    { name: 'Tags', path: 'tags', roles: ['owner', 'admin', 'manager'] },
    { name: 'Agent Tickets', path: 'agent-tickets', roles: ['owner', 'admin', 'manager', 'team_lead', 'agent'] },
    { name: 'Team Lead', path: 'team-lead', roles: ['owner', 'admin', 'team_lead'] },
  ]

  // Filter tabs based on user role
  const visibleTabs = useMemo(() => {
    if (!role) return []
    return allTabs.filter(tab => tab.roles.includes(role.toLowerCase()))
  }, [role])

  // Redirect if user doesn't have access to current page
  useEffect(() => {
    if (!role || visibleTabs.length === 0) return

    const currentTab = pathname.split('/').pop()
    const hasAccess = visibleTabs.some(tab => tab.path === currentTab)

    if (!hasAccess && currentTab && currentTab !== 'org-tickets') {
      if (visibleTabs.length > 0) {
        router.push(`${basePath}/org-tickets/${visibleTabs[0].path}`)
      }
    }
  }, [pathname, role, visibleTabs, basePath, router])

  // Show loading if no role
  if (!role) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1A1A1E] flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  // If agent, show only agent tickets (no tabs needed)
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
      {/* Top Navigation Tabs */}
      <div className="bg-white dark:bg-[#242428] border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="mx-auto px-4">
          <nav className="flex space-x-1 overflow-x-auto">
            {visibleTabs.map((tab) => {
              const fullPath = `${basePath}/org-tickets/${tab.path}`
              const isActive = pathname.endsWith(tab.path)
              
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

      {/* Main Content Area */}
      <main className="mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}