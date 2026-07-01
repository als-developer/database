#!/usr/bin/env node

/**
 * ============================================================
 * A.L.S — Advanced Local Storage
 * Server: server.js
 * Description: Main HTTP server with all API routes
 * ============================================================
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');

// ============================================================
// IMPORTS — Custom Modules
// ============================================================
const FileDB = require('./file.js');
const API = require('./API.js');

// ============================================================
// CONFIGURATION
// ============================================================
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const UPLOAD_DIR = path.join(__dirname, 'database', 'uploads');
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================
// EXPRESS SETUP
// ============================================================
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// ============================================================
// MULTER CONFIGURATION (File Upload)
// ============================================================
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        // Create uploads directory if it doesn't exist
        if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        }
        cb(null, UPLOAD_DIR);
    },
    filename: function(req, file, cb) {
        // Generate unique filename: timestamp_random.extension
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        const timestamp = Date.now();
        const random = crypto.randomBytes(4).toString('hex');
        cb(null, `${name}_${timestamp}_${random}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE
    },
    fileFilter: function(req, file, cb) {
        // Basic MIME type validation
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'text/plain', 'text/csv',
            'application/json',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'video/mp4', 'video/webm',
            'audio/mpeg', 'audio/wav'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('File type not allowed'), false);
        }
    }
});

// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================

/**
 * Verify session token from request headers
 * Checks against sessions.json database
 */
async function verifySession(req, res, next) {
    const token = req.headers['authorization'] || req.headers['x-session-token'] || req.query.token;

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized: No session token provided'
        });
    }

    try {
        const session = await FileDB.getSession(token);
        if (!session) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Invalid or expired session'
            });
        }

        // Check if session expired
        if (session.expires_at && new Date(session.expires_at) < new Date()) {
            await FileDB.deleteSession(token);
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Session expired'
            });
        }

        // Attach user info to request
        req.user = {
            id: session.user_id,
            email: session.email,
            role: session.role || 'user'
        };

        next();
    } catch (error) {
        console.error('Session verification error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}

/**
 * Admin-only middleware
 * Checks if user has admin role
 */
async function verifyAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Forbidden: Admin access required'
        });
    }
    next();
}

/**
 * Optional session verification (for pages that can work without login)
 */
async function optionalSession(req, res, next) {
    const token = req.headers['authorization'] || req.headers['x-session-token'] || req.query.token;

    if (token) {
        try {
            const session = await FileDB.getSession(token);
            if (session && session.expires_at && new Date(session.expires_at) > new Date()) {
                req.user = {
                    id: session.user_id,
                    email: session.email,
                    role: session.role || 'user'
                };
            }
        } catch (error) {
            // Silently fail for optional auth
        }
    }

    next();
}

// ============================================================
// PUBLIC ROUTES (No Auth Required)
// ============================================================

/**
 * GET / — Serve landing page
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

/**
 * GET /auth.html — Serve login page
 */
app.get('/auth.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

/**
 * POST /api/request-otp — Request OTP for email login
 */
app.post('/api/request-otp', async (req, res) => {
    const { email } = req.body;

    if (!email || !email.includes('@') || !email.includes('.')) {
        return res.status(400).json({
            success: false,
            error: 'Invalid email address'
        });
    }

    try {
        // Generate OTP
        const otp = API.generateOTP();

        // Store OTP in database with expiry
        await FileDB.storeOTP(email, otp);

        // Send email
        await API.sendOTPEmail(email, otp);

        // Log activity
        await FileDB.logActivity({
            user_id: null,
            user_email: email,
            action: 'request_otp',
            details: { email }
        });

        return res.json({
            success: true,
            message: 'OTP sent to your email',
            // In development, return OTP for testing
            ...(process.env.NODE_ENV === 'development' && { otp })
        });

    } catch (error) {
        console.error('OTP request error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to send OTP. Please try again.'
        });
    }
});

/**
 * POST /api/verify-otp — Verify OTP and create session
 */
