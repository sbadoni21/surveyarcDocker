// components/tickets/FileUpload.jsx
"use client";
import { useState, useRef, useCallback } from "react";
import {
  Box, Button, IconButton, LinearProgress, Paper, Stack, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Chip,
  List, ListItem, ListItemIcon, ListItemText, ListItemSecondaryAction,
  Divider, CircularProgress, Tooltip
} from "@mui/material";
import {
  CloudUpload, Delete, InsertDriveFile, Image, VideoFile, 
  Code, Description, Archive, Close, CheckCircle, Error,
  AttachFile, Visibility
} from "@mui/icons-material";
import firebaseStorageService from "@/services/firebaseStorage";
import AttachmentModel from "@/models/postGresModels/attachmentModel";

// File Upload Component for Ticket Form
export function TicketFileUpload({ 
  orgId, 
  ticketId, 
  currentUserId, 
  onFilesUploaded, 
  disabled = false,
  maxFiles = 10 
}) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [errors, setErrors] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileSelect = useCallback((event) => {
    const selectedFiles = Array.from(event.target.files);
    
    if (files.length + selectedFiles.length > maxFiles) {
      setErrors([`Maximum ${maxFiles} files allowed`]);
      return;
    }

    const newFiles = selectedFiles.map(file => ({
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      file,
      status: 'pending',
      progress: 0,
      error: null
    }));

    setFiles(prev => [...prev, ...newFiles]);
    setErrors([]);
  }, [files.length, maxFiles]);

  const handleDrop = useCallback((event) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files);
    
    if (files.length + droppedFiles.length > maxFiles) {
      setErrors([`Maximum ${maxFiles} files allowed`]);
      return;
    }

    const newFiles = droppedFiles.map(file => ({
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      file,
      status: 'pending',
      progress: 0,
      error: null
    }));

    setFiles(prev => [...prev, ...newFiles]);
    setErrors([]);
  }, [files.length, maxFiles]);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
  }, []);

  const removeFile = useCallback((fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const uploadFiles = useCallback(async () => {
    if (!orgId || !currentUserId || files.length === 0) return;

    setUploading(true);
    setErrors([]);
    
    const uploadPromises = files.map(async (fileItem) => {
      try {
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, status: 'uploading' } : f
        ));

        const result = await firebaseStorageService.uploadFile(
          fileItem.file,
          orgId,
          ticketId || 'temp',
          currentUserId,
          {
            onProgress: (progress) => {
              setFiles(prev => prev.map(f => 
                f.id === fileItem.id ? { ...f, progress } : f
              ));
            }
          }
        );

        // Create attachment record if ticket exists
        let attachmentRecord = null;
        if (ticketId) {
          const checksum = await firebaseStorageService.calculateChecksum(fileItem.file);
          
          attachmentRecord = await AttachmentModel.create(ticketId, {
            ticketId,
            filename: fileItem.file.name,
            contentType: fileItem.file.type,
            sizeBytes: fileItem.file.size,
            storageKey: result.storageKey,
            url: result.downloadURL,
            checksum,
            uploadedBy: currentUserId
          });
        }

        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'completed', 
            progress: 100,
            storageKey: result.storageKey,
            downloadURL: result.downloadURL,
            attachmentRecord
          } : f
        ));

        return {
          fileId: fileItem.id,
          filename: fileItem.file.name,
          storageKey: result.storageKey,
          downloadURL: result.downloadURL,
          contentType: fileItem.file.type,
          sizeBytes: fileItem.file.size,
          attachmentRecord
        };

      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'error', 
            error: error.message 
          } : f
        ));
        throw error;
      }
    });

    try {
      const results = await Promise.allSettled(uploadPromises);
      const successful = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
      
      const failed = results
        .filter(r => r.status === 'rejected')
        .map(r => r.reason.message);

      if (failed.length > 0) {
        setErrors(failed);
      }

      onFilesUploaded?.(successful);
      
      // Clear completed files after a delay
      setTimeout(() => {
        setFiles(prev => prev.filter(f => f.status !== 'completed'));
      }, 2000);

    } catch (error) {
      setErrors([error.message]);
    } finally {
      setUploading(false);
    }
  }, [files, orgId, ticketId, currentUserId, onFilesUploaded]);

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) return <Image color="primary" />;
    if (file.type.startsWith('video/')) return <VideoFile color="secondary" />;
    if (file.type.includes('pdf')) return <Description color="error" />;
    if (file.type.includes('zip') || file.type.includes('compressed')) return <Archive />;
    if (file.name.match(/\.(js|jsx|ts|tsx|py|java|cpp|c|h|css|html|json|md|txt)$/i)) return <Code color="success" />;
    return <InsertDriveFile />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box>
      {/* Upload Area */}
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          border: '2px dashed',
          borderColor: 'divider',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          bgcolor: disabled ? 'action.disabledBackground' : 'background.paper',
          '&:hover': {
            borderColor: disabled ? 'divider' : 'primary.main',
            bgcolor: disabled ? 'action.disabledBackground' : 'action.hover'
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <CloudUpload sx={{ fontSize: 48, color: 'action.active', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Drop files here or click to browse
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Support for images, videos, documents, code files and more
        </Typography>
        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
          Maximum {maxFiles} files, up to 100MB each
        </Typography>
      </Paper>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {/* File List */}
      {files.length > 0 && (
        <Paper variant="outlined" sx={{ mt: 2 }}>
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Selected Files ({files.length})
            </Typography>
          </Box>
          <Divider />
          <List dense>
            {files.map((fileItem) => (
              <ListItem key={fileItem.id}>
                <ListItemIcon>
                  {fileItem.status === 'completed' ? (
                    <CheckCircle color="success" />
                  ) : fileItem.status === 'error' ? (
                    <Error color="error" />
                  ) : fileItem.status === 'uploading' ? (
                    <CircularProgress size={24} />
                  ) : (
                    getFileIcon(fileItem.file)
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={fileItem.file.name}
                  secondary={
                    <Box>
                      <Typography variant="caption">
                        {formatFileSize(fileItem.file.size)}
                      </Typography>
                      {fileItem.status === 'uploading' && (
                        <LinearProgress 
                          variant="determinate" 
                          value={fileItem.progress} 
                          sx={{ mt: 0.5 }}
                        />
                      )}
                      {fileItem.error && (
                        <Typography variant="caption" color="error" display="block">
                          {fileItem.error}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  {fileItem.status === 'pending' && (
                    <IconButton 
                      edge="end" 
                      onClick={() => removeFile(fileItem.id)}
                      size="small"
                    >
                      <Delete />
                    </IconButton>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Upload Button */}
      {files.length > 0 && files.some(f => f.status === 'pending') && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button
            variant="contained"
            onClick={uploadFiles}
            disabled={uploading || disabled}
            startIcon={uploading ? <CircularProgress size={20} /> : <CloudUpload />}
          >
            {uploading ? 'Uploading...' : `Upload ${files.filter(f => f.status === 'pending').length} Files`}
          </Button>
        </Box>
      )}
    </Box>
  );
}

// Attachment Viewer Component for Ticket Details
export function TicketAttachments({ 
  ticketId, 
  currentUserId, 
  onAttachmentDeleted,
  readOnly = false 
}) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const loadAttachments = useCallback(async () => {
    if (!ticketId) return;
    
    try {
      setLoading(true);
      const data = await AttachmentModel.list(ticketId);
      setAttachments(data);
    } catch (error) {
      console.error('Failed to load attachments:', error);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useState(() => {
    loadAttachments();
  }, [loadAttachments]);

  const handleDelete = async (attachment) => {
    if (!window.confirm(`Delete ${attachment.filename}?`)) return;
    
    try {
      setDeleting(attachment.attachmentId);
      
      // Delete from storage
      await firebaseStorageService.deleteFile(attachment.storageKey);
      
      // Delete from database
      await AttachmentModel.remove(ticketId, attachment.attachmentId);
      
      setAttachments(prev => prev.filter(a => a.attachmentId !== attachment.attachmentId));
      onAttachmentDeleted?.(attachment);
      
    } catch (error) {
      console.error('Failed to delete attachment:', error);
      alert('Failed to delete attachment: ' + error.message);
    } finally {
      setDeleting(null);
    }
  };

  const handlePreview = (attachment) => {
    setPreviewFile(attachment);
    setPreviewOpen(true);
  };

  const getFileIcon = (attachment) => {
    if (attachment.contentType?.startsWith('image/')) return <Image color="primary" />;
    if (attachment.contentType?.startsWith('video/')) return <VideoFile color="secondary" />;
    if (attachment.contentType?.includes('pdf')) return <Description color="error" />;
    if (attachment.contentType?.includes('zip')) return <Archive />;
    if (AttachmentModel.isCodeFile(attachment.filename)) return <Code color="success" />;
    return <InsertDriveFile />;
  };

  const canPreview = (attachment) => {
    return attachment.contentType?.startsWith('image/') || 
           attachment.contentType?.startsWith('video/') ||
           attachment.contentType?.includes('pdf') ||
           AttachmentModel.isCodeFile(attachment.filename);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Attachments ({attachments.length})
        </Typography>
      </Box>

      {attachments.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <AttachFile sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
          <Typography color="text.secondary">
            No attachments yet
          </Typography>
        </Paper>
      ) : (
        <List>
          {attachments.map((attachment) => (
            <ListItem key={attachment.attachmentId} divider>
              <ListItemIcon>
                {getFileIcon(attachment)}
              </ListItemIcon>
              <ListItemText
                primary={attachment.filename}
                secondary={
                  <Box>
                    <Typography variant="caption">
                      {AttachmentModel.formatFileSize(attachment.sizeBytes)} • 
                      Uploaded {new Date(attachment.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <Stack direction="row" spacing={1}>
                  {canPreview(attachment) && (
                    <Tooltip title="Preview">
                      <IconButton 
                        size="small" 
                        onClick={() => handlePreview(attachment)}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                  )}
                  {attachment.url && (
                    <Tooltip title="Download">
                      <IconButton 
                        size="small"
                        component="a"
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <CloudUpload />
                      </IconButton>
                    </Tooltip>
                  )}
                  {!readOnly && (
                    <Tooltip title="Delete">
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => handleDelete(attachment)}
                        disabled={deleting === attachment.attachmentId}
                      >
                        {deleting === attachment.attachmentId ? (
                          <CircularProgress size={16} />
                        ) : (
                          <Delete />
                        )}
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}

      {/* Preview Dialog */}
      <AttachmentPreviewDialog
        open={previewOpen}
        attachment={previewFile}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewFile(null);
        }}
      />
    </Box>
  );
}

// Attachment Preview Dialog
function AttachmentPreviewDialog({ open, attachment, onClose }) {
  if (!attachment) return null;

  const isImage = attachment.contentType?.startsWith('image/');
  const isVideo = attachment.contentType?.startsWith('video/');
  const isPdf = attachment.contentType?.includes('pdf');
  const isCode = AttachmentModel.isCodeFile(attachment.filename);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{attachment.filename}</Typography>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ minHeight: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {isImage && (
            <img 
              src={attachment.url} 
              alt={attachment.filename}
              style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
            />
          )}
          {isVideo && (
            <video 
              controls 
              style={{ maxWidth: '100%', maxHeight: '70vh' }}
            >
              <source src={attachment.url} type={attachment.contentType} />
              Your browser does not support the video tag.
            </video>
          )}
          {isPdf && (
            <iframe
              src={attachment.url}
              width="100%"
              height="600px"
              title={attachment.filename}
            />
          )}
          {isCode && (
            <Box sx={{ width: '100%', p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                Unable to preview code files. Please download to view.
              </Typography>
            </Box>
          )}
          {!isImage && !isVideo && !isPdf && !isCode && (
            <Box sx={{ textAlign: 'center' }}>
              <InsertDriveFile sx={{ fontSize: 64, color: 'action.disabled' }} />
              <Typography variant="h6" sx={{ mt: 2 }}>
                Preview not available
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Download the file to view its contents
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {attachment.url && (
          <Button 
            variant="contained"
            component="a"
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Download
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}