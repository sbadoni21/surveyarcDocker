// models/postGresModels/attachmentModel.js
const BASE = "/api/post-gres-apis/tickets";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const toCamel = (a) => ({
  attachmentId: a.attachment_id,
  ticketId: a.ticket_id,
  commentId: a.comment_id ?? null,
  filename: a.filename,
  contentType: a.content_type ?? null,
  sizeBytes: a.size_bytes ?? 0,
  storageKey: a.storage_key,
  url: a.url ?? null,
  checksum: a.checksum ?? null,
  uploadedBy: a.uploaded_by,
  createdAt: a.created_at,
});

const toSnake = (data) => ({
  ticket_id: data.ticketId,
  comment_id: data.commentId ?? null,
  filename: data.filename,
  content_type: data.contentType ?? null,
  size_bytes: data.sizeBytes ?? 0,
  storage_key: data.storageKey,
  url: data.url ?? null,
  checksum: data.checksum ?? null,
  uploaded_by: data.uploadedBy,
});

const AttachmentModel = {
  /**
   * List all attachments for a ticket
   */
  async list(ticketId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/attachments`, {
      cache: "no-store"
    });
    const arr = await json(res);
    return (arr || []).map(toCamel);
  },

  /**
   * Create a new attachment
   */
  async create(ticketId, data) {
    const payload = toSnake(data);
    
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    
    const attachment = await json(res);
    return toCamel(attachment);
  },

  /**
   * Delete an attachment
   */
  async remove(ticketId, attachmentId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(attachmentId)}`,
      {
        method: "DELETE",
        cache: "no-store",
      }
    );
    
    if (res.status === 204) return true;
    await json(res);
    return true;
  },

  /**
   * Get attachment metadata without downloading
   */
  async getMetadata(ticketId, attachmentId) {
    const attachments = await this.list(ticketId);
    return attachments.find(a => a.attachmentId === attachmentId) || null;
  },

  /**
   * Bulk create attachments (useful for multiple file uploads)
   */
  async createMultiple(ticketId, attachments) {
    const results = [];
    const errors = [];

    for (const attachmentData of attachments) {
      try {
        const result = await this.create(ticketId, attachmentData);
        results.push(result);
      } catch (error) {
        errors.push({
          filename: attachmentData.filename,
          error: error.message
        });
      }
    }

    return {
      results,
      errors,
      successCount: results.length,
      totalCount: attachments.length
    };
  },

  /**
   * Get attachments by type/category
   */
  async listByCategory(ticketId, category) {
    const attachments = await this.list(ticketId);
    
    const categoryMap = {
      images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
      videos: ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov'],
      documents: [
        'application/pdf', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ],
      code: ['text/plain', 'text/javascript', 'text/html', 'text/css', 'application/json']
    };

    if (!categoryMap[category]) {
      return attachments;
    }

    return attachments.filter(attachment => 
      categoryMap[category].includes(attachment.contentType) ||
      this.isCodeFile(attachment.filename)
    );
  },

  /**
   * Helper to determine if file is a code file based on extension
   */
  isCodeFile(filename) {
    const codeExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
      '.css', '.scss', '.sass', '.html', '.xml', '.json', '.md', '.txt',
      '.sql', '.sh', '.yml', '.yaml', '.env'
    ];
    
    return codeExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  },

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * Get file icon based on content type or extension
   */
  getFileIcon(attachment) {
    const { contentType, filename } = attachment;
    
    if (contentType?.startsWith('image/')) return '🖼️';
    if (contentType?.startsWith('video/')) return '🎥';
    if (contentType?.startsWith('audio/')) return '🎵';
    if (contentType === 'application/pdf') return '📄';
    if (contentType?.includes('spreadsheet') || contentType?.includes('excel')) return '📊';
    if (contentType?.includes('presentation') || contentType?.includes('powerpoint')) return '📽️';
    if (contentType?.includes('word') || contentType?.includes('document')) return '📝';
    if (contentType?.includes('zip') || contentType?.includes('compressed')) return '🗜️';
    if (this.isCodeFile(filename)) return '💻';
    
    return '📎';
  }
};

export default AttachmentModel;