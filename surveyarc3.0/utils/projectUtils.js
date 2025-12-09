// Helper functions for the Projects List

export const norm = (v) => (typeof v === "string" ? v.toLowerCase().trim() : v);

export const getId = (obj) => obj?.uid || obj?.user_id || obj?.id || "";

export const getRole = (obj) => norm(obj?.role || obj?.member_role || "");

export function descendingComparator(a, b, orderBy) {
  const va = orderBy === "members" 
    ? (Array.isArray(a.members) ? a.members.length : 0) 
    : a?.[orderBy];
  const vb = orderBy === "members" 
    ? (Array.isArray(b.members) ? b.members.length : 0) 
    : b?.[orderBy];
    
  if (va === undefined || va === null) return 1;
  if (vb === undefined || vb === null) return -1;
  
  if (orderBy === "name") {
    return vb?.toString?.().localeCompare(va?.toString?.());
  }
  
  return vb > va ? 1 : vb < va ? -1 : 0;
}

export function getComparator(order, orderBy) {
  return order === "desc"
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}