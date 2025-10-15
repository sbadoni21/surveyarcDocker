// components/tags/TagsPage.jsx
"use client";
import { useEffect, useState, useMemo } from "react";
import {
  Box,
  Button,
  Container,
  Grid,
  Paper,
  Stack,
  Typography,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Alert,
  Card,
  CardContent,
  alpha,
  useTheme,
  Skeleton,
  Tooltip,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Select,
  FormControl,
  InputLabel,
  ListItemText,
  Snackbar,
  Badge,
} from "@mui/material";
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocalOffer as TagIcon,
  Category as CategoryIcon,
  TrendingUp as TrendingUpIcon,
  Label as LabelIcon,
  Close as CloseIcon,
  Palette as PaletteIcon,
  MoreVert as MoreVertIcon,
  DeleteSweep as DeleteSweepIcon,
  MergeType as MergeIcon,
  CleaningServices as CleanupIcon,
  FileUpload as ImportIcon,
  FileDownload as ExportIcon,
  SelectAll as SelectAllIcon,
  Deselect as DeselectIcon,
} from "@mui/icons-material";
import { usePathname } from "next/navigation";
import TagForm from "./TagForm";
import ConfirmDialog from "../common/ConfirmDialog";
import { useTags } from "@/providers/postGresPorviders/TagProvider";

// Stats Card Component
function StatsCard({ icon: Icon, label, value, color = "primary", loading = false }) {
  const theme = useTheme();
  
  return (
    <Card
      sx={{
        borderRadius: 3,
        border: 2,
        borderColor: `${color}.main`,
        background: `linear-gradient(135deg, ${alpha(
          theme.palette[color].main,
          0.1
        )} 0%, ${alpha(theme.palette[color].main, 0.05)} 100%)`,
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: `${color}.main`,
              boxShadow: 3,
            }}
          >
            <Icon sx={{ fontSize: 32, color: "white" }} />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            {loading ? (
              <>
                <Skeleton variant="text" width={60} height={40} />
                <Skeleton variant="text" width={80} height={20} />
              </>
            ) : (
              <>
                <Typography variant="h4" fontWeight={700} color={`${color}.main`}>
                  {value}
                </Typography>
                <Typography
                  variant="caption"
                  fontWeight={600}
                  color="text.secondary"
                  textTransform="uppercase"
                  letterSpacing={0.5}
                >
                  {label}
                </Typography>
              </>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// Tag Card Skeleton
function TagCardSkeleton() {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: 2, borderColor: "divider" }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ flexGrow: 1 }}>
            <Skeleton variant="text" width="70%" height={28} />
          </Box>
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="circular" width={32} height={32} />
        </Stack>
        <Skeleton variant="text" width="100%" height={20} />
        <Skeleton variant="text" width="80%" height={20} />
        <Stack direction="row" spacing={1}>
          <Skeleton variant="rounded" width={80} height={24} />
          <Skeleton variant="rounded" width={100} height={24} />
        </Stack>
        <Skeleton variant="rectangular" width="100%" height={8} sx={{ borderRadius: 1 }} />
      </Stack>
    </Paper>
  );
}

