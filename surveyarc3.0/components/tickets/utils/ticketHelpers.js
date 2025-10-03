// ============================================================
// FILE: components/tickets/utils/ticketHelpers.js
// ============================================================

/**
 * Get priority rank for sorting
 */
function getPriorityRank(priority) {
  const ranks = { 
    blocker: 5, 
    urgent: 4, 
    high: 3, 
    normal: 2, 
    low: 1 
  };
  return ranks[priority] || 0;
}

/**
 * Sort tickets array by specified criteria
 */
export function sortTickets(tickets, sortBy) {
  const sorted = [...tickets];
  
  switch (sortBy) {
    case "created_at_asc":
      return sorted.sort((a, b) => 
        new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at)
      );
      
    case "created_at_desc":
      return sorted.sort((a, b) => 
        new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at)
      );
      
    case "updated_at_desc":
      return sorted.sort((a, b) => 
        new Date(b.updatedAt || b.updated_at) - new Date(a.updatedAt || a.updated_at)
      );
      
    case "priority_desc":
      return sorted.sort((a, b) => 
        getPriorityRank(b.priority) - getPriorityRank(a.priority)
      );
      
    case "priority_asc":
      return sorted.sort((a, b) => 
        getPriorityRank(a.priority) - getPriorityRank(b.priority)
      );
      
    default:
      return sorted;
  }
}

/**
 * Normalize ticket data from API
 */
export function normalizeTicket(ticket) {
  return {
    ...ticket,
    ticketId: ticket.ticketId || ticket.ticket_id,
    number: ticket.number,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    severity: ticket.severity,
    requesterId: ticket.requesterId || ticket.requester_id,
    assigneeId: ticket.assigneeId || ticket.assignee_id,
    groupId: ticket.groupId || ticket.group_id,
    updatedAt: ticket.updatedAt || ticket.updated_at,
    createdAt: ticket.createdAt || ticket.created_at,
    slaStatus: ticket.sla_status || ticket.slaStatus || null,
  };
}

/**
 * Format date for display
 */
export function formatDate(dateString) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString();
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString) {
  if (!dateString) return "—";
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return formatDate(dateString);
}

/**
 * Get status display name
 */
export function getStatusLabel(status) {
  if (!status) return "NEW";
  return status.replace("_", " ").toUpperCase();
}

/**
 * Get priority display name
 */
export function getPriorityLabel(priority) {
  if (!priority) return "Normal";
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}