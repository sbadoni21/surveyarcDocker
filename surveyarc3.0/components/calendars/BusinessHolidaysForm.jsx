// components/calendars/BusinessHolidaysForm.jsx
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
  Paper,
  Typography,
  IconButton,
  Alert,
  Box,
  Chip,
} from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon } from "@mui/icons-material";

const COMMON_HOLIDAYS = [
  { date: "01-01", name: "New Year's Day" },
  { date: "07-04", name: "Independence Day" },
  { date: "12-25", name: "Christmas Day" },
  { date: "11-25", name: "Thanksgiving" }, // Example for 2025
  { date: "05-26", name: "Memorial Day" }, // Example for 2025
  { date: "09-01", name: "Labor Day" }, // Example for 2025
  { date: "10-13", name: "Columbus Day" }, // Example for 2025
  { date: "11-11", name: "Veterans Day" },
];

export default function BusinessHolidaysForm({ open, onClose, calendar, onSubmit }) {
  const [holidays, setHolidays] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (open && calendar) {
      setHolidays(calendar.holidays ? [...calendar.holidays] : []);
      setErrors({});
    }
  }, [open, calendar]);

  const addHoliday = () => {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    
    setHolidays(prev => [...prev, { 
      date_iso: dateString,
      name: ""
    }]);
  };

  const addQuickHoliday = (holiday) => {
    const dateString = `${currentYear}-${holiday.date}`;
    
    // Check if this holiday already exists
    const exists = holidays.some(h => h.date_iso === dateString);
    if (exists) {
      return;
    }

    setHolidays(prev => [...prev, {
      date_iso: dateString,
      name: holiday.name
    }]);
  };

  const removeHoliday = (index) => {
    setHolidays(prev => prev.filter((_, i) => i !== index));
  };

  const updateHoliday = (index, field, value) => {
    setHolidays(prev => prev.map((holiday, i) => 
      i === index ? { ...holiday, [field]: value } : holiday
    ));
  };

  const validateForm = () => {
    const newErrors = {};

    holidays.forEach((holiday, index) => {
      if (!holiday.date_iso) {
        newErrors[`holiday_${index}_date`] = "Date is required";
      } else {
        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(holiday.date_iso)) {
          newErrors[`holiday_${index}_date`] = "Invalid date format";
        } else {
          // Check if date is valid
          const date = new Date(holiday.date_iso);
          if (isNaN(date.getTime())) {
            newErrors[`holiday_${index}_date`] = "Invalid date";
          }
        }
      }

      if (!holiday.name?.trim()) {
        newErrors[`holiday_${index}_name`] = "Holiday name is required";
      }
    });

    // Check for duplicate dates
    const dateGroups = holidays.reduce((acc, holiday, index) => {
      if (holiday.date_iso) {
        if (!acc[holiday.date_iso]) acc[holiday.date_iso] = [];
        acc[holiday.date_iso].push(index);
      }
      return acc;
    }, {});

    Object.entries(dateGroups).forEach(([date, indices]) => {
      if (indices.length > 1) {
        indices.forEach(index => {
          newErrors[`holiday_${index}_date`] = "Duplicate date";
        });
      }
    });

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
      // Filter out holidays without names and sort by date
      const validHolidays = holidays
        .filter(h => h.date_iso && h.name?.trim())
        .sort((a, b) => new Date(a.date_iso) - new Date(b.date_iso));
      
      await onSubmit(validHolidays);
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

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  // Sort holidays by date for display
  const sortedHolidays = [...holidays].sort((a, b) => {
    if (!a.date_iso || !b.date_iso) return 0;
    return new Date(a.date_iso) - new Date(b.date_iso);
  });

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          Edit Business Holidays - {calendar?.name}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {errors.submit && (
              <Alert severity="error">{errors.submit}</Alert>
            )}

            {/* Quick Add Common Holidays */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Common Holidays ({currentYear})
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {COMMON_HOLIDAYS.map((holiday) => {
                  const dateString = `${currentYear}-${holiday.date}`;
                  const exists = holidays.some(h => h.date_iso === dateString);
                  
                  return (
                    <Chip
                      key={holiday.date}
                      label={holiday.name}
                      variant={exists ? "filled" : "outlined"}
                      color={exists ? "primary" : "default"}
                      onClick={() => !exists && addQuickHoliday(holiday)}
                      disabled={exists}
                      sx={{ cursor: exists ? "default" : "pointer" }}
                    />
                  );
                })}
              </Box>
            </Box>

            {/* Business Holidays List */}
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="subtitle2">
                  Business Holidays ({holidays.length})
                </Typography>
                <Button
                  startIcon={<AddIcon />}
                  size="small"
                  variant="outlined"
                  onClick={addHoliday}
                >
                  Add Holiday
                </Button>
              </Stack>

              {holidays.length === 0 ? (
                <Alert severity="info">
                  No business holidays configured. Add holidays manually or use common holidays above.
                </Alert>
              ) : (
                <Stack spacing={2}>
                  {sortedHolidays.map((holiday, originalIndex) => {
                    // Find the original index for proper error handling
                    const index = holidays.findIndex(h => h === holiday);
                    
                    return (
                      <Paper 
                        key={index} 
                        variant="outlined" 
                        sx={{ 
                          p: 2, 
                          bgcolor: (errors[`holiday_${index}_date`] || errors[`holiday_${index}_name`]) 
                            ? "error.light" 
                            : "background.paper" 
                        }}
                      >
                        <Stack spacing={2}>
                          <Stack direction="row" alignItems="start" spacing={2}>
                            <TextField
                              label="Date"
                              type="date"
                              value={holiday.date_iso || ""}
                              onChange={(e) => updateHoliday(index, "date_iso", e.target.value)}
                              error={!!errors[`holiday_${index}_date`]}
                              helperText={errors[`holiday_${index}_date`]}
                              size="small"
                              sx={{ minWidth: 150 }}
                              InputLabelProps={{ shrink: true }}
                            />

                            <TextField
                              label="Holiday Name"
                              value={holiday.name || ""}
                              onChange={(e) => updateHoliday(index, "name", e.target.value)}
                              error={!!errors[`holiday_${index}_name`]}
                              helperText={errors[`holiday_${index}_name`]}
                              size="small"
                              fullWidth
                              placeholder="e.g., New Year's Day"
                            />

                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => removeHoliday(index)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Stack>

                          {holiday.date_iso && (
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(holiday.date_iso)}
                            </Typography>
                          )}
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Box>
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
            {submitting ? "Saving..." : "Save Holidays"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}