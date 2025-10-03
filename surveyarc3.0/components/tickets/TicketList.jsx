"use client";
import { useState } from "react";
import {
 Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Typography, LinearProgress, Stack, Tooltip, TableSortLabel,TextField, InputAdornment
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FlagIcon from "@mui/icons-material/Flag";
import PersonIcon from "@mui/icons-material/Person";
import GroupIcon from "@mui/icons-material/Group";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import WarningIcon from "@mui/icons-material/Warning";
import { alpha } from "@mui/material/styles";
const STATUS_COLORS = {
  new: "#2196F3",
  open: "#4CAF50",
  pending: "#FF9800",
  on_hold: "#9E9E9E",
  resolved: "#8BC34A",
  closed: "#607D8B",
  canceled: "#F44336"
};

const PRIORITY_COLORS = {
  low: "#4CAF50",
  normal: "#2196F3",
  high: "#FF9800",
  urgent: "#F44336"
};

export default function TicketList({ tickets, loading, onSelect, selectedTicket }) {
  const [orderBy, setOrderBy] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [searchTerm, setSearchTerm] = useState("");

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };
// Parse "YYYY-MM-DD HH:MM:SS.mmmmmm+HH[:MM]" (or +HHMM or +HH)
const pgToDate = (input) => {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === "number") return new Date(input);

  const s = String(input).trim();

  // 2025-10-03 08:13:58.399259+00
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?([+-]\d{2})(?::?(\d{2}))?$/
  );
  if (!m) {
    // fallback: try ISO or return Invalid Date for visibility
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  const [
    , Y, Mo, D, H, Mi, S, frac = "0", offH, offM = "00"
  ] = m;

  // milliseconds from microseconds (pad right, then take 3)
  const ms = Number((frac + "000").slice(0, 3));

  // timezone offset in minutes (note: Date.UTC expects UTC, so we subtract offset)
  const sign = offH.startsWith("-") ? -1 : 1;
  const tzH = Math.abs(Number(offH));
  const tzM = Number(offM);
  const offsetMinutes = sign * (tzH * 60 + tzM);

  const utcMs = Date.UTC(
    Number(Y), Number(Mo) - 1, Number(D),
    Number(H), Number(Mi), Number(S), ms
  ) - offsetMinutes * 60_000;

  return new Date(utcMs);
};

