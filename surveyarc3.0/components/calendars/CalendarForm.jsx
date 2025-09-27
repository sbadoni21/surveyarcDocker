// components/calendars/CalendarForm.jsx
"use client";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Stack,
  Grid,
  Alert,
} from "@mui/material";

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago", 
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Seoul",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "Australia/Melbourne",
];

export default function CalendarForm({ 
  open, 
  onClose, 
  orgId, 
  currentUserId, 
  editingCalendar = null,
  onSubmit 
}) {
  const [formData, setFormData] = useState({
    name: "",
    timezone: "UTC",
    active: true,
    meta: {},
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const isEditing = !!editingCalendar;

  useEffect(() => {
    if (editingCalendar) {
      setFormData({
        name: editingCalendar.name || "",
        timezone: editingCalendar.timezone || "UTC",
        active: editingCalendar.active ?? true,
        meta: editingCalendar.meta || {},
      });
    } else {
      setFormData({
        name: "",
        timezone: "UTC",
        active: true,
        meta: {},
      });
    }
    setErrors({});
  }, [editingCalendar, open]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Calendar name is required";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Calendar name must be at least 2 characters";
    }

    if (!formData.timezone) {
      newErrors.timezone = "Timezone is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      
      const payload = {
        name: formData.name.trim(),
        timezone: formData.timezone,
        active: formData.active,
        meta: formData.meta,
      };

      if (!isEditing) {
        payload.org_id = orgId;
      }

      await onSubmit(payload);
    } catch (error) {
      console.error("Form submission error:", error);
      setErrors({ submit: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onClose();
    }
  };

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {isEditing ? "Edit Calendar" : "Create New Calendar"}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {errors.submit && (
              <Alert severity="error">{errors.submit}</Alert>
            )}

            <TextField
              label="Calendar Name"
              value={formData.name}
              onChange={handleChange("name")}
              error={!!errors.name}
              helperText={errors.name}
              required
              fullWidth
              placeholder="e.g., Support Team Hours, Sales Calendar"
            />

            <FormControl fullWidth error={!!errors.timezone}>
              <InputLabel>Timezone</InputLabel>
              <Select
                value={formData.timezone}
                label="Timezone"
                onChange={handleChange("timezone")}
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <MenuItem key={tz} value={tz}>
                    {tz}
                  </MenuItem>
                ))}
              </Select>
              {errors.timezone && (
                <div style={{ color: "#d32f2f", fontSize: "0.75rem", marginTop: "3px", marginLeft: "14px" }}>
                  {errors.timezone}
                </div>
              )}
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={formData.active}
                  onChange={handleChange("active")}
                  color="primary"
                />
              }
              label="Active Calendar"
              sx={{ alignSelf: "flex-start" }}
            />

            {isEditing && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Calendar ID"
                    value={editingCalendar.calendar_id}
                    disabled
                    fullWidth
                    size="small"
                    sx={{ 
                      "& .MuiInputBase-input": { 
                        fontFamily: "monospace",
                        fontSize: "0.875rem"
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Organization ID"
                    value={editingCalendar.org_id}
                    disabled
                    fullWidth
                    size="small"
                    sx={{ 
                      "& .MuiInputBase-input": { 
                        fontFamily: "monospace",
                        fontSize: "0.875rem"
                      }
                    }}
                  />
                </Grid>
              </Grid>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="contained"
            disabled={submitting}
          >
            {submitting 
              ? (isEditing ? "Updating..." : "Creating...") 
              : (isEditing ? "Update Calendar" : "Create Calendar")
            }
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}