app.post('/api/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({
            success: false,
            error: 'Email and OTP required'
        });
    }

    try {
        // Verify OTP
        const isValid = await FileDB.verifyOTP(email, otp);

        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired OTP'
            });
        }

        // Get or create user
        let user = await FileDB.getUserByEmail(email);
        if (!user) {
            // Create new user
            user = await FileDB.createUser({
                email: email,
                username: email.split('@')[0],
                role: 'user',
                storage_quota: 10 * 1024 * 1024 * 1024 // 10 GB default
            });

            // First user becomes admin
            const allUsers = await FileDB.getAllUsers();
            if (allUsers.length === 1) {
                user = await FileDB.updateUserRole(user.id, 'admin');
            }
        }

        // Generate session token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + SESSION_TIMEOUT);

        // Store session
        await FileDB.createSession({
            token: token,
            user_id: user.id,
            email: user.email,
            role: user.role || 'user',
            expires_at: expiresAt.toISOString()
        });

        // Update last login
        await FileDB.updateUserLastLogin(user.id);

        // Log activity
        await FileDB.logActivity({
            user_id: user.id,
            user_email: user.email,
            action: 'login',
            details: { method: 'otp' }
        });

        return res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role
            },
            expires_at: expiresAt.toISOString()
        });

    } catch (error) {
        console.error('OTP verification error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to verify OTP'
        });
    }
});

/**
 * POST /api/api-key-login — Login with API key
 */
app.post('/api/api-key-login', async (req, res) => {
    const { api_key } = req.body;

    if (!api_key) {
        return res.status(400).json({
            success: false,
            error: 'API key required'
        });
    }

    try {
        const user = await FileDB.getUserByApiKey(api_key);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid API key'
            });
        }

        // Generate session token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + SESSION_TIMEOUT);

        await FileDB.createSession({
            token: token,
            user_id: user.id,
            email: user.email,
            role: user.role || 'user',
            expires_at: expiresAt.toISOString()
        });

        await FileDB.updateUserLastLogin(user.id);

        await FileDB.logActivity({
            user_id: user.id,
            user_email: user.email,
            action: 'login',
            details: { method: 'api_key' }
        });

        return res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role
            }
        });

    } catch (error) {
        console.error('API key login error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to authenticate'
        });
    }
});

// ============================================================
// PROTECTED ROUTES (Auth Required)
// ============================================================

/**
 * GET /api/me — Get current user info
 */
app.get('/api/me', verifySession, async (req, res) => {
    try {
        const user = await FileDB.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Get storage stats
        const stats = await FileDB.getUserStorageStats(user.id);

        return res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                created_at: user.created_at,
                last_login: user.last_login,
                storage_quota: user.storage_quota,
                storage_used: stats.total_size || 0,
                file_count: stats.file_count || 0,
                megaverse_count: stats.megaverse_count || 0
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get user info'
        });
    }
});

/**
 * POST /api/logout — Logout (delete session)
 */
app.post('/api/logout', verifySession, async (req, res) => {
    const token = req.headers['authorization'] || req.headers['x-session-token'];

    try {
        await FileDB.deleteSession(token);

        await FileDB.logActivity({
            user_id: req.user.id,
            user_email: req.user.email,
            action: 'logout',
            details: {}
        });

        return res.json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to logout'
        });
    }
});

// ============================================================
// MEGAVERSE ROUTES
// ============================================================

/**
 * GET /api/megaverses — List user's megaverses
 */
app.get('/api/megaverses', verifySession, async (req, res) => {
    try {
        const megaverses = await FileDB.getUserMegaverses(req.user.id);

        return res.json({
            success: true,
            megaverses: megaverses
        });

    } catch (error) {
        console.error('List megaverses error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to list megaverses'
        });
    }
});

/**
 * POST /api/megaverses — Create new megaverse
 */
app.post('/api/megaverses', verifySession, async (req, res) => {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({
            success: false,
            error: 'Megaverse name required'
        });
    }

    try {
        const megaverse = await FileDB.createMegaverse({
            user_id: req.user.id,
            name: name.trim(),
            description: description || ''
        });

        await FileDB.logActivity({
            user_id: req.user.id,
            user_email: req.user.email,
            action: 'create_megaverse',
            details: { name: name.trim() }
        });

        return res.json({
            success: true,
            megaverse: megaverse
        });

    } catch (error) {
        console.error('Create megaverse error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create megaverse'
        });
    }
});

/**
 * DELETE /api/megaverses/:id — Delete megaverse
 */
