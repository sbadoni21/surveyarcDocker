// services/firebaseStorage.js
import { storage } from '@/firebase/firebase';
import { 
  ref, 
  uploadBytes, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject, 
  listAll,
  getMetadata 
} from 'firebase/storage';

class FirebaseStorageService {
  constructor() {
    this.storage = storage;
    this.maxFileSize = 100 * 1024 * 1024; // 100MB
    this.allowedTypes = {
      images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
      videos: ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov'],
      documents: [
        'application/pdf', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ],
      code: [
        'text/plain', 
        'text/javascript', 
        'text/html', 
        'text/css',
        'application/json',
        'text/xml',
        'text/markdown'
      ],
      archives: [
        'application/zip',
        'application/x-rar-compressed',
        'application/x-7z-compressed',
        'application/x-tar',
        'application/gzip'
      ]
    };
  }

  /**
   * Generate a unique file path for ticket attachments
   */
  generateFilePath(orgId, ticketId, filename, userId) {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const fileExtension = filename.split('.').pop();
    const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    return `tickets/${orgId}/${ticketId}/${userId}/${timestamp}_${randomId}_${cleanFilename}`;
  }

  /**
   * Validate file before upload
   */
  validateFile(file) {
    const errors = [];

    // Check file size
    if (file.size > this.maxFileSize) {
      errors.push(`File size ${this.formatFileSize(file.size)} exceeds maximum allowed size of ${this.formatFileSize(this.maxFileSize)}`);
    }

    // Check file type
    const allAllowedTypes = [
      ...this.allowedTypes.images,
      ...this.allowedTypes.videos,
      ...this.allowedTypes.documents,
      ...this.allowedTypes.code,
      ...this.allowedTypes.archives
    ];

    if (!allAllowedTypes.includes(file.type) && !this.isTextFile(file)) {
      errors.push(`File type ${file.type} is not supported`);
    }

    // Check filename
    if (!file.name || file.name.length > 255) {
      errors.push('Invalid filename or filename too long');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if file is a text-based file (for code files)
   */
  isTextFile(file) {
    const textExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
      '.css', '.scss', '.sass', '.html', '.xml', '.json', '.md', '.txt',
      '.sql', '.sh', '.yml', '.yaml', '.env', '.gitignore'
    ];
    
    return textExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  }

  /**
   * Get file category based on MIME type
   */
  getFileCategory(file) {
    if (this.allowedTypes.images.includes(file.type)) return 'image';
    if (this.allowedTypes.videos.includes(file.type)) return 'video';
    if (this.allowedTypes.documents.includes(file.type)) return 'document';
    if (this.allowedTypes.archives.includes(file.type)) return 'archive';
    if (this.allowedTypes.code.includes(file.type) || this.isTextFile(file)) return 'code';
    return 'other';
  }

  /**
   * Upload file with progress tracking
   */
  async uploadFile(file, orgId, ticketId, userId, options = {}) {
    const validation = this.validateFile(file);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const filePath = this.generateFilePath(orgId, ticketId, file.name, userId);
    const storageRef = ref(storage, filePath);

    const metadata = {
      contentType: file.type,
      customMetadata: {
        originalName: file.name,
        uploadedBy: userId,
        ticketId: ticketId,
        orgId: orgId,
        category: this.getFileCategory(file),
        uploadTimestamp: new Date().toISOString()
      }
    };

    if (options.onProgress) {
      // Use resumable upload for progress tracking
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);
      
      return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            options.onProgress(progress, snapshot);
          },
          (error) => {
            reject(this.handleStorageError(error));
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              const metadata = await getMetadata(uploadTask.snapshot.ref);
              
              resolve({
                storageKey: filePath,
                downloadURL,
                metadata: {
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  category: this.getFileCategory(file),
                  uploadedAt: new Date().toISOString()
                },
                firebaseMetadata: metadata
              });
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    } else {
      // Simple upload without progress
      const snapshot = await uploadBytes(storageRef, file, metadata);
      const downloadURL = await getDownloadURL(snapshot.ref);
      const fileMetadata = await getMetadata(snapshot.ref);
      
      return {
        storageKey: filePath,
        downloadURL,
        metadata: {
          name: file.name,
          size: file.size,
          type: file.type,
          category: this.getFileCategory(file),
          uploadedAt: new Date().toISOString()
        },
        firebaseMetadata: fileMetadata
      };
    }
  }