const formatDate = (value, opts={}) => {
  const d = pgToDate(value);
  if (!d || isNaN(d)) return "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...opts
  }).format(d);
};


  const sortedTickets = [...(tickets || [])].sort((a, b) => {
    let aVal = a[orderBy];
    let bVal = b[orderBy];

    // Handle dates
if (orderBy === "createdAt" || orderBy === "updated_at") {
  aVal = pgToDate(aVal)?.getTime() ?? 0;
  bVal = pgToDate(bVal)?.getTime() ?? 0;
}


    // Handle strings
    if (typeof aVal === "string") {
      aVal = aVal.toLowerCase();
      bVal = (bVal || "").toLowerCase();
    }

    if (order === "asc") {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  const filteredTickets = sortedTickets.filter((ticket) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      ticket.subject?.toLowerCase().includes(term) ||
      ticket.number?.toString().includes(term) ||
      ticket.ticketId?.toLowerCase().includes(term) ||
      ticket.description?.toLowerCase().includes(term) ||
      ticket.assigneeName?.toLowerCase().includes(term)
    );
  });

  const queueOwned = (ticket) => !ticket.assigneeId && !!ticket.groupId;

  if (!tickets || tickets.length === 0) {
    if (loading) {
      return (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <LinearProgress />
        </Paper>
      );
    }
    return (
      <Paper variant="outlined" sx={{ p: 4, borderRadius: 2, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          No tickets found.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden", height: "100%" }}>
      {loading && <LinearProgress />}
      
      {/* Search bar */}
      <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search tickets..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2
            }
          }}
        />
      </Box>

      <TableContainer sx={{ maxHeight: "calc(100vh - 280px)" }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ bgcolor: "background.paper", fontWeight: 600, width: 80 }}>
                <TableSortLabel
                  active={orderBy === "number"}
                  direction={orderBy === "number" ? order : "asc"}
                  onClick={() => handleSort("number")}
                >
                  #
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ bgcolor: "background.paper", fontWeight: 600 }}>
                <TableSortLabel
                  active={orderBy === "subject"}
                  direction={orderBy === "subject" ? order : "asc"}
                  onClick={() => handleSort("subject")}
                >
                  Subject
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ bgcolor: "background.paper", fontWeight: 600, width: 100 }}>
                <TableSortLabel
                  active={orderBy === "status"}
                  direction={orderBy === "status" ? order : "asc"}
                  onClick={() => handleSort("status")}
                >
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ bgcolor: "background.paper", fontWeight: 600, width: 90 }}>
                <TableSortLabel
                  active={orderBy === "priority"}
                  direction={orderBy === "priority" ? order : "asc"}
                  onClick={() => handleSort("priority")}
                >
                  Priority
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ bgcolor: "background.paper", fontWeight: 600, width: 140 }}>
                Assignee
              </TableCell>
              <TableCell sx={{ bgcolor: "background.paper", fontWeight: 600, width: 120 }}>
                <TableSortLabel
                  active={orderBy === "createdAt"}
                  direction={orderBy === "createdAt" ? order : "asc"}
                  onClick={() => handleSort("createdAt")}
                >
                  Created
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTickets.map((ticket) => {
              const isSelected = selectedTicket?.ticketId === ticket.ticketId;
              const hasSLABreach = ticket.sla_status?.breached_resolution;
              
              return (
                <TableRow
                  key={ticket.ticketId}
                  hover
                  selected={isSelected}
                  onClick={() => onSelect?.(ticket)}
                  sx={{
                    cursor: "pointer",
                    bgcolor: isSelected ? alpha("#1976d2", 0.08) : "transparent",
                    "&:hover": {
                      bgcolor: isSelected 
                        ? alpha("#1976d2", 0.12) 
                        : alpha("#1976d2", 0.04)
                    },
                    "& td": {
                      borderBottom: "1px solid",
                      borderColor: "divider"
                    }
                  }}
                >
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Typography 
                        variant="body2" 
                        fontWeight={isSelected ? 600 : 500}
                        fontFamily="monospace"
                      >
                        {ticket.number || ticket.ticketId?.slice(0, 6)}
                      </Typography>
                      {hasSLABreach && (
                        <Tooltip title="SLA Breached">
                          <WarningIcon 
                            sx={{ 
                              fontSize: 16, 
                              color: "error.main" 
                            }} 
                          />
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography 
                        variant="body2" 
                        fontWeight={isSelected ? 600 : 400}
                        sx={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          lineHeight: 1.3
                        }}
                      >
                        {ticket.subject}
                      </Typography>
                      {ticket.tags && ticket.tags.length > 0 && (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                          {ticket.tags.slice(0, 2).map((tag) => (
                            <Chip
                              key={tag.tag_id || tag.tagId || tag.name}
                              label={tag.name || tag.tag_id}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: "0.65rem",
                                "& .MuiChip-label": { px: 0.75 }
                              }}
                            />
                          ))}
                          {ticket.tags.length > 2 && (
                            <Chip
                              label={`+${ticket.tags.length - 2}`}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: "0.65rem",
                                "& .MuiChip-label": { px: 0.75 }
                              }}
                            />
                          )}
                        </Stack>
                      )}
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={ticket.status?.toUpperCase() || "OPEN"}
                      size="small"
                      sx={{
                        bgcolor: alpha(STATUS_COLORS[ticket.status] || STATUS_COLORS.open, 0.1),
                        color: STATUS_COLORS[ticket.status] || STATUS_COLORS.open,
                        fontWeight: 600,
                        fontSize: "0.7rem",
                        height: 24,
                        borderRadius: 1.5
                      }}
                    />
                  </TableCell>

                  <TableCell>
                    <Chip
                      icon={<FlagIcon sx={{ fontSize: 14 }} />}
                      label={ticket.priority?.toUpperCase() || "NORMAL"}
                      size="small"
                      sx={{
                        bgcolor: alpha(PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.normal, 0.1),
                        color: PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.normal,
                        fontWeight: 600,
                        fontSize: "0.7rem",
                        height: 24,
                        borderRadius: 1.5,
                        "& .MuiChip-icon": {
                          color: "inherit"
                        }
                      }}
                    />
                  </TableCell>

                  <TableCell>
                    {queueOwned(ticket) ? (
                      <Tooltip title={`Queue: ${ticket.groupName || ticket.groupId || "Unknown"}`}>
                        <Chip
                          icon={<GroupIcon sx={{ fontSize: 14 }} />}
                          label="Queue"
                          size="small"
                          variant="outlined"
                          sx={{
                            fontSize: "0.7rem",
                            height: 24,
                            borderRadius: 1.5
                          }}
                        />
                      </Tooltip>
                    ) : ticket.assigneeName || ticket.assigneeId ? (
                      <Tooltip title={ticket.assigneeName || ticket.assigneeId}>
                        <Chip
                          icon={<PersonIcon sx={{ fontSize: 14 }} />}
                          label={
                            (ticket.assigneeName || ticket.assigneeId || "").length > 12
                              ? `${(ticket.assigneeName || ticket.assigneeId).slice(0, 12)}...`
                              : (ticket.assigneeName || ticket.assigneeId)
                          }
                          size="small"
                          sx={{
                            fontSize: "0.7rem",
                            height: 24,
                            borderRadius: 1.5
                          }}
                        />
                      </Tooltip>
                    ) : (
                      <Typography variant="caption" color="text.secondary" fontStyle="italic">
                        Unassigned
                      </Typography>
                    )}
                  </TableCell>
<TableCell>
  <Tooltip title={formatDate(ticket.createdAt, { second: "2-digit" })}>
    <Stack direction="row" spacing={0.5} alignItems="center">
      <AccessTimeIcon sx={{ fontSize: 14, color: "text.secondary" }} />
      <Typography variant="caption" color="text.secondary">
        {formatDate(ticket.createdAt, { hour: undefined, minute: undefined })}
      </Typography>
    </Stack>
  </Tooltip>
</TableCell>


                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Results summary */}
      <Box 
        sx={{ 
          p: 1.5, 
          borderTop: "1px solid", 
          borderColor: "divider",
          bgcolor: alpha("#1976d2", 0.02)
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Showing {filteredTickets.length} of {tickets.length} tickets
        </Typography>
      </Box>
    </Paper>
  );
}