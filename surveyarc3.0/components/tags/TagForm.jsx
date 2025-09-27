
// components/tags/TagForm.jsx
"use client";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Box,
  Typography,
  Autocomplete,
  Chip,
} from "@mui/material";
import { ColorLens as ColorIcon } from "@mui/icons-material";
import { useTags } from "@/providers/postGresPorviders/TagProvider";

const PREDEFINED_COLORS = [
  "#f44336", "#e91e63", "#9c27b0", "#673ab7",
  "#3f51b5", "#2196f3", "#03a9f4", "#00bcd4",
  "#009688", "#4caf50", "#8bc34a", "#cddc39",
  "#ffeb3b", "#ffc107", "#ff9800", "#ff5722",
];

const PREDEFINED_CATEGORIES = [
  "Priority",
  "Type",
  "Status",
  "Department",
  "Project",
  "Customer",
  "Internal",
  "External",
];

export default function TagForm({ open, onClose, onSubmit, tag, orgId }) {
  const { create: createTag, update: updateTag, getCategories } = useTags();
  
  const [form, setForm] = useState({
    name: "",
    color: "#2196f3",
    description: "",
    category: "",
  });
  
  const [saving, setSaving] = useState(false);
  const [existingCategories, setExistingCategories] = useState([]);

  // Load existing categories
  useEffect(() => {
    if (open && orgId) {
      getCategories(orgId).then(setExistingCategories).catch(() => {});
    }
  }, [open, orgId, getCategories]);

  // Populate form when editing
  useEffect(() => {
    if (tag) {
      setForm({
        name: tag.name || "",
        color: tag.color || "#2196f3",
        description: tag.description || "",
        category: tag.category || "",
      });
    } else {
      setForm({
        name: "",
        color: "#2196f3",
        description: "",
        category: "",
      });
    }
  }, [tag]);



 const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        orgId,
        name: form.name.trim(),
        color: form.color,
        description: form.description.trim() || null,
        category: form.category.trim() || null,
      };

      if (tag) {
        await updateTag(tag.tagId, payload);
      } else {
        await createTag(payload);
      }
      onSubmit?.();
    } catch (error) {
      console.error("Failed to save tag:", error);
    } finally {
      setSaving(false);
    }
  };


  const canSave = form.name.trim().length > 0;
  
  // Combine existing and predefined categories
  const allCategories = [
    ...new Set([...existingCategories, ...PREDEFINED_CATEGORIES])
  ].sort();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {tag ? "Edit Tag" : "Create Tag"}
      </DialogTitle>
      
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
  <TextField
    label="Tag Name"
    value={form.name}
    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
    fullWidth
    required
    placeholder="e.g., Bug, Feature Request, High Priority"
  />

  <TextField
    label="Description"
    value={form.description}
    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
    fullWidth
    multiline
    rows={2}
    placeholder="Optional description for this tag"
  />

  <Autocomplete
    freeSolo
    options={allCategories}
    value={form.category}
    onChange={(_, newValue) => setForm(prev => ({ ...prev, category: newValue || "" }))}
    renderInput={(params) => (
      <TextField {...params} label="Category" placeholder="e.g., Priority, Type, Department" helperText="Optional category to group related tags" />
    )}
  />

          {/* Color Picker */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Tag Color
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {PREDEFINED_COLORS.map((color) => (
                <Box
                  key={color}
                  sx={{
                    width: 32,
                    height: 32,
                    backgroundColor: color,
                    borderRadius: 1,
                    cursor: "pointer",
                    border: form.color === color ? "3px solid #000" : "1px solid #ccc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
      onClick={() => setForm(prev => ({ ...prev, color }))}
                >
                  {form.color === color && <ColorIcon sx={{ color: "white", fontSize: 16 }} />}
                </Box>
              ))}
            </Stack>
            
           <TextField
    label="Custom Color"
    value={form.color}
    onChange={(e) => setForm(prev => ({ ...prev, color: e.target.value }))}
    type="color"
    size="small"
    sx={{ mt: 1, width: 100 }}
  />
          </Box>

          {/* Preview */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Preview
            </Typography>
            <Chip
              label={form.name || "Tag Name"}
              sx={{
                backgroundColor: `${form.color}20`,
                borderColor: form.color,
                color: form.color,
              }}
              variant="outlined"
              icon={<ColorIcon sx={{ color: form.color }} />}
            />
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={saving || !canSave}
        >
          {saving ? "Saving..." : tag ? "Update" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}