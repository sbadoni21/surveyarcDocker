// components/common/ConfirmDialog.jsx
"use client";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  IconButton,
  Divider,
} from "@mui/material";
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Close as CloseIcon,
} from "@mui/icons-material";

const SEVERITY_CONFIG = {
  warning: {
    icon: WarningIcon,
    color: "warning",
    alertSeverity: "warning",
  },
  error: {
    icon: ErrorIcon,
    color: "error", 
    alertSeverity: "error",
  },
  info: {
    icon: InfoIcon,
    color: "info",
    alertSeverity: "info",
  },
  success: {
    icon: SuccessIcon,
    color: "success",
    alertSeverity: "success",
  },
};

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  content,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmColor = "primary",
  severity = "warning",
  showCloseButton = true,
  loading = false,
  disabled = false,
  maxWidth = "sm",
  fullWidth = true,
  disableBackdropClick = false,
  disableEscapeKeyDown = false,
  alertMessage = null,
  alertSeverity = "warning",
  children,
}) {
  const severityConfig = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.warning;
  const SeverityIcon = severityConfig.icon;

  const handleClose = (event, reason) => {
    if (disableBackdropClick && reason === "backdropClick") {
      return;
    }
    if (disableEscapeKeyDown && reason === "escapeKeyDown") {
      return;
    }
    if (loading) return; // Prevent closing while loading
    onClose();
  };

  const handleConfirm = () => {
    if (loading || disabled) return;
    onConfirm();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      PaperProps={{
        sx: {
          borderRadius: 2,
          minWidth: 300,
        }
      }}
    >
      {/* Header */}
      <DialogTitle 
        id="confirm-dialog-title"
        sx={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 1.5,
          pb: 1,
        }}
      >
        <SeverityIcon 
          color={severityConfig.color} 
          sx={{ fontSize: 28 }}
        />
        <Typography variant="h6" component="span" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        {showCloseButton && !loading && (
          <IconButton
            aria-label="close"
            onClick={onClose}
            size="small"
            sx={{ color: "text.secondary" }}
          >
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>

      <Divider />

      {/* Content */}
      <DialogContent sx={{ pt: 2 }}>
        <Box id="confirm-dialog-description">
          {/* Alert Message */}
          {alertMessage && (
            <Alert 
              severity={alertSeverity} 
              sx={{ mb: 2 }}
              variant="outlined"
            >
              {alertMessage}
            </Alert>
          )}

          {/* Main Content */}
          {content && (
            <Box sx={{ mb: children ? 2 : 0 }}>
              {typeof content === "string" ? (
                <Typography variant="body1" color="text.primary">
                  {content}
                </Typography>
              ) : (
                content
              )}
            </Box>
          )}

          {/* Custom Children */}
          {children}
        </Box>
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button
          onClick={onClose}
          color="inherit"
          variant="outlined"
          disabled={loading}
          size="medium"
        >
          {cancelText}
        </Button>
        <Button
          onClick={handleConfirm}
          color={confirmColor}
          variant="contained"
          disabled={loading || disabled}
          size="medium"
          startIcon={loading ? <CircularProgress size={16} /> : null}
          sx={{ minWidth: 100 }}
        >
          {loading ? "Processing..." : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