  /**
   * Upload multiple files
   */
  async uploadMultipleFiles(files, orgId, ticketId, userId, options = {}) {
    const results = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const fileOptions = {
          ...options,
          onProgress: options.onProgress ? 
            (progress, snapshot) => options.onProgress(i, progress, snapshot) : 
            undefined
        };
        
        const result = await this.uploadFile(files[i], orgId, ticketId, userId, fileOptions);
        results.push(result);
      } catch (error) {
        errors.push({
          file: files[i].name,
          error: error.message
        });
      }
    }

    return {
      results,
      errors,
      successCount: results.length,
      totalCount: files.length
    };
  }

  /**
   * Delete file from storage
   */
  async deleteFile(storageKey) {
    try {
      const fileRef = ref(this.storage, storageKey);
      await deleteObject(fileRef);
      return { success: true };
    } catch (error) {
      throw this.handleStorageError(error);
    }
  }

  /**
   * Get download URL for a file
   */
  async getDownloadURL(storageKey) {
    try {
      const fileRef = ref(this.storage, storageKey);
      return await getDownloadURL(fileRef);
    } catch (error) {
      throw this.handleStorageError(error);
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(storageKey) {
    try {
      const fileRef = ref(this.storage, storageKey);
      return await getMetadata(fileRef);
    } catch (error) {
      throw this.handleStorageError(error);
    }
  }

  /**
   * List all files in a ticket folder
   */
  async listTicketFiles(orgId, ticketId) {
    try {
      const folderRef = ref(this.storage, `tickets/${orgId}/${ticketId}/`);
      const listResult = await listAll(folderRef);
      
      const files = await Promise.all(
        listResult.items.map(async (itemRef) => {
          const metadata = await getMetadata(itemRef);
          const downloadURL = await getDownloadURL(itemRef);
          
          return {
            storageKey: itemRef.fullPath,
            name: metadata.customMetadata?.originalName || itemRef.name,
            downloadURL,
            size: metadata.size,
            contentType: metadata.contentType,
            uploadedAt: metadata.customMetadata?.uploadTimestamp,
            uploadedBy: metadata.customMetadata?.uploadedBy,
            category: metadata.customMetadata?.category
          };
        })
      );

      return files;
    } catch (error) {
      throw this.handleStorageError(error);
    }
  }

  /**
   * Calculate MD5 checksum for file integrity
   */
  async calculateChecksum(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async function(e) {
        try {
          const crypto = require('crypto');
          const hash = crypto.createHash('md5');
          hash.update(new Uint8Array(e.target.result));
          resolve(hash.digest('hex'));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Handle Firebase Storage errors
   */
  handleStorageError(error) {
    const errorMessages = {
      'storage/unauthorized': 'User does not have permission to access the object',
      'storage/canceled': 'Upload was canceled',
      'storage/unknown': 'Unknown error occurred, inspect error.serverResponse',
      'storage/object-not-found': 'File does not exist',
      'storage/bucket-not-found': 'Storage bucket does not exist',
      'storage/project-not-found': 'Project does not exist',
      'storage/quota-exceeded': 'Storage quota exceeded',
      'storage/unauthenticated': 'User is not authenticated',
      'storage/invalid-format': 'Invalid file format',
      'storage/cannot-slice-blob': 'File could not be processed',
      'storage/server-file-wrong-size': 'File size mismatch'
    };

    const message = errorMessages[error.code] || error.message || 'An error occurred during file operation';
    
    return new Error(message);
  }

  /**
   * Generate thumbnail for images (client-side)
   */
  async generateThumbnail(file, maxWidth = 200, maxHeight = 200, quality = 0.8) {
    if (!this.allowedTypes.images.includes(file.type)) {
      throw new Error('Thumbnail generation only supported for images');
    }

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw resized image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(resolve, 'image/jpeg', quality);
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
}

// Export singleton instance
const firebaseStorageService = new FirebaseStorageService();
export default firebaseStorageService;