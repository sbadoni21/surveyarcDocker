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
  IconButton,
  alpha,
  useTheme,
  Divider,
} from "@mui/material";
import {
  ColorLens as ColorIcon,
  Close as CloseIcon,
  Palette as PaletteIcon,
  Check as CheckIcon,
  Category as CategoryIcon,
  Label as LabelIcon,
} from "@mui/icons-material";
import { useTags } from "@/providers/postGresPorviders/TagProvider";

const PREDEFINED_COLORS = [
  { name: "Red", value: "#f44336" },
  { name: "Pink", value: "#e91e63" },
  { name: "Purple", value: "#9c27b0" },
  { name: "Deep Purple", value: "#673ab7" },
  { name: "Indigo", value: "#3f51b5" },
  { name: "Blue", value: "#2196f3" },
  { name: "Light Blue", value: "#03a9f4" },
  { name: "Cyan", value: "#00bcd4" },
  { name: "Teal", value: "#009688" },
  { name: "Green", value: "#4caf50" },
  { name: "Light Green", value: "#8bc34a" },
  { name: "Lime", value: "#cddc39" },
  { name: "Yellow", value: "#ffeb3b" },
  { name: "Amber", value: "#ffc107" },
  { name: "Orange", value: "#ff9800" },
  { name: "Deep Orange", value: "#ff5722" },
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
  "Bug",
  "Feature",
  "Enhancement",
  "Documentation",
];

export default function TagForm({ open, onClose, onSubmit, tag, orgId }) {
  const theme = useTheme();
  const { create: createTag, update: updateTag, getCategories } = useTags();
  
  const [form, setForm] = useState({
    name: "",
    color: "#2196f3",
    description: "",
    category: "",
  });
  
  const [saving, setSaving] = useState(false);
  const [existingCategories, setExistingCategories] = useState([]);
  const [showCustomColor, setShowCustomColor] = useState(false);

  // Load existing categories
  useEffect(() => {
    if (open && orgId) {
      getCategories(orgId)
        .then(cats => setExistingCategories(Array.isArray(cats) ? cats : []))
        .catch(() => setExistingCategories([]));
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
  }, [tag, open]);

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
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3 }
      }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "primary.main",
                boxShadow: 2,
              }}
            >
              <LabelIcon sx={{ color: "white" }} />
            </Box>
            <Typography variant="h5" fontWeight={700}>
              {tag ? "Edit Tag" : "Create Tag"}
            </Typography>
          </Stack>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <Divider />
      
      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={3}>
          {/* Tag Name */}
          <TextField
            label="Tag Name"
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            fullWidth
            required
            placeholder="e.g., Bug, Feature Request, High Priority"
            InputProps={{
              startAdornment: <LabelIcon sx={{ mr: 1, color: "text.secondary" }} />,
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 2,
              },
            }}
          />

          {/* Description */}
          <TextField
            label="Description"
            value={form.description}
            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            fullWidth
            multiline
            rows={3}
            placeholder="Optional description for this tag"
            helperText="Describe when to use this tag"
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 2,
              },
            }}
          />

          {/* Category */}
          <Autocomplete
            freeSolo
            options={allCategories}
            value={form.category}
            onChange={(_, newValue) => setForm(prev => ({ ...prev, category: newValue || "" }))}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Category"
                placeholder="e.g., Priority, Type, Department"
                helperText="Optional category to group related tags"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <CategoryIcon sx={{ mr: 1, color: "text.secondary" }} />
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                  },
                }}
              />
            )}
          />

          {/* Color Picker */}
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
              <PaletteIcon sx={{ color: "text.secondary" }} />
              <Typography variant="subtitle1" fontWeight={600}>
                Tag Color
              </Typography>
              <Button
                size="small"
                onClick={() => setShowCustomColor(!showCustomColor)}
                sx={{ ml: "auto", borderRadius: 2 }}
              >
                {showCustomColor ? "Presets" : "Custom"}
              </Button>
            </Stack>

            {showCustomColor ? (
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  label="Hex Color"
                  value={form.color}
                  onChange={(e) => setForm(prev => ({ ...prev, color: e.target.value }))}
                  size="small"
                  placeholder="#000000"
                  sx={{ flexGrow: 1 }}
                />
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm(prev => ({ ...prev, color: e.target.value }))}
                  style={{
                    width: 60,
                    height: 40,
                    border: `2px solid ${theme.palette.divider}`,
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                />
              </Stack>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))",
                  gap: 1.5,
                }}
              >
                {PREDEFINED_COLORS.map((color) => (
                  <Box
                    key={color.value}
                    onClick={() => setForm(prev => ({ ...prev, color: color.value }))}
                    sx={{
                      position: "relative",
                      width: "100%",
                      paddingBottom: "100%",
                      backgroundColor: color.value,
                      borderRadius: 2,
                      cursor: "pointer",
                      border: 3,
                      borderColor: form.color === color.value ? "primary.main" : "transparent",
                      transition: "all 0.2s",
                      "&:hover": {
                        transform: "scale(1.1)",
                        boxShadow: 4,
                      },
                    }}
                  >
                    {form.color === color.value && (
                      <Box
                        sx={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                          bgcolor: "white",
                          borderRadius: "50%",
                          width: 24,
                          height: 24,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: 2,
                        }}
                      >
                        <CheckIcon sx={{ fontSize: 16, color: color.value }} />
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          {/* Preview */}
          <Box
            sx={{
              p: 3,
              borderRadius: 3,
              border: 2,
              borderColor: "divider",
              bgcolor: alpha(theme.palette.background.default, 0.5),
            }}
          >
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Preview
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                label={form.name || "Tag Name"}
                icon={<LabelIcon />}
                sx={{
                  height: 32,
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  bgcolor: `${form.color}20`,
                  color: form.color,
                  border: 2,
                  borderColor: `${form.color}40`,
                  "& .MuiChip-icon": {
                    color: form.color,
                  },
                }}
              />
              <Chip
                label={form.name || "Tag Name"}
                icon={<ColorIcon />}
                sx={{
                  height: 32,
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  bgcolor: form.color,
                  color: "white",
                  "& .MuiChip-icon": {
                    color: "white",
                  },
                }}
              />
              <Chip
                label={form.name || "Tag Name"}
                variant="outlined"
                icon={<LabelIcon />}
                sx={{
                  height: 32,
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  borderColor: form.color,
                  color: form.color,
                  borderWidth: 2,
                  "& .MuiChip-icon": {
                    color: form.color,
                  },
                }}
              />
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2.5 }}>
        <Button 
          onClick={onClose} 
          disabled={saving}
          sx={{ borderRadius: 2, px: 3 }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={saving || !canSave}
          sx={{
            borderRadius: 2,
            px: 3,
            boxShadow: 2,
            "&:hover": { boxShadow: 4 },
          }}
        >
          {saving ? "Saving..." : tag ? "Update Tag" : "Create Tag"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}