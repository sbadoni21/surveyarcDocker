// components/calendars/BusinessHoursForm.jsx
"use client";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Paper,
  Typography,
  IconButton,
  Alert,
  Box,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon } from "@mui/icons-material";

const WEEKDAYS = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const totalMinutes = i * 15;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  return { value: totalMinutes, label: timeString };
});

const QUICK_PRESETS = [
  { name: "Standard Business (9-5)", hours: [
    { weekday: 0, start_min: 540, end_min: 1020 }, // Mon 9-17
    { weekday: 1, start_min: 540, end_min: 1020 }, // Tue 9-17
    { weekday: 2, start_min: 540, end_min: 1020 }, // Wed 9-17
    { weekday: 3, start_min: 540, end_min: 1020 }, // Thu 9-17
    { weekday: 4, start_min: 540, end_min: 1020 }, // Fri 9-17
  ]},
  { name: "Extended Business (8-6)", hours: [
    { weekday: 0, start_min: 480, end_min: 1080 }, // Mon 8-18
    { weekday: 1, start_min: 480, end_min: 1080 }, // Tue 8-18
    { weekday: 2, start_min: 480, end_min: 1080 }, // Wed 8-18
    { weekday: 3, start_min: 480, end_min: 1080 }, // Thu 8-18
    { weekday: 4, start_min: 480, end_min: 1080 }, // Fri 8-18
  ]},
  { name: "24/7 Support", hours: WEEKDAYS.map(day => ({
    weekday: day.value,
    start_min: 0,
    end_min: 1440
  }))},
];

export default function BusinessHoursForm({ open, onClose, calendar, onSubmit }) {
  const [hours, setHours] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && calendar) {
      setHours(calendar.hours ? [...calendar.hours] : []);
      setErrors({});
    }
  }, [open, calendar]);

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const addHour = () => {
    setHours(prev => [...prev, { 
      weekday: 0, 
      start_min: 540, // 9:00 AM
      end_min: 1020   // 5:00 PM
    }]);
  };

  const removeHour = (index) => {
    setHours(prev => prev.filter((_, i) => i !== index));
  };

  const updateHour = (index, field, value) => {
    setHours(prev => prev.map((hour, i) => 
      i === index ? { ...hour, [field]: value } : hour
    ));
  };

  const applyPreset = (preset) => {
    setHours([...preset.hours]);
  };

  const validateForm = () => {
    const newErrors = {};

    hours.forEach((hour, index) => {
      if (hour.start_min >= hour.end_min) {
        newErrors[`hour_${index}`] = "Start time must be before end time";
      }
    });

    // Check for overlapping hours on the same day
    const dayGroups = hours.reduce((acc, hour, index) => {
      if (!acc[hour.weekday]) acc[hour.weekday] = [];
      acc[hour.weekday].push({ ...hour, index });
      return acc;
    }, {});

    Object.entries(dayGroups).forEach(([weekday, dayHours]) => {
      if (dayHours.length > 1) {
        dayHours.sort((a, b) => a.start_min - b.start_min);
        for (let i = 0; i < dayHours.length - 1; i++) {
          if (dayHours[i].end_min > dayHours[i + 1].start_min) {
            newErrors[`hour_${dayHours[i].index}`] = "Overlapping hours on same day";
            newErrors[`hour_${dayHours[i + 1].index}`] = "Overlapping hours on same day";
          }
        }
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
      await onSubmit(hours);
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
          Edit Business Hours - {calendar?.name}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {errors.submit && (
              <Alert severity="error">{errors.submit}</Alert>
            )}

            {/* Quick Presets */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Quick Presets
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {QUICK_PRESETS.map((preset) => (
                  <Button
                    key={preset.name}
                    size="small"
                    variant="outlined"
                    onClick={() => applyPreset(preset)}
                    sx={{ mb: 1 }}
                  >
                    {preset.name}
                  </Button>
                ))}
              </Stack>
            </Box>

            {/* Business Hours List */}
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="subtitle2">
                  Business Hours ({hours.length})
                </Typography>
                <Button
                  startIcon={<AddIcon />}
                  size="small"
                  variant="outlined"
                  onClick={addHour}
                >
                  Add Hours
                </Button>
              </Stack>

              {hours.length === 0 ? (
                <Alert severity="info">
                  No business hours configured. Add hours or use a preset above.
                </Alert>
              ) : (
                <Stack spacing={2}>
                  {hours.map((hour, index) => (
                    <Paper 
                      key={index} 
                      variant="outlined" 
                      sx={{ p: 2, bgcolor: errors[`hour_${index}`] ? "error.light" : "background.paper" }}
                    >
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <InputLabel>Day</InputLabel>
                          <Select
                            value={hour.weekday}
                            label="Day"
                            onChange={(e) => updateHour(index, "weekday", e.target.value)}
                          >
                            {WEEKDAYS.map((day) => (
                              <MenuItem key={day.value} value={day.value}>
                                {day.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <InputLabel>Start</InputLabel>
                          <Select
                            value={hour.start_min}
                            label="Start"
                            onChange={(e) => updateHour(index, "start_min", e.target.value)}
                          >
                            {TIME_OPTIONS.map((time) => (
                              <MenuItem key={time.value} value={time.value}>
                                {time.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <InputLabel>End</InputLabel>
                          <Select
                            value={hour.end_min}
                            label="End"
                            onChange={(e) => updateHour(index, "end_min", e.target.value)}
                          >
                            {TIME_OPTIONS.map((time) => (
                              <MenuItem key={time.value} value={time.value}>
                                {time.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                          {Math.round((hour.end_min - hour.start_min) / 60 * 10) / 10}h
                        </Typography>

                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={() => removeHour(index)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Stack>

                      {errors[`hour_${index}`] && (
                        <Alert severity="error" sx={{ mt: 1 }}>
                          {errors[`hour_${index}`]}
                        </Alert>
                      )}
                    </Paper>
                  ))}
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
            {submitting ? "Saving..." : "Save Hours"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}