app.delete('/api/megaverses/:id', verifySession, async (req, res) => {
    const { id } = req.params;

    try {
        const megaverse = await FileDB.getMegaverse(id);
        if (!megaverse) {
            return res.status(404).json({
                success: false,
                error: 'Megaverse not found'
            });
        }

        // Check ownership
        if (megaverse.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'You do not own this megaverse'
            });
        }

        await FileDB.deleteMegaverse(id);

        await FileDB.logActivity({
            user_id: req.user.id,
            user_email: req.user.email,
            action: 'delete_megaverse',
            details: { name: megaverse.name }
        });

        return res.json({
            success: true,
            message: 'Megaverse deleted'
        });

    } catch (error) {
        console.error('Delete megaverse error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete megaverse'
        });
    }
});

// ============================================================
// FILE ROUTES
// ============================================================

/**
 * POST /api/upload — Upload file
 */
app.post('/api/upload', verifySession, upload.single('file'), async (req, res) => {
    const { megaverse_id, metadata } = req.body;

    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: 'No file uploaded'
        });
    }

    if (!megaverse_id) {
        // Clean up uploaded file
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({
            success: false,
            error: 'Megaverse ID required'
        });
    }

    try {
        // Verify megaverse exists and user owns it
        const megaverse = await FileDB.getMegaverse(megaverse_id);
        if (!megaverse) {
            fs.unlink(req.file.path, () => {});
            return res.status(404).json({
                success: false,
                error: 'Megaverse not found'
            });
        }

        if (megaverse.user_id !== req.user.id && req.user.role !== 'admin') {
            fs.unlink(req.file.path, () => {});
            return res.status(403).json({
                success: false,
                error: 'You do not have access to this megaverse'
            });
        }

        // Check quota
        const stats = await FileDB.getUserStorageStats(req.user.id);
        const user = await FileDB.getUserById(req.user.id);
        if (stats.total_size + req.file.size > user.storage_quota) {
            fs.unlink(req.file.path, () => {});
            return res.status(403).json({
                success: false,
                error: 'Storage quota exceeded'
            });
        }

        // Parse metadata
        let meta = {};
        try {
            if (metadata) {
                meta = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
            }
        } catch (e) {
            meta = { description: metadata };
        }

        // Save file record
        const fileRecord = await FileDB.saveFile({
            user_id: req.user.id,
            megaverse_id: megaverse_id,
            filename: req.file.originalname,
            storage_path: req.file.path,
            file_size: req.file.size,
            file_hash: req.file.hash || crypto.createHash('sha256').update(req.file.path).digest('hex'),
            mime_type: req.file.mimetype,
            metadata: meta
        });

        // Log activity
        await FileDB.logActivity({
            user_id: req.user.id,
            user_email: req.user.email,
            action: 'upload',
            details: {
                megaverse: megaverse.name,
                filename: req.file.originalname,
                size: req.file.size
            }
        });

        return res.json({
            success: true,
            file: fileRecord,
            message: 'File uploaded successfully'
        });

    } catch (error) {
        console.error('Upload error:', error);
        // Clean up uploaded file
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, () => {});
        }
        return res.status(500).json({
            success: false,
            error: 'Failed to upload file'
        });
    }
});

/**
 * POST /api/upload-link — Upload file from URL
 */
app.post('/api/upload-link', verifySession, async (req, res) => {
    const { url, megaverse_id, metadata, mode } = req.body;

    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL required'
        });
    }

    if (!megaverse_id) {
        return res.status(400).json({
            success: false,
            error: 'Megaverse ID required'
        });
    }

    try {
        // Verify megaverse exists
        const megaverse = await FileDB.getMegaverse(megaverse_id);
        if (!megaverse) {
            return res.status(404).json({
                success: false,
                error: 'Megaverse not found'
            });
        }

        if (megaverse.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'You do not have access to this megaverse'
            });
        }

        // Download file from URL
        const result = await API.downloadFromUrl(url);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error || 'Failed to download from URL'
            });
        }

        // Check quota
        const stats = await FileDB.getUserStorageStats(req.user.id);
        const user = await FileDB.getUserById(req.user.id);
        if (stats.total_size + result.size > user.storage_quota) {
            fs.unlink(result.path, () => {});
            return res.status(403).json({
                success: false,
                error: 'Storage quota exceeded'
            });
        }

        // Parse metadata
        let meta = {};
        try {
            if (metadata) {
                meta = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
            }
        } catch (e) {
            meta = { description: metadata };
        }

        // Save file record
        const fileRecord = await FileDB.saveFile({
            user_id: req.user.id,
            megaverse_id: megaverse_id,
            filename: result.filename,
            storage_path: result.path,
            file_size: result.size,
            file_hash: result.hash,
            mime_type: result.mime_type,
            metadata: {
                ...meta,
                source_url: url,
                imported_at: new Date().toISOString()
            }
        });

        await FileDB.logActivity({
            user_id: req.user.id,
            user_email: req.user.email,
            action: 'upload_link',
            details: {
                megaverse: megaverse.name,
                filename: result.filename,
                size: result.size,
                source: url
            }
        });

        return res.json({
            success: true,
            file: fileRecord,
            message: 'File imported from URL successfully'
        });

    } catch (error) {
        console.error('Upload link error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to import from URL'
        });
    }
});

/**
 * GET /api/files — List files in megaverse
 */
app.get('/api/files', verifySession, async (req, res) => {
    const { megaverse_id, search, limit, offset } = req.query;

    if (!megaverse_id) {
        return res.status(400).json({
            success: false,
            error: 'Megaverse ID required'
        });
    }

    try {
        const megaverse = await FileDB.getMegaverse(megaverse_id);
        if (!megaverse) {
            return res.status(404).json({
                success: false,
                error: 'Megaverse not found'
            });
        }

        if (megaverse.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'You do not have access to this megaverse'
            });
        }

        const files = await FileDB.getFiles(megaverse_id, {
            search: search,
            limit: parseInt(limit) || 100,
            offset: parseInt(offset) || 0
        });

        return res.json({
            success: true,
            files: files,
            total: files.length
        });

    } catch (error) {
        console.error('List files error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to list files'
        });
    }
});

/**
 * GET /api/file/:id — Get file info
 */
app.get('/api/file/:id', verifySession, async (req, res) => {
    const { id } = req.params;

    try {
        const file = await FileDB.getFile(id);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        // Check access
        if (file.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'You do not have access to this file'
            });
        }

        return res.json({
            success: true,
            file: file
        });

    } catch (error) {
        console.error('Get file error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get file'
        });
    }
});

/**
 * GET /api/file/:id/download — Download file
 */
app.get('/api/file/:id/download', verifySession, async (req, res) => {
    const { id } = req.params;

    try {
        const file = await FileDB.getFile(id);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        if (file.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'You do not have access to this file'
            });
        }

        // Check if file exists on disk
        if (!fs.existsSync(file.storage_path)) {
            return res.status(404).json({
                success: false,
                error: 'File not found on disk'
            });
        }

        await FileDB.logActivity({
            user_id: req.user.id,
            user_email: req.user.email,
            action: 'download',
            details: {
                file_id: file.id,
                filename: file.filename
            }
        });

        return res.download(file.storage_path, file.filename);

    } catch (error) {
        console.error('Download error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to download file'
        });
    }
});

/**
 * GET /api/file/:id/versions — Get version history
 */
app.get('/api/file/:id/versions', verifySession, async (req, res) => {
    const { id } = req.params;

    try {
        const file = await FileDB.getFile(id);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        if (file.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'You do not have access to this file'
            });
        }

        const versions = await FileDB.getFileVersions(id);

        return res.json({
            success: true,
            versions: versions,
            current_version: file.version
        });

    } catch (error) {
        console.error('Get versions error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get version history'
        });
    }
});

/**
 * POST /api/file/:id/restore/:version — Restore file version
 */
app.post('/api/file/:id/restore/:version', verifySession, async (req, res) => {
    const { id, version } = req.params;

    try {
        const file = await FileDB.getFile(id);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        if (file.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'You do not have access to this file'
            });
        }

        const restored = await FileDB.restoreFileVersion(id, parseInt(version));

        await FileDB.logActivity({
            user_id: req.user.id,
            user_email: req.user.email,
            action: 'restore',
            details: {
                file_id: file.id,
                filename: file.filename,
                version: version
            }
        });

        return res.json({
            success: true,
            file: restored,
            message: `Restored version ${version}`
        });

    } catch (error) {
        console.error('Restore error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to restore version'
        });
    }
});

/**
 * DELETE /api/file/:id — Delete file (soft delete)
 */
app.delete('/api/file/:id', verifySession, async (req, res) => {
    const { id } = req.params;

    try {
        const file = await FileDB.getFile(id);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        if (file.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'You do not have access to this file'
            });
        }

        await FileDB.softDeleteFile(id);

        await FileDB.logActivity({
            user_id: req.user.id,
            user_email: req.user.email,
            action: 'delete',
            details: {
                file_id: file.id,
                filename: file.filename
            }
        });

        return res.json({
            success: true,
            message: 'File deleted'
        });

    } catch (error) {
        console.error('Delete error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete file'
        });
    }
});

/**
 * POST /api/file/:id/delete-permanent — Permanent delete
 */
app.post('/api/file/:id/delete-permanent', verifySession, async (req, res) => {
    const { id } = req.params;

    try {
        const file = await FileDB.getFile(id);
        if (!file) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        if (file.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'You do not have access to this file'
            });
        }

        // Delete file from disk
        if (fs.existsSync(file.storage_path)) {
            fs.unlinkSync(file.storage_path);
        }

        // Delete from database
        await FileDB.permanentDeleteFile(id);

        await FileDB.logActivity({
            user_id: req.user.id,
            user_email: req.user.email,
            action: 'permanent_delete',
            details: {
                file_id: file.id,
                filename: file.filename
            }
        });

        return res.json({
            success: true,
            message: 'File permanently deleted'
        });

    } catch (error) {
        console.error('Permanent delete error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to permanently delete file'
        });
    }
});

// ============================================================
// SEARCH ROUTE
// ============================================================

/**
 * GET /api/search — Search files across megaverses
 */
app.get('/api/search', verifySession, async (req, res) => {
    const { q, type, limit } = req.query;

    if (!q) {
        return res.status(400).json({
            success: false,
            error: 'Search query required'
        });
    }

    try {
        const results = await FileDB.searchFiles(req.user.id, {
            query: q,
            type: type,
            limit: parseInt(limit) || 50
        });

        return res.json({
            success: true,
            results: results,
            total: results.length
        });

    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to search'
        });
    }
});

// ============================================================
// ACTIVITY ROUTES
// ============================================================

/**
 * GET /api/activity — Get user activity
 */
app.get('/api/activity', verifySession, async (req, res) => {
    const { limit, offset } = req.query;

    try {
        const activities = await FileDB.getUserActivity(req.user.id, {
            limit: parseInt(limit) || 50,
            offset: parseInt(offset) || 0
        });

        return res.json({
            success: true,
            activities: activities
        });

    } catch (error) {
        console.error('Get activity error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get activity'
        });
    }
});

// ============================================================
// ADMIN ROUTES
// ============================================================

/**
 * GET /api/admin/users — List all users (admin only)
 */
app.get('/api/admin/users', verifySession, verifyAdmin, async (req, res) => {
    try {
        const users = await FileDB.getAllUsersWithStats();

        return res.json({
            success: true,
            users: users
        });

    } catch (error) {
        console.error('Admin users error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get users'
        });
    }
});

/**
 * GET /api/admin/user/:id — Get user details (admin only)
 */
app.get('/api/admin/user/:id', verifySession, verifyAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const user = await FileDB.getUserById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const stats = await FileDB.getUserStorageStats(id);
        const megaverses = await FileDB.getUserMegaverses(id);
        const activities = await FileDB.getUserActivity(id, { limit: 20 });

        return res.json({
            success: true,
            user: {
                ...user,
                stats: stats,
                megaverses: megaverses,
                recent_activity: activities
            }
        });

    } catch (error) {
        console.error('Admin user detail error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get user details'
        });
    }
});

/**
 * PUT /api/admin/user/:id/quota — Update user quota (admin only)
 */
app.put('/api/admin/user/:id/quota', verifySession, verifyAdmin, async (req, res) => {
    const { id } = req.params;
    const { quota } = req.body;

    if (!quota || isNaN(quota) || quota <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Valid quota required (bytes)'
        });
    }

    try {
        const user = await FileDB.updateUserQuota(id, parseInt(quota));

        await FileDB.logActivity({
            user_id: req.user.id,
            user_email: req.user.email,
            action: 'update_quota',
            details: {
                target_user: user.email,
                new_quota: quota
            }
        });

        return res.json({
            success: true,
            user: user,
            message: 'Quota updated'
        });

    } catch (error) {
        console.error('Update quota error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update quota'
        });
    }
});

/**
 * PUT /api/admin/user/:id/role — Update user role (admin only)
 */
app.put('/api/admin/user/:id/role', verifySession, verifyAdmin, async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['admin', 'user'].includes(role)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid role. Must be "admin" or "user"'
        });
    }

    try {
        const user = await FileDB.updateUserRole(id, role);

        await FileDB.logActivity({
            user_id: req.user.id,
            user_email: req.user.email,
            action: 'update_role',
            details: {
                target_user: user.email,
               
