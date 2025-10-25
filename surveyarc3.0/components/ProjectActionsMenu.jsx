"use client";

import React, { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  IconButton, Menu, MenuItem, ListItemIcon, ListItemText,
  Divider, Tooltip, CircularProgress, MenuList, ListSubheader,
  Box, Typography, Chip, alpha
} from "@mui/material";
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
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ShareIcon from "@mui/icons-material/Share";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Stack } from "@mui/material";
import { useProject } from "@/providers/postGresPorviders/projectProvider";
import { getCookie } from "cookies-next";

// Normalize id helper
const pidOf = (p) => p?.project_id || p?.projectId;

// Status configuration for better organization
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
  onOpenMembers,
  onEdit,
  onOpenTimeline,
  onDeleted,
  toast,
}) {
  const router = useRouter();
  const {
    setStatus, recomputeProgress,
    listFavorites, addFavorite, removeFavorite,
  } = useProject();

  const pid = useMemo(() => pidOf(project), [project]);
  const openUrl = useMemo(() => {
    const o = orgId || getCookie("currentOrgId");
    return `/postgres-org/${o}/dashboard/projects/${pid}`;
  }, [orgId, pid]);

  const [anchorEl, setAnchorEl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [favorite, setFavorite] = useState(null);
  const isArchived = project?.is_archived || false;

  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const initFavorite = useCallback(async () => {
    if (favorite !== null) return;
    try {
      const userId = getCookie("currentUserId");
      const favs = await listFavorites(userId);
      const isFav = (favs?.items || []).some((x) => (x.project_id || x.projectId) === pid);
      setFavorite(!!isFav);
    } catch {
      setFavorite(false);
    }
  }, [favorite, listFavorites, pid]);

  const toggleFavorite = useCallback(async () => {
    try {
      setBusy(true);
      const userId = getCookie("currentUserId");
      if (favorite) {
        await removeFavorite(userId, pid);
        setFavorite(false);
        toast?.("Removed from favorites", "success");
      } else {
        await addFavorite(userId, pid);
        setFavorite(true);
        toast?.("Added to favorites", "success");
      }
    } catch (e) {
      toast?.(String(e?.message || e), "error");
    } finally {
      setBusy(false);
    }
  }, [favorite, addFavorite, removeFavorite, pid, toast]);

  const jump = useCallback(() => {
    handleClose();
    if (!canEnter) return toast?.("You're not part of this project yet.", "warning");
    router.push(openUrl);
  }, [router, openUrl, canEnter, toast]);

  const doStatus = useCallback(async (status) => {
    try {
      setBusy(true);
      await setStatus(pid, status);
      toast?.("Status updated successfully", "success");
    } catch (e) {
      toast?.(String(e?.message || e), "error");
    } finally {
      setBusy(false);
      handleClose();
    }
  }, [pid, setStatus, toast]);

  const doRecompute = useCallback(async () => {
    try {
      setBusy(true);
      await recomputeProgress(pid);
      toast?.("Progress recomputed", "success");
    } catch (e) {
      toast?.(String(e?.message || e), "error");
    } finally {
      setBusy(false);
      handleClose();
    }
  }, [pid, recomputeProgress, toast]);

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

  const doOpenMembers = useCallback(() => {
    handleClose();
    onOpenMembers?.();
  }, [onOpenMembers]);

  const doOpenTimeline = useCallback(() => {
    handleClose();
    onOpenTimeline?.();
  }, [onOpenTimeline]);

  const doEdit = useCallback(() => {
    handleClose();
    onEdit?.();
  }, [onEdit]);

  const doDelete = useCallback(async () => {
    handleClose();
    onDeleted?.();
  }, [onDeleted]);

  const onMenuOpen = async (e) => {
    handleOpen(e);
    await initFavorite();
  };

  const currentStatus = project?.status;

  return (
    <>
      <Tooltip title="More actions">
        <IconButton 
          size="small" 
          onClick={onMenuOpen}
          sx={{
            '&:hover': {
              bgcolor: 'primary.50',
            }
          }}
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
        {/* Project Info Header */}
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

        {/* Quick Actions */}
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
            onClick={toggleFavorite}
            disabled={busy}
          >
            <ListItemIcon>
              {busy ? (
                <CircularProgress size={18} />
              ) : favorite ? (
                <StarIcon fontSize="small" sx={{ color: 'warning.main' }} />
              ) : (
                <StarBorderIcon fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText 
              primary={favorite ? "Remove from Favorites" : "Add to Favorites"}
              primaryTypographyProps={{ fontWeight: 500 }}
            />
          </MenuItem>
        </MenuList>

        <Divider />

        {/* Management Section */}
        <MenuList dense sx={{ py: 0.5 }}>
          <ListSubheader 
            sx={{ 
              lineHeight: '32px', 
              fontSize: 11,
              fontWeight: 700,
              color: 'text.secondary',
              bgcolor: 'transparent',
            }}
          >
            MANAGE
          </ListSubheader>

          <MenuItem onClick={doOpenMembers} disabled={!canManage}>
            <ListItemIcon>
              <GroupIcon fontSize="small" color={canManage ? "action" : "disabled"} />
            </ListItemIcon>
            <ListItemText 
              primary="Team Members"
              primaryTypographyProps={{ fontWeight: 500 }}
            />
          </MenuItem>

          <MenuItem onClick={doOpenTimeline}>
            <ListItemIcon>
              <TimelineIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText 
              primary="Timeline & Milestones"
              primaryTypographyProps={{ fontWeight: 500 }}
            />
          </MenuItem>

          <MenuItem onClick={doEdit} disabled={!canManage}>
            <ListItemIcon>
              <EditIcon fontSize="small" color={canManage ? "action" : "disabled"} />
            </ListItemIcon>
            <ListItemText 
              primary="Edit Details"
              primaryTypographyProps={{ fontWeight: 500 }}
            />
          </MenuItem>
        </MenuList>

        <Divider />

        {/* Status Section */}
        <MenuList dense sx={{ py: 0.5 }}>
          <ListSubheader 
            sx={{ 
              lineHeight: '32px', 
              fontSize: 11,
              fontWeight: 700,
              color: 'text.secondary',
              bgcolor: 'transparent',
            }}
          >
            CHANGE STATUS
          </ListSubheader>

          {STATUS_OPTIONS.map((statusOpt) => {
            const Icon = statusOpt.icon;
            const isCurrentStatus = currentStatus === statusOpt.value;
            
            return (
              <MenuItem
                key={statusOpt.value}
                onClick={() => doStatus(statusOpt.value)}
                disabled={!canManage || busy || isCurrentStatus}
                sx={{
                  bgcolor: isCurrentStatus ? alpha(statusOpt.color, 0.08) : 'transparent',
                  '&:hover': {
                    bgcolor: isCurrentStatus 
                      ? alpha(statusOpt.color, 0.12)
                      : undefined,
                  },
                }}
              >
                <ListItemIcon>
                  <Icon 
                    fontSize="small" 
                    sx={{ 
                      color: isCurrentStatus ? statusOpt.color : 'action.active',
                    }} 
                  />
                </ListItemIcon>
                <ListItemText 
                  primary={statusOpt.label}
                  primaryTypographyProps={{ 
                    fontWeight: isCurrentStatus ? 600 : 500,
                  }}
                />
                {isCurrentStatus && (
                  <CheckCircleIcon 
                    fontSize="small" 
                    sx={{ 
                      ml: 1, 
                      color: statusOpt.color,
                      fontSize: 16,
                    }} 
                  />
                )}
              </MenuItem>
            );
          })}
        </MenuList>

        <Divider />

        {/* Utilities Section */}
        <MenuList dense sx={{ py: 0.5 }}>
          <ListSubheader 
            sx={{ 
              lineHeight: '32px', 
              fontSize: 11,
              fontWeight: 700,
              color: 'text.secondary',
              bgcolor: 'transparent',
            }}
          >
            UTILITIES
          </ListSubheader>

          <MenuItem onClick={doRecompute} disabled={!canManage || busy}>
            <ListItemIcon>
              {busy ? (
                <CircularProgress size={18} />
              ) : (
                <DoneAllIcon fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText 
              primary="Recompute Progress"
              primaryTypographyProps={{ fontWeight: 500 }}
            />
          </MenuItem>

          <MenuItem onClick={doCopyId}>
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText 
              primary="Copy Project ID"
              primaryTypographyProps={{ fontWeight: 500 }}
            />
          </MenuItem>

          <MenuItem onClick={doShare}>
            <ListItemIcon>
              <ShareIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText 
              primary="Copy Project Link"
              primaryTypographyProps={{ fontWeight: 500 }}
            />
          </MenuItem>
        </MenuList>

        <Divider />

        {/* Danger Zone */}
        <MenuList dense sx={{ py: 0.5 }}>
          <MenuItem 
            onClick={doDelete} 
            disabled={!canManage}
            sx={{
              color: 'error.main',
              '&:hover': {
                bgcolor: alpha('#dc2626', 0.08),
              },
            }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText 
              primary="Delete Project"
              primaryTypographyProps={{ fontWeight: 600 }}
            />
          </MenuItem>
        </MenuList>

        {/* Footer Info */}
        <Box 
          sx={{ 
            px: 2, 
            py: 1, 
            bgcolor: 'grey.50',
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" spacing={0.5} alignItems="center">
            <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.disabled">
              ID: {pid?.slice(0, 12)}...
            </Typography>
          </Stack>
        </Box>
      </Menu>
    </>
  );
}

// Add Stack import
