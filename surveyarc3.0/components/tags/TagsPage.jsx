// components/tags/TagsPage.jsx
"use client";
import { useEffect, useState } from "react";
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
} from "@mui/material";
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocalOffer as TagIcon,
} from "@mui/icons-material";
import { usePathname } from "next/navigation";
import TagForm from "./TagForm";
import ConfirmDialog from "../common/ConfirmDialog";
import { useTags } from "@/providers/postGresPorviders/TagProvider";

export default function TagsPage() {
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
  } = useTags();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState(null);
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [counts, setCounts] = useState({ total: 0 });

  // Load tags and categories
  useEffect(() => {
    if (orgId) {
      list({ orgId, search: searchQuery, category: selectedCategory });
      count({ orgId }).then(result => setCounts(prev => ({ ...prev, total: result.count || 0 })));
    }
  }, [orgId, searchQuery, selectedCategory, list, getCategories, count]);

useEffect(() => {
  if (orgId) {
    getCategories(orgId)
      .then(arr => setCategories(Array.isArray(arr) ? arr : []))
      .catch(() => setCategories([]));
  }
}, [orgId, getCategories]);
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
      } catch (error) {
        console.error("Failed to delete tag:", error);
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
    // Refresh the list
    if (orgId) {
      list({ orgId, search: searchQuery, category: selectedCategory });
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" gutterBottom>
              Tags Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage tags for organizing tickets ({counts.total} total)
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setFormOpen(true)}
          >
            Create Tag
          </Button>
        </Stack>

        {/* Filters */}
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              placeholder="Search tags..."
              value={searchQuery}
              onChange={handleSearch}
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 300 }}
            />
            
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              onClick={(e) => setFilterAnchor(e.currentTarget)}
            >
              Category: {selectedCategory || "All"}
            </Button>
            
            {selectedCategory && (
              <Button
                variant="text"
                size="small"
                onClick={() => setSelectedCategory("")}
              >
                Clear Filter
              </Button>
            )}
          </Stack>
        </Paper>

        {/* Tags Grid */}
        <Grid container spacing={2}>
          {loading ? (
            <Grid item xs={12}>
              <Paper sx={{ p: 4, textAlign: "center" }}>
                <Typography>Loading tags...</Typography>
              </Paper>
            </Grid>
          ) : tags.length === 0 ? (
            <Grid item xs={12}>
              <Paper sx={{ p: 4, textAlign: "center" }}>
                <TagIcon sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No tags found
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {searchQuery || selectedCategory
                    ? "Try adjusting your filters"
                    : "Create your first tag to get started"
                  }
                </Typography>
                {!searchQuery && !selectedCategory && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setFormOpen(true)}
                    sx={{ mt: 2 }}
                  >
                    Create Tag
                  </Button>
                )}
              </Paper>
            </Grid>
          ) : (
            tags.map((tag) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={tag.tagId}>
                <Paper sx={{ p: 2, height: "100%" }}>
                  <Stack spacing={2} height="100%">
                    {/* Tag Header */}
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <TagIcon sx={{ color: tag.color || "#808080" }} />
                      <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        {tag.name}
                      </Typography>
                      <Stack direction="row">
                        <IconButton size="small" onClick={() => handleEdit(tag)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(tag)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Stack>
                    </Stack>

                    {/* Tag Details */}
                    <Box sx={{ flexGrow: 1 }}>
                      {tag.description && (
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {tag.description}
                        </Typography>
                      )}
                      
                      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                        {tag.category && (
                          <Chip
                            label={tag.category}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        <Chip
                          label={`Used ${tag.usageCount} times`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </Stack>
                    </Box>

                    {/* Tag Color */}
                    <Box
                      sx={{
                        height: 8,
                        backgroundColor: tag.color || "#808080",
                        borderRadius: 1,
                      }}
                    />
                  </Stack>
                </Paper>
              </Grid>
            ))
          )}
        </Grid>

<Menu
  anchorEl={filterAnchor}
  open={Boolean(filterAnchor)}
  onClose={() => setFilterAnchor(null)}
>
  <MenuItem onClick={() => handleCategoryFilter("")}>
    <Typography>All Categories</Typography>
  </MenuItem>
  {(Array.isArray(categories) ? categories : []).map((category) => (
    <MenuItem key={category} onClick={() => handleCategoryFilter(category)}>
      <Typography>{category}</Typography>
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
                Are you sure you want to delete the tag "{tagToDelete?.name}"?
              </Typography>
              {tagToDelete?.usageCount > 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  This tag is currently used by {tagToDelete.usageCount} tickets.
                  Deleting it will remove it from all associated tickets.
                </Alert>
              )}
            </Box>
          }
          confirmText="Delete"
          confirmColor="error"
        />
      </Stack>
    </Container>
  );
}