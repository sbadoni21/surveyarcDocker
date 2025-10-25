"use client";

import React, { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCookie } from "cookies-next";
import {
  IconButton, Menu, MenuItem, ListItemIcon, ListItemText,
  Divider, Tooltip, CircularProgress, MenuList, ListSubheader,
  Box, Typography, Chip
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import MoreVertIcon from "@mui/icons-material/MoreVert";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import GroupIcon from "@mui/icons-material/Group";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import StarIcon from "@mui/icons-material/Star";
import TimelineIcon from "@mui/icons-material/Timeline";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import FlagIcon from "@mui/icons-material/Flag";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import BoltIcon from "@mui/icons-material/Bolt";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ShareIcon from "@mui/icons-material/Share";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { useProject } from "@/providers/postGresPorviders/projectProvider";

// helpers
const pidOf = (p) => p?.project_id || p?.projectId;

const STATUS_OPTIONS = [
  { value: "planning", label: "Planning", icon: FlagIcon, color: "#9333ea" },
  { value: "in_progress", label: "In Progress", icon: BoltIcon, color: "#2563eb" },
  { value: "on_hold", label: "On Hold", icon: PauseCircleIcon, color: "#f59e0b" },
  { value: "completed", label: "Completed", icon: CheckCircleIcon, color: "#059669" },
  { value: "cancelled", label: "Cancelled", icon: CancelIcon, color: "#dc2626" },
];

export default function ProjectActionsMenu({
  project,
  orgId,
  canManage = true,
  canEnter = true,
  toast,

  // callbacks
  onOpenMembers,
  onOpenTimeline,
  onEdit,
  onDeleted,
  onStatusChanged,   // (status) => void
  onRecomputed,      // () => void

  // favorite managed by parent (keeps table + menu in sync)
  isFavorite = false,
  onToggleFavorite,  // () => Promise|void
}) {
  const router = useRouter();
  const { setStatus, recomputeProgress } = useProject();

  const pid = useMemo(() => pidOf(project), [project]);
  const openUrl = useMemo(() => {
    const o = orgId || getCookie("currentOrgId");
    return `/postgres-org/${o}/dashboard/projects/${pid}`;
  }, [orgId, pid]);

  const [anchorEl, setAnchorEl] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const jump = useCallback(() => {
    handleClose();
    if (!canEnter) return toast?.("You're not part of this project yet.", "warning");
    router.push(openUrl);
  }, [router, openUrl, canEnter, toast]);

  const doStatus = useCallback(async (status) => {
    try {
      setBusy(true);
      await setStatus(pid, status);
      onStatusChanged?.(status);
      toast?.("Status updated successfully", "success");
    } catch (e) {
      toast?.(String(e?.message || e), "error");
    } finally {
      setBusy(false);
      handleClose();
    }
  }, [pid, setStatus, toast, onStatusChanged]);

  const doRecompute = useCallback(async () => {
    try {
      setBusy(true);
      await recomputeProgress(pid);
      onRecomputed?.();
      toast?.("Progress recomputed", "success");
    } catch (e) {
      toast?.(String(e?.message || e), "error");
    } finally {
      setBusy(false);
      handleClose();
    }
  }, [pid, recomputeProgress, toast, onRecomputed]);

  const doCopyId = useCallback(() => {
    navigator.clipboard.writeText(pid);
    toast?.("Project ID copied to clipboard", "success");
    handleClose();
  }, [pid, toast]);

  const doShare = useCallback(() => {
    const url = window.location.origin + openUrl;
    navigator.clipboard.writeText(url);
    toast?.("Project link copied to clipboard", "success");
    handleClose();
  }, [openUrl, toast]);

  const currentStatus = project?.status;

  return (
    <>
      <Tooltip title="More actions">
        <IconButton
          size="small"
          onClick={handleOpen}
          sx={{ '&:hover': { bgcolor: 'primary.50' } }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        keepMounted
        PaperProps={{
          elevation: 8,
          sx: {
            minWidth: 280,
            mt: 1,
            borderRadius: 2,
            '& .MuiMenuItem-root': {
              borderRadius: 1,
              mx: 0.5,
              my: 0.25,
              px: 1.5,
              py: 1,
            },
          },
        }}
      >
        {/* Header */}
        <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.50' }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            PROJECT ACTIONS
          </Typography>
          <Typography
            variant="body2"
            fontWeight={600}
            noWrap
            sx={{ mt: 0.5, maxWidth: 240 }}
          >
            {project?.name || "Untitled Project"}
          </Typography>
          {currentStatus && (
            <Chip
              label={currentStatus.replace(/_/g, " ")}
              size="small"
              sx={{
                mt: 0.5,
                height: 20,
                fontSize: 11,
                textTransform: 'capitalize',
              }}
            />
          )}
        </Box>

        <Divider />

        {/* Quick */}
        <MenuList dense sx={{ py: 0.5 }}>
          <MenuItem onClick={jump} disabled={!canEnter}>
            <ListItemIcon>
              <OpenInNewIcon fontSize="small" color={canEnter ? "primary" : "disabled"} />
            </ListItemIcon>
            <ListItemText
              primary="Open Project"
              secondary={!canEnter ? "No access" : null}
              primaryTypographyProps={{ fontWeight: 500 }}
            />
          </MenuItem>

          <MenuItem
            onClick={async () => {
              try {
                if (!onToggleFavorite) return;
                setBusy(true);
                await onToggleFavorite();
              } catch (e) {
                toast?.(String(e?.message || e), "error");
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy || !onToggleFavorite}
          >
            <ListItemIcon>
              {busy ? (
                <CircularProgress size={18} />
              ) : isFavorite ? (
                <StarIcon fontSize="small" sx={{ color: 'warning.main' }} />
              ) : (
                <StarBorderIcon fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
              primaryTypographyProps={{ fontWeight: 500 }}
            />
          </MenuItem>
        </MenuList>

        <Divider />

        {/* Manage */}
        <MenuList dense sx={{ py: 0.5 }}>
          <ListSubheader sx={{ lineHeight: '32px', fontSize: 11, fontWeight: 700, color: 'text.secondary', bgcolor: 'transparent' }}>
            MANAGE
          </ListSubheader>

          <MenuItem onClick={() => { handleClose(); onOpenMembers?.(); }} disabled={!canManage}>
            <ListItemIcon>
              <GroupIcon fontSize="small" color={canManage ? "action" : "disabled"} />
            </ListItemIcon>
            <ListItemText primary="Team Members" primaryTypographyProps={{ fontWeight: 500 }} />
          </MenuItem>

          <MenuItem onClick={() => { handleClose(); onOpenTimeline?.(); }}>
            <ListItemIcon>
              <TimelineIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Timeline & Milestones" primaryTypographyProps={{ fontWeight: 500 }} />
          </MenuItem>

          <MenuItem onClick={() => { handleClose(); onEdit?.(); }} disabled={!canManage}>
            <ListItemIcon>
              <EditIcon fontSize="small" color={canManage ? "action" : "disabled"} />
            </ListItemIcon>
            <ListItemText primary="Edit Details" primaryTypographyProps={{ fontWeight: 500 }} />
          </MenuItem>
        </MenuList>

        <Divider />

        {/* Status */}
        <MenuList dense sx={{ py: 0.5 }}>
          <ListSubheader sx={{ lineHeight: '32px', fontSize: 11, fontWeight: 700, color: 'text.secondary', bgcolor: 'transparent' }}>
            CHANGE STATUS
          </ListSubheader>

          {STATUS_OPTIONS.map((st) => {
            const Icon = st.icon;
            const isCurrent = currentStatus === st.value;
            return (
              <MenuItem
                key={st.value}
                onClick={() => doStatus(st.value)}
                disabled={!canManage || busy || isCurrent}
                sx={{
                  bgcolor: isCurrent ? alpha(st.color, 0.08) : 'transparent',
                  '&:hover': { bgcolor: isCurrent ? alpha(st.color, 0.12) : undefined },
                }}
              >
                <ListItemIcon>
                  <Icon fontSize="small" sx={{ color: isCurrent ? st.color : 'action.active' }} />
                </ListItemIcon>
                <ListItemText
                  primary={st.label}
                  primaryTypographyProps={{ fontWeight: isCurrent ? 600 : 500 }}
                />
                {isCurrent && (
                  <CheckCircleIcon fontSize="small" sx={{ ml: 1, color: st.color, fontSize: 16 }} />
                )}
              </MenuItem>
            );
          })}
        </MenuList>

        <Divider />

        {/* Utils */}
        <MenuList dense sx={{ py: 0.5 }}>
          <MenuItem onClick={doRecompute} disabled={!canManage || busy}>
            <ListItemIcon>
              {busy ? <CircularProgress size={18} /> : <DoneAllIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText primary="Recompute Progress" primaryTypographyProps={{ fontWeight: 500 }} />
          </MenuItem>

          <MenuItem onClick={doCopyId}>
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Copy Project ID" primaryTypographyProps={{ fontWeight: 500 }} />
          </MenuItem>

          <MenuItem onClick={doShare}>
            <ListItemIcon>
              <ShareIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Copy Project Link" primaryTypographyProps={{ fontWeight: 500 }} />
          </MenuItem>
        </MenuList>

        <Divider />

        {/* Danger */}
        <MenuList dense sx={{ py: 0.5 }}>
          <MenuItem
            onClick={() => { handleClose(); onDeleted?.(); }}
            disabled={!canManage}
            sx={{ color: 'error.main', '&:hover': { bgcolor: alpha('#dc2626', 0.08) } }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText primary="Delete Project" primaryTypographyProps={{ fontWeight: 600 }} />
          </MenuItem>
        </MenuList>

        {/* Footer */}
        <Box sx={{ px: 2, py: 1, bgcolor: 'grey.50', borderTop: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.disabled">
              ID: {pid?.slice(0, 12)}...
            </Typography>
          </Box>
        </Box>
      </Menu>
    </>
  );
}