export default function TagsPage() {
  const theme = useTheme();
  const path = usePathname();
  const orgId = path.split("/")[3];
  
  const {
    tags,
    selectedTag,
    setSelectedTag,
    list,
    remove,
    loading,
    count,
    getCategories,
    getStats,
    bulkDelete,
    merge,
    cleanupUnused,
  } = useTags();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState(null);
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [counts, setCounts] = useState({ total: 0, by_category: {} });
  const [statsLoading, setStatsLoading] = useState(true);
  const [detailedStats, setDetailedStats] = useState(null);
  
  // Bulk operations
  const [selectedTags, setSelectedTags] = useState([]);
  const [bulkMenuAnchor, setBulkMenuAnchor] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  
  // Merge dialog
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState("");
  const [deleteAfterMerge, setDeleteAfterMerge] = useState(true);
  
  // Cleanup dialog
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(30);
  
  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  // Load tags and categories
  useEffect(() => {
    if (orgId) {
      list({ orgId, search: searchQuery, category: selectedCategory });
    }
  }, [orgId, searchQuery, selectedCategory, list]);

  useEffect(() => {
    if (orgId) {
      setStatsLoading(true);
      Promise.all([
        count({ orgId, include_categories: true }),
        getCategories(orgId),
        getStats(orgId)
      ])
        .then(([countResult, cats, stats]) => {
          setCounts({
            total: countResult.count || 0,
            by_category: countResult.by_category || {}
          });
          setCategories(Array.isArray(cats) ? cats : []);
          setDetailedStats(stats);
        })
        .catch(() => {
          setCounts({ total: 0, by_category: {} });
          setCategories([]);
          setDetailedStats(null);
        })
        .finally(() => setStatsLoading(false));
    }
  }, [orgId, getCategories, count, getStats]);

  // Calculate stats
  const stats = useMemo(() => {
    const categoryCount = Object.keys(counts.by_category || {}).length;
    const totalUsage = tags.reduce((sum, tag) => sum + (tag.usageCount || 0), 0);
    const unusedTags = tags.filter(tag => tag.usageCount === 0).length;
    
    return {
      total: counts.total,
      categories: categoryCount,
      totalUsage,
      unused: unusedTags
    };
  }, [counts, tags]);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleCategoryFilter = (category) => {
    setSelectedCategory(category);
    setFilterAnchor(null);
  };

  const handleEdit = (tag) => {
    setSelectedTag(tag);
    setFormOpen(true);
  };

  const handleDelete = (tag) => {
    setTagToDelete(tag);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (tagToDelete) {
      try {
        await remove(tagToDelete.tagId);
        setDeleteConfirmOpen(false);
        setTagToDelete(null);
        showSnackbar("Tag deleted successfully");
        refreshData();
      } catch (error) {
        console.error("Failed to delete tag:", error);
        showSnackbar("Failed to delete tag", "error");
      }
    }
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setSelectedTag(null);
  };

  const handleFormSubmit = async () => {
    setFormOpen(false);
    setSelectedTag(null);
    showSnackbar(selectedTag ? "Tag updated successfully" : "Tag created successfully");
    refreshData();
  };

  // Bulk operations
  const handleSelectTag = (tagId) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSelectAll = () => {
    setSelectedTags(tags.map(t => t.tagId));
  };

  const handleDeselectAll = () => {
    setSelectedTags([]);
  };

  const handleBulkDelete = async () => {
    try {
      await bulkDelete(selectedTags, orgId, false);
      setBulkDeleteOpen(false);
      setSelectedTags([]);
      showSnackbar(`${selectedTags.length} tags deleted successfully`);
      refreshData();
    } catch (error) {
      console.error("Failed to bulk delete:", error);
      showSnackbar("Failed to delete tags", "error");
    }
  };

  const handleMerge = async () => {
    if (!mergeTarget || selectedTags.length === 0) return;
    
    try {
      await merge(selectedTags, mergeTarget, orgId, deleteAfterMerge);
      setMergeDialogOpen(false);
      setSelectedTags([]);
      setMergeTarget("");
      showSnackbar(`Tags merged successfully into ${tags.find(t => t.tagId === mergeTarget)?.name}`);
      refreshData();
    } catch (error) {
      console.error("Failed to merge tags:", error);
      showSnackbar("Failed to merge tags", "error");
    }
  };

  const handleCleanup = async () => {
    try {
      const result = await cleanupUnused(orgId, cleanupDays);
      setCleanupDialogOpen(false);
      showSnackbar(`Cleaned up ${result.deleted || 0} unused tags`);
      refreshData();
    } catch (error) {
      console.error("Failed to cleanup:", error);
      showSnackbar("Failed to cleanup tags", "error");
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(tags, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tags-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    showSnackbar("Tags exported successfully");
  };

  const refreshData = () => {
    if (orgId) {
      list({ orgId, search: searchQuery, category: selectedCategory });
      Promise.all([
        count({ orgId, include_categories: true }),
        getStats(orgId)
      ]).then(([countResult, stats]) => {
        setCounts({
          total: countResult.count || 0,
          by_category: countResult.by_category || {}
        });
        setDetailedStats(stats);
      });
    }
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const availableMergeTargets = tags.filter(t => !selectedTags.includes(t.tagId));

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", pb: 4 }}>
      <Container maxWidth="2xl" sx={{ pt: 3 }}>
        <Stack spacing={3}>
          {/* Header */}
          <Box
            sx={{
              background: `linear-gradient(135deg, ${alpha(
                theme.palette.primary.main,
                0.1
              )} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
              borderRadius: 3,
              p: 3,
              border: 2,
              borderColor: "primary.light",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", sm: "center" }}
              spacing={2}
            >
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "primary.main",
                    boxShadow: 3,
                  }}
                >
                  <LabelIcon sx={{ fontSize: 36, color: "white" }} />
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight={700} gutterBottom>
                    Tags Management
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    Organize and manage tags for tickets
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Tooltip title="More actions">
                  <IconButton
                    onClick={(e) => setBulkMenuAnchor(e.currentTarget)}
                    sx={{
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.2) },
                    }}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Tooltip>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setFormOpen(true)}
                  size="large"
                  sx={{
                    borderRadius: 2,
                    px: 3,
                    py: 1.5,
                    boxShadow: 3,
                    fontWeight: 600,
                    "&:hover": {
                      boxShadow: 6,
                      transform: "translateY(-2px)",
                    },
                    transition: "all 0.3s",
                  }}
                >
                  Create Tag
                </Button>
              </Stack>
            </Stack>
          </Box>

          {/* Bulk Actions Bar */}
          {selectedTags.length > 0 && (
            <Paper
              elevation={3}
              sx={{
                p: 2,
                borderRadius: 3,
                bgcolor: "primary.main",
                color: "white",
              }}
            >
              <Stack direction="row" alignItems="center" spacing={2}>
                <Typography fontWeight={600}>
                  {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Button
                  startIcon={<MergeIcon />}
                  onClick={() => setMergeDialogOpen(true)}
                  sx={{ color: "white", borderColor: "white" }}
                  variant="outlined"
                  disabled={selectedTags.length < 2}
                >
                  Merge
                </Button>
                <Button
                  startIcon={<DeleteSweepIcon />}
                  onClick={() => setBulkDeleteOpen(true)}
                  sx={{ color: "white", borderColor: "white" }}
                  variant="outlined"
                >
                  Delete
                </Button>
                <IconButton onClick={handleDeselectAll} sx={{ color: "white" }}>
                  <CloseIcon />
                </IconButton>
              </Stack>
            </Paper>
          )}

          {/* Stats Cards */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <StatsCard
                icon={LabelIcon}
                label="Total Tags"
                value={stats.total}
                color="primary"
                loading={statsLoading}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatsCard
                icon={CategoryIcon}
                label="Categories"
                value={stats.categories}
                color="info"
                loading={statsLoading}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatsCard
                icon={TrendingUpIcon}
                label="Total Usage"
                value={stats.totalUsage}
                color="success"
                loading={statsLoading}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatsCard
                icon={TagIcon}
                label="Unused"
                value={stats.unused}
                color="warning"
                loading={statsLoading}
              />
            </Grid>
          </Grid>

          {/* Filters */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: 2,
              borderColor: "divider",
            }}
          >
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
              <TextField
                placeholder="Search tags by name or description..."
                value={searchQuery}
                onChange={handleSearch}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchQuery("")}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ flexGrow: 1, minWidth: { xs: "100%", sm: 300 } }}
              />
              
              <Button
                variant={selectedCategory ? "contained" : "outlined"}
                startIcon={<FilterIcon />}
                onClick={(e) => setFilterAnchor(e.currentTarget)}
                sx={{ borderRadius: 2, minWidth: 150 }}
              >
                {selectedCategory || "All Categories"}
              </Button>
              
              {selectedCategory && (
                <Tooltip title="Clear filter">
                  <IconButton
                    size="small"
                    onClick={() => setSelectedCategory("")}
                    sx={{
                      bgcolor: "error.light",
                      color: "error.main",
                      "&:hover": { bgcolor: "error.main", color: "white" },
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              <Stack direction="row" spacing={1}>
                <Tooltip title="Select all">
                  <IconButton onClick={handleSelectAll} color="primary">
                    <SelectAllIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Deselect all">
                  <IconButton onClick={handleDeselectAll}>
                    <DeselectIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Paper>

          {/* Tags Grid */}
          <Grid container spacing={2}>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
                  <TagCardSkeleton />
                </Grid>
              ))
            ) : tags.length === 0 ? (
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 6,
                    textAlign: "center",
                    borderRadius: 3,
                    border: 2,
                    borderStyle: "dashed",
                    borderColor: "divider",
                  }}
                >
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      margin: "0 auto 16px",
                    }}
                  >
                    <TagIcon sx={{ fontSize: 48, color: "primary.main" }} />
                  </Box>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    No tags found
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {searchQuery || selectedCategory
                      ? "Try adjusting your filters to find tags"
                      : "Create your first tag to organize tickets"}
                  </Typography>
                  {!searchQuery && !selectedCategory && (
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => setFormOpen(true)}
                      sx={{ mt: 3, borderRadius: 2, px: 3 }}
                    >
                      Create First Tag
                    </Button>
                  )}
                </Paper>
              </Grid>
            ) : (
              tags.map((tag) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={tag.tagId}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      height: "100%",
                      borderRadius: 3,
                      border: 2,
                      borderColor: selectedTags.includes(tag.tagId) ? "primary.main" : "divider",
                      bgcolor: selectedTags.includes(tag.tagId) ? alpha(theme.palette.primary.main, 0.05) : "background.paper",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      "&:hover": {
                        transform: "translateY(-4px)",
                        boxShadow: 6,
                        borderColor: tag.color || "primary.main",
                      },
                    }}
                  >
                    <Stack spacing={2} height="100%">
                      {/* Tag Header */}
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Checkbox
                          checked={selectedTags.includes(tag.tagId)}
                          onChange={() => handleSelectTag(tag.tagId)}
                          size="small"
                        />
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: `linear-gradient(135deg, ${tag.color}30 0%, ${tag.color}15 100%)`,
                            border: 2,
                            borderColor: `${tag.color}40`,
                          }}
                        >
                          <TagIcon sx={{ color: tag.color || "#808080", fontSize: 28 }} />
                        </Box>
                        <Typography
                          variant="h6"
                          fontWeight={700}
                          sx={{ flexGrow: 1, color: "text.primary" }}
                          noWrap
                        >
                          {tag.name}
                        </Typography>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Edit tag">
                            <IconButton
                              size="small"
                              onClick={() => handleEdit(tag)}
                              sx={{
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.2) },
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete tag">
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(tag)}
                              sx={{
                                bgcolor: alpha(theme.palette.error.main, 0.1),
                                "&:hover": { bgcolor: alpha(theme.palette.error.main, 0.2) },
                              }}
                            >
                              <DeleteIcon fontSize="small" color="error" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Stack>

                      {/* Tag Details */}
                      <Box sx={{ flexGrow: 1 }}>
                        {tag.description ? (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              minHeight: 40,
                            }}
                          >
                            {tag.description}
                          </Typography>
                        ) : (
                          <Typography
                            variant="body2"
                            color="text.disabled"
                            fontStyle="italic"
                            sx={{ minHeight: 40 }}
                          >
                            No description
                          </Typography>
                        )}
                      </Box>

                      {/* Tags and Badges */}
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {tag.category && (
                          <Chip
                            label={tag.category}
                            size="small"
                            icon={<CategoryIcon />}
                            sx={{
                              borderRadius: 2,
                              fontWeight: 600,
                              bgcolor: alpha(theme.palette.info.main, 0.1),
                              color: "info.main",
                            }}
                          />
                        )}
                        <Chip
                          label={`${tag.usageCount} uses`}
                          size="small"
                          sx={{
                            borderRadius: 2,
                            fontWeight: 600,
                            bgcolor: alpha(theme.palette.success.main, 0.1),
                            color: "success.main",
                          }}
                        />
                      </Stack>

                      {/* Color Bar */}
                      <Box
                        sx={{
                          height: 8,
                          background: `linear-gradient(90deg, ${tag.color} 0%, ${tag.color}80 100%)`,
                          borderRadius: 2,
                          boxShadow: `0 2px 8px ${tag.color}40`,
                        }}
                      />
                    </Stack>
                  </Paper>
                </Grid>
              ))
            )}
          </Grid>
        </Stack>

        {/* Bulk Actions Menu */}
        <Menu
          anchorEl={bulkMenuAnchor}
          open={Boolean(bulkMenuAnchor)}
          onClose={() => setBulkMenuAnchor(null)}
          PaperProps={{ sx: { borderRadius: 2, minWidth: 200 } }}
        >
          <MenuItem onClick={() => { setCleanupDialogOpen(true); setBulkMenuAnchor(null); }}>
            <CleanupIcon sx={{ mr: 1 }} />
            Cleanup Unused Tags
          </MenuItem>
          <MenuItem onClick={() => { handleExport(); setBulkMenuAnchor(null); }}>
            <ExportIcon sx={{ mr: 1 }} />
            Export Tags
          </MenuItem>
        </Menu>

        {/* Category Filter Menu */}
        <Menu
          anchorEl={filterAnchor}
          open={Boolean(filterAnchor)}
          onClose={() => setFilterAnchor(null)}
          PaperProps={{
            sx: { borderRadius: 2, minWidth: 200 },
          }}
        >
          <MenuItem
            onClick={() => handleCategoryFilter("")}
            selected={!selectedCategory}
          >
            <Typography fontWeight={!selectedCategory ? 700 : 400}>
              All Categories
            </Typography>
          </MenuItem>
          {categories.map((category) => (
            <MenuItem
              key={category}
              onClick={() => handleCategoryFilter(category)}
              selected={selectedCategory === category}
            >
              <Stack direction="row" alignItems="center" spacing={1} width="100%">
                <CategoryIcon fontSize="small" />
                <Typography fontWeight={selectedCategory === category ? 700 : 400}>
                  {category}
                </Typography>
                {counts.by_category[category] && (
                  <Chip
                    label={counts.by_category[category]}
                    size="small"
                    sx={{ ml: "auto", height: 20, fontSize: "0.7rem" }}
                  />
                )}
              </Stack>
            </MenuItem>
          ))}
        </Menu>

        {/* Tag Form Dialog */}
        <TagForm
          open={formOpen}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          tag={selectedTag}
          orgId={orgId}
        />

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={confirmDelete}
          title="Delete Tag"
          content={
            <Box>
              <Typography gutterBottom>
                Are you sure you want to delete the tag <strong>"{tagToDelete?.name}"</strong>?
              </Typography>
              {tagToDelete?.usageCount > 0 && (
                <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                  This tag is currently used by <strong>{tagToDelete.usageCount}</strong> tickets.
                  Deleting it will remove it from all associated tickets.
                </Alert>
              )}
            </Box>
          }
          confirmText="Delete"
          confirmColor="error"
        />

        {/* Bulk Delete Dialog */}
        <ConfirmDialog
          open={bulkDeleteOpen}
          onClose={() => setBulkDeleteOpen(false)}
          onConfirm={handleBulkDelete}
          title="Bulk Delete Tags"
          content={
            <Box>
              <Typography gutterBottom>
                Are you sure you want to delete <strong>{selectedTags.length}</strong> selected tag{selectedTags.length !== 1 ? 's' : ''}?
              </Typography>
              <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                This action will remove these tags from all associated tickets.
              </Alert>
            </Box>
          }
          confirmText="Delete All"
          confirmColor="error"
        />

        {/* Merge Dialog */}
        <Dialog open={mergeDialogOpen} onClose={() => setMergeDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Stack direction="row" alignItems="center" spacing={2}>
              <MergeIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Merge Tags
              </Typography>
            </Stack>
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 3 }}>
            <Stack spacing={3}>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Merge {selectedTags.length} selected tags into a target tag. All tickets will be updated.
              </Alert>
              <FormControl fullWidth>
                <InputLabel>Target Tag</InputLabel>
                <Select
                  value={mergeTarget}
                  onChange={(e) => setMergeTarget(e.target.value)}
                  label="Target Tag"
                >
                  {availableMergeTargets.map(tag => (
                    <MenuItem key={tag.tagId} value={tag.tagId}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            borderRadius: 1,
                            bgcolor: tag.color,
                          }}
                        />
                        <Typography>{tag.name}</Typography>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Checkbox
                  checked={deleteAfterMerge}
                  onChange={(e) => setDeleteAfterMerge(e.target.checked)}
                />
                <Typography variant="body2">
                  Delete source tags after merging
                </Typography>
              </Stack>
            </Stack>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 2.5 }}>
            <Button onClick={() => setMergeDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleMerge}
              disabled={!mergeTarget}
              startIcon={<MergeIcon />}
            >
              Merge Tags
            </Button>
          </DialogActions>
        </Dialog>

        {/* Cleanup Dialog */}
        <Dialog open={cleanupDialogOpen} onClose={() => setCleanupDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Stack direction="row" alignItems="center" spacing={2}>
              <CleanupIcon color="warning" />
              <Typography variant="h6" fontWeight={600}>
                Cleanup Unused Tags
              </Typography>
            </Stack>
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 3 }}>
            <Stack spacing={3}>
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                This will permanently delete tags that haven't been used in the specified time period.
              </Alert>
              <TextField
                label="Unused for (days)"
                type="number"
                value={cleanupDays}
                onChange={(e) => setCleanupDays(Number(e.target.value))}
                fullWidth
                inputProps={{ min: 1 }}
                helperText="Delete tags unused for this many days"
              />
              <Typography variant="body2" color="text.secondary">
                Current unused tags: <strong>{stats.unused}</strong>
              </Typography>
            </Stack>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 2.5 }}>
            <Button onClick={() => setCleanupDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="warning"
              onClick={handleCleanup}
              startIcon={<CleanupIcon />}
            >
              Cleanup Tags
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
            severity={snackbar.severity}
            sx={{ borderRadius: 2 }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
}