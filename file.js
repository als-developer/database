#!/usr/bin/env node

/**
 * ============================================================
 * A.L.S — Advanced Local Storage
 * File: file.js
 * Description: Pure JSON database operations
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================
// CONSTANTS & PATHS
// ============================================================

const DB_PATH = path.join(__dirname, 'database');
const SYSTEM_PATH = path.join(DB_PATH, 'system');
const USERS_PATH = path.join(DB_PATH, 'users');
const MEGAVERSES_PATH = path.join(DB_PATH, 'megaverses');
const SYSTEMDATA_PATH = path.join(__dirname, 'systemdata');
const LOGS_PATH = path.join(__dirname, 'logs');

// File paths
const CONFIG_FILE = path.join(SYSTEM_PATH, 'config.json');
const SESSIONS_FILE = path.join(SYSTEM_PATH, 'sessions.json');
const USERS_FILE = path.join(USERS_PATH, 'users.json');
const MEGAVERSES_INDEX = path.join(MEGAVERSES_PATH, '_index.json');
const ACTIVITY_LOG = path.join(SYSTEMDATA_PATH, 'activity.log.json');
const OTP_STORE = path.join(SYSTEMDATA_PATH, 'otp.store.json');

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Read JSON file with error handling
 */
function readJSON(filePath, defaultValue = null) {
    try {
        if (!fs.existsSync(filePath)) {
            return defaultValue;
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
        return defaultValue;
    }
}

/**
 * Write JSON file with atomic operation
 */
function writeJSON(filePath, data, pretty = true) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
        const tempPath = filePath + '.tmp';
        
        fs.writeFileSync(tempPath, content, 'utf8');
        fs.renameSync(tempPath, filePath);
        return true;
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error.message);
        return false;
    }
}

/**
 * Generate unique ID
 */
function generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `${prefix}${timestamp}_${random}`;
}

/**
 * Get current timestamp in ISO format
 */
function getTimestamp() {
    return new Date().toISOString();
}

/**
 * Format timestamp for filenames (YYYY-MM-DD-HH-MM-SS-ms)
 */
function getFileTimestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}-${String(now.getMilliseconds()).padStart(3, '0')}`;
}

/**
 * Calculate file hash (SHA-256)
 */
function calculateFileHash(filePath) {
    try {
        const data = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(data).digest('hex');
    } catch (error) {
        return null;
    }
}

/**
 * Get file size in bytes
 */
function getFileSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch (error) {
        return 0;
    }
}

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Ensure all system files exist
 */
function ensureSystemFiles() {
    // Create directories
    [DB_PATH, SYSTEM_PATH, USERS_PATH, MEGAVERSES_PATH, SYSTEMDATA_PATH, LOGS_PATH].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    // Config
    if (!fs.existsSync(CONFIG_FILE)) {
        writeJSON(CONFIG_FILE, {
            system_name: 'A.L.S',
            version: '1.0.0',
            created_at: getTimestamp(),
            admin_email: null,
            max_file_size: 100 * 1024 * 1024,
            allowed_mime_types: [
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
            ],
            default_quota: 10 * 1024 * 1024 * 1024,
            backup_retention: 100,
            session_timeout_hours: 24,
            otp_expiry_minutes: 5
        });
    }

    // Sessions
    if (!fs.existsSync(SESSIONS_FILE)) {
        writeJSON(SESSIONS_FILE, { sessions: [] });
    }

    // Users
    if (!fs.existsSync(USERS_FILE)) {
        writeJSON(USERS_FILE, { users: [] });
    }

    // Megaverses index
    if (!fs.existsSync(MEGAVERSES_INDEX)) {
        writeJSON(MEGAVERSES_INDEX, { megaverses: [] });
    }

    // Activity log
    if (!fs.existsSync(ACTIVITY_LOG)) {
        writeJSON(ACTIVITY_LOG, { activities: [] });
    }

    // OTP store
    if (!fs.existsSync(OTP_STORE)) {
        writeJSON(OTP_STORE, { otps: [] });
    }

    return true;
}

// ============================================================
// CONFIG OPERATIONS
// ============================================================

/**
 * Get system configuration
 */
function getSystemConfig() {
    return readJSON(CONFIG_FILE, {});
}

/**
 * Update system configuration
 */
function updateSystemConfig(updates) {
    const config = getSystemConfig();
    const updated = { ...config, ...updates, updated_at: getTimestamp() };
    writeJSON(CONFIG_FILE, updated);
    return updated;
}

// ============================================================
// SESSION OPERATIONS
// ============================================================

/**
 * Create a new session
 */
function createSession(sessionData) {
    const sessions = readJSON(SESSIONS_FILE, { sessions: [] });
    
    // Remove any existing sessions for this user
    sessions.sessions = sessions.sessions.filter(s => s.user_id !== sessionData.user_id);
    
    // Add new session
    sessions.sessions.push({
        token: sessionData.token,
        user_id: sessionData.user_id,
        email: sessionData.email,
        role: sessionData.role || 'user',
        created_at: getTimestamp(),
        expires_at: sessionData.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
    
    writeJSON(SESSIONS_FILE, sessions);
    return sessions.sessions[sessions.sessions.length - 1];
}

/**
 * Get session by token
 */
function getSession(token) {
    const sessions = readJSON(SESSIONS_FILE, { sessions: [] });
    return sessions.sessions.find(s => s.token === token) || null;
}

/**
 * Delete session by token
 */
function deleteSession(token) {
    const sessions = readJSON(SESSIONS_FILE, { sessions: [] });
    sessions.sessions = sessions.sessions.filter(s => s.token !== token);
    writeJSON(SESSIONS_FILE, sessions);
    return true;
}

/**
 * Delete all expired sessions
 */
function cleanExpiredSessions() {
    const sessions = readJSON(SESSIONS_FILE, { sessions: [] });
    const now = new Date();
    sessions.sessions = sessions.sessions.filter(s => new Date(s.expires_at) > now);
    writeJSON(SESSIONS_FILE, sessions);
    return sessions.sessions.length;
}

// ============================================================
// USER OPERATIONS
// ============================================================

/**
 * Get all users
 */
function getAllUsers() {
    const data = readJSON(USERS_FILE, { users: [] });
    return data.users || [];
}

/**
 * Get user by ID
 */
function getUserById(userId) {
    const users = getAllUsers();
    return users.find(u => u.id === userId) || null;
}

/**
 * Get user by email
 */
function getUserByEmail(email) {
    const users = getAllUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

/**
 * Get user by API key
 */
function getUserByApiKey(apiKey) {
    const users = getAllUsers();
    return users.find(u => u.api_key === apiKey) || null;
}

/**
 * Create a new user
 */
function createUser(userData) {
    const users = getAllUsers();
    
    // Check if user already exists
    if (users.find(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
        throw new Error('User already exists');
    }
    
    const newUser = {
        id: generateId('u_'),
        email: userData.email.toLowerCase(),
        username: userData.username || userData.email.split('@')[0],
        role: userData.role || 'user',
        api_key: 'als_' + crypto.randomBytes(24).toString('hex'),
        created_at: getTimestamp(),
        last_login: null,
        storage_quota: userData.storage_quota || (10 * 1024 * 1024 * 1024),
        storage_used: 0,
        settings: userData.settings || {
            theme: 'dark',
            notifications: true
        }
    };
    
    users.push(newUser);
    writeJSON(USERS_FILE, { users });
    
    // Create user's megaverse directory
    const userMegaversePath = path.join(MEGAVERSES_PATH, newUser.id);
    if (!fs.existsSync(userMegaversePath)) {
        fs.mkdirSync(userMegaversePath, { recursive: true });
    }
    
    // Create user's megaverse index
    const userIndexPath = path.join(userMegaversePath, '_index.json');
    if (!fs.existsSync(userIndexPath)) {
        writeJSON(userIndexPath, { megaverses: [] });
    }
    
    return newUser;
}

/**
 * Update user
 */
function updateUser(userId, updates) {
    const users = getAllUsers();
    const index = users.findIndex(u => u.id === userId);
    
    if (index === -1) {
        throw new Error('User not found');
    }
    
    // Prevent updating certain fields
    delete updates.id;
    delete updates.created_at;
    delete updates.email;
    
    users[index] = { ...users[index], ...updates, updated_at: getTimestamp() };
    writeJSON(USERS_FILE, { users });
    return users[index];
}

/**
 * Update user role
 */
function updateUserRole(userId, role) {
    return updateUser(userId, { role });
}

/**
 * Update user quota
 */
function updateUserQuota(userId, quota) {
    return updateUser(userId, { storage_quota: quota });
}

/**
 * Update user storage usage
 */
function updateUserStorage(userId, delta) {
    const user = getUserById(userId);
    if (!user) {
        throw new Error('User not found');
    }
    
    const newStorage = Math.max(0, (user.storage_used || 0) + delta);
    return updateUser(userId, { storage_used: newStorage });
}

/**
 * Update user last login
 */
function updateUserLastLogin(userId) {
    return updateUser(userId, { last_login: getTimestamp() });
}

/**
 * Delete user (and all their data)
 */
function deleteUser(userId) {
    const users = getAllUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
        throw new Error('User not found');
    }
    
    // Delete user's megaverse directory
    const userMegaversePath = path.join(MEGAVERSES_PATH, userId);
    if (fs.existsSync(userMegaversePath)) {
        fs.rmSync(userMegaversePath, { recursive: true, force: true });
    }
    
    // Delete user from users list
    const updatedUsers = users.filter(u => u.id !== userId);
    writeJSON(USERS_FILE, { users: updatedUsers });
    
    // Delete user sessions
    const sessions = readJSON(SESSIONS_FILE, { sessions: [] });
    sessions.sessions = sessions.sessions.filter(s => s.user_id !== userId);
    writeJSON(SESSIONS_FILE, sessions);
    
    return true;
}

/**
 * Get all admin users
 */
function getAdminUsers() {
    const users = getAllUsers();
    return users.filter(u => u.role === 'admin');
}

/**
 * Get user storage stats
 */
function getUserStorageStats(userId) {
    const megaverses = getUserMegaverses(userId);
    let totalSize = 0;
    let fileCount = 0;
    
    for (const mega of megaverses) {
        const files = getMegaverseFiles(userId, mega.id);
        for (const file of files) {
            totalSize += file.file_size || 0;
            fileCount++;
        }
    }
    
    return {
        total_size: totalSize,
        file_count: fileCount,
        megaverse_count: megaverses.length
    };
}

/**
 * Get all users with stats (for admin)
 */
function getAllUsersWithStats() {
    const users = getAllUsers();
    
    return users.map(user => {
        const stats = getUserStorageStats(user.id);
        return {
            ...user,
            stats
        };
    });
}

// ============================================================
// OTP OPERATIONS
// ============================================================

/**
 * Store OTP for email
 */
function storeOTP(email, otp) {
    const data = readJSON(OTP_STORE, { otps: [] });
    
    // Remove existing OTPs for this email
    data.otps = data.otps.filter(o => o.email !== email);
    
    // Add new OTP
    data.otps.push({
        email: email.toLowerCase(),
        otp: otp,
        created_at: getTimestamp(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    });
    
    writeJSON(OTP_STORE, data);
    return true;
}

/**
 * Verify OTP
 */
function verifyOTP(email, otp) {
    const data = readJSON(OTP_STORE, { otps: [] });
    const record = data.otps.find(o => 
        o.email === email.toLowerCase() && 
        o.otp === otp &&
        new Date(o.expires_at) > new Date()
    );
    
    if (!record) {
        return false;
    }
    
    // Remove used OTP
    data.otps = data.otps.filter(o => o.email !== email || o.otp !== otp);
    writeJSON(OTP_STORE, data);
    
    return true;
}

/**
 * Clean expired OTPs
 */
function cleanExpiredOTPs() {
    const data = readJSON(OTP_STORE, { otps: [] });
    const now = new Date();
    data.otps = data.otps.filter(o => new Date(o.expires_at) > now);
    writeJSON(OTP_STORE, data);
    return data.otps.length;
}

// ============================================================
// MEGAVERSE OPERATIONS
// ============================================================

/**
 * Get user's megaverses
 */
function getUserMegaverses(userId) {
    const userMegaversePath = path.join(MEGAVERSES_PATH, userId);
    const indexFile = path.join(userMegaversePath, '_index.json');
    
    if (!fs.existsSync(indexFile)) {
        return [];
    }
    
    const data = readJSON(indexFile, { megaverses: [] });
    return data.megaverses || [];
}

/**
 * Get megaverse by ID
 */
function getMegaverse(megaverseId, userId = null) {
    if (userId) {
        const megaverses = getUserMegaverses(userId);
        return megaverses.find(m => m.id === megaverseId) || null;
    }
    
    // Search all users
    const users = getAllUsers();
    for (const user of users) {
        const megaverses = getUserMegaverses(user.id);
        const found = megaverses.find(m => m.id === megaverseId);
        if (found) {
            return { ...found, user_id: user.id };
        }
    }
    
    return null;
}

/**
 * Create a new megaverse
 */
function createMegaverse(data) {
    const { user_id, name, description } = data;
    
    if (!user_id || !name) {
        throw new Error('User ID and name required');
    }
    
    const userMegaversePath = path.join(MEGAVERSES_PATH, user_id);
    const indexFile = path.join(userMegaversePath, '_index.json');
    
    // Ensure directory exists
    if (!fs.existsSync(userMegaversePath)) {
        fs.mkdirSync(userMegaversePath, { recursive: true });
    }
    
    // Load existing megaverses
    const index = readJSON(indexFile, { megaverses: [] });
    
    // Check for duplicate name
    if (index.megaverses.find(m => m.name === name)) {
        throw new Error('Megaverse with this name already exists');
    }
    
    // Create new megaverse
    const megaverse = {
        id: generateId('m_'),
        name: name.trim(),
        description: description || '',
        created_at: getTimestamp(),
        updated_at: getTimestamp(),
        file_count: 0,
        total_size: 0
    };
    
    index.megaverses.push(megaverse);
    writeJSON(indexFile, index);
    
    // Create megaverse directory structure
    const megaPath = path.join(userMegaversePath, megaverse.id);
    fs.mkdirSync(path.join(megaPath, 'live', 'file'), { recursive: true });
    fs.mkdirSync(path.join(megaPath, 'live', 'json'), { recursive: true });
    fs.mkdirSync(path.join(megaPath, 'backup', 'file'), { recursive: true });
    fs.mkdirSync(path.join(megaPath, 'backup', 'json'), { recursive: true });
    
    // Create files index
    const filesIndexFile = path.join(megaPath, '_files.json');
    writeJSON(filesIndexFile, { files: [] });
    
    // Create meta file
    const metaFile = path.join(megaPath, '_meta.json');
    writeJSON(metaFile, megaverse);
    
    return megaverse;
}

/**
 * Delete megaverse
 */
function deleteMegaverse(megaverseId, userId = null) {
    if (!userId) {
        // Find which user owns this megaverse
        const users = getAllUsers();
        for (const user of users) {
            const megaverses = getUserMegaverses(user.id);
            if (megaverses.find(m => m.id === megaverseId)) {
                userId = user.id;
                break;
            }
        }
    }
    
    if (!userId) {
        throw new Error('Megaverse not found');
    }
    
    const userMegaversePath = path.join(MEGAVERSES_PATH, userId);
    const indexFile = path.join(userMegaversePath, '_index.json');
    const index = readJSON(indexFile, { megaverses: [] });
    
    const megaverseIndex = index.megaverses.findIndex(m => m.id === megaverseId);
    if (megaverseIndex === -1) {
        throw new Error('Megaverse not found');
    }
    
    // Delete megaverse directory
    const megaPath = path.join(userMegaversePath, megaverseId);
    if (fs.existsSync(megaPath)) {
        fs.rmSync(megaPath, { recursive: true, force: true });
    }
    
    // Remove from index
    index.megaverses.splice(megaverseIndex, 1);
    writeJSON(indexFile, index);
    
    return true;
}

/**
 * Update megaverse stats (file count, total size)
 */
function updateMegaverseStats(megaverseId, userId, fileSizeDelta, fileCountDelta = 0) {
    const userMegaversePath = path.join(MEGAVERSES_PATH, userId);
    const indexFile = path.join(userMegaversePath, '_index.json');
    const index = readJSON(indexFile, { megaverses: [] });
    
    const mega = index.megaverses.find(m => m.id === megaverseId);
    if (!mega) {
        return false;
    }
    
    mega.file_count = Math.max(0, (mega.file_count || 0) + fileCountDelta);
    mega.total_size = Math.max(0, (mega.total_size || 0) + fileSizeDelta);
    mega.updated_at = getTimestamp();
    
    writeJSON(indexFile, index);
    return true;
}

// ============================================================
// FILE OPERATIONS
// ============================================================

/**
 * Get files in a megaverse
 */
function getMegaverseFiles(userId, megaverseId, options = {}) {
    const { search, limit, offset } = options;
    
    const userMegaversePath = path.join(MEGAVERSES_PATH, userId);
    const megaPath = path.join(userMegaversePath, megaverseId);
    const filesIndexFile = path.join(megaPath, '_files.json');
    
    if (!fs.existsSync(filesIndexFile)) {
        return [];
    }
    
    const data = readJSON(filesIndexFile, { files: [] });
    let files = data.files || [];
    
    // Filter by search
    if (search) {
        const query = search.toLowerCase();
        files = files.filter(f => 
            f.filename.toLowerCase().includes(query) ||
            (f.metadata && JSON.stringify(f.metadata).toLowerCase().includes(query))
        );
    }
    
    // Sort by uploaded_at (newest first)
    files.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
    
    // Pagination
    const start = offset || 0;
    const end = limit ? start + limit : undefined;
    
    return files.slice(start, end);
}

/**
 * Get file by ID
 */
function getFile(fileId) {
    const users = getAllUsers();
    
    for (const user of users) {
        const megaverses = getUserMegaverses(user.id);
        for (const mega of megaverses) {
            const files = getMegaverseFiles(user.id, mega.id);
            const file = files.find(f => f.id === fileId);
            if (file) {
                return {
                    ...file,
                    user_id: user.id,
                    megaverse_id: mega.id,
                    megaverse_name: mega.name
                };
            }
        }
    }
    
    return null;
}

/**
 * Save a new file
 */
function saveFile(fileData) {
    const { user_id, megaverse_id, filename, storage_path, file_size, file_hash, mime_type, metadata } = fileData;
    
    if (!user_id || !megaverse_id || !filename || !storage_path) {
        throw new Error('Missing required fields');
    }
    
    const userMegaversePath = path.join(MEGAVERSES_PATH, user_id);
    const megaPath = path.join(userMegaversePath, megaverse_id);
    const filesIndexFile = path.join(megaPath, '_files.json');
    
    // Load existing files
    const data = readJSON(filesIndexFile, { files: [] });
    
    // Check if file with same name exists
    const existingIndex = data.files.findIndex(f => f.filename === filename);
    
    let file;
    let isUpdate = false;
    
    if (existingIndex !== -1) {
        // Update existing file
        isUpdate = true;
        const existing = data.files[existingIndex];
        
        // Backup current file
        const backupFile = backupExistingFile(user_id, megaverse_id, existing);
        
        // Update file record
        file = {
            ...existing,
            storage_path: storage_path,
            file_size: file_size,
            file_hash: file_hash,
            mime_type: mime_type,
            version: (existing.version || 0) + 1,
            updated_at: getTimestamp(),
            metadata: metadata || existing.metadata || {}
        };
        
        // Add to backup history
        if (backupFile) {
            if (!file.backups) file.backups = [];
            file.backups.push({
                version: existing.version || 1,
                path: backupFile,
                created_at: getTimestamp()
            });
        }
        
        data.files[existingIndex] = file;
        
        // Update storage usage (delta)
        const delta = file_size - (existing.file_size || 0);
        updateUserStorage(user_id, delta);
        updateMegaverseStats(megaverse_id, user_id, delta);
        
    } else {
        // New file
        file = {
            id: generateId('f_'),
            filename: filename,
            storage_path: storage_path,
            file_size: file_size,
            file_hash: file_hash,
            mime_type: mime_type,
            version: 1,
            uploaded_at: getTimestamp(),
            updated_at: getTimestamp(),
            metadata: metadata || {},
            backups: []
        };
        
        data.files.push(file);
        
        // Update storage usage
        updateUserStorage(user_id, file_size);
        updateMegaverseStats(megaverse_id, user_id, file_size, 1);
    }
    
    writeJSON(filesIndexFile, data);
    return file;
}

/**
 * Backup existing file before update
 */
function backupExistingFile(userId, megaverseId, file) {
    const userMegaversePath = path.join(MEGAVERSES_PATH, userId);
    const megaPath = path.join(userMegaversePath, megaverseId);
    const backupDir = path.join(megaPath, 'backup', 'file');
    const timestamp = getFileTimestamp();
    
    // Create backup directory
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Backup original file
    const originalPath = file.storage_path;
    if (fs.existsSync(originalPath)) {
        const ext = path.extname(file.filename);
        const name = path.basename(file.filename, ext);
        const backupPath = path.join(backupDir, `${name}_${timestamp}${ext}`);
        fs.copyFileSync(originalPath, backupPath);
        return backupPath;
    }
    
    return null;
}

/**
 * Get file versions
 */
function getFileVersions(fileId) {
    const file = getFile(fileId);
    if (!file) {
        return [];
    }
    
    const versions = [
        {
            version: file.version,
            path: file.storage_path,
            created_at: file.updated_at || file.uploaded_at,
            is_current: true
        }
    ];
    
    if (file.backups) {
        const backupVersions = file.backups.map(b => ({
            version: b.version,
            path: b.path,
            created_at: b.created_at,
            is_current: false
        }));
        versions.push(...backupVersions);
    }
    
    return versions.sort((a, b) => b.version - a.version);
}

/**
 * Restore file version
 */
function restoreFileVersion(fileId, versionNumber) {
    const file = getFile(fileId);
    if (!file) {
        throw new Error('File not found');
    }
    
    // Find version
    let versionPath = null;
    let versionDate = null;
    
    if (file.version === versionNumber) {
        // Restore current version (do nothing)
        return file;
    }
    
    if (file.backups) {
        const backup = file.backups.find(b => b.version === versionNumber);
        if (backup) {
            versionPath = backup.path;
            versionDate = backup.created_at;
        }
    }
    
    if (!versionPath || !fs.existsSync(versionPath)) {
        throw new Error('Version not found');
    }
    
    // Backup current version
    const user_id = file.user_id;
    const megaverse_id = file.megaverse_id;
    const backupPath = backupExistingFile(user_id, megaverse_id, file);
    
    // Restore version
    const ext = path.extname(file.filename);
    const storageDir = path.dirname(file.storage_path);
    const restoredPath = path.join(storageDir, `${path.basename(file.filename, ext)}_restored_${getFileTimestamp()}${ext}`);
    
    fs.copyFileSync(versionPath, restoredPath);
    
    // Update file record
    const oldSize = file.file_size;
    const newSize = getFileSize(restoredPath);
    const newHash = calculateFileHash(restoredPath);
    
    const userMegaversePath = path.join(MEGAVERSES_PATH, user_id);
    const megaPath = path.join(userMegaversePath, megaverse_id);
    const filesIndexFile = path.join(megaPath, '_files.json');
    const data = readJSON(filesIndexFile, { files: [] });
    
    const fileIndex = data.files.findIndex(f => f.id === fileId);
    if (fileIndex === -1) {
        throw new Error('File not found in index');
    }
    
    // Update file
    const updatedFile = {
        ...data.files[fileIndex],
        storage_path: restoredPath,
        file_size: newSize,
        file_hash: newHash,
        version: (data.files[fileIndex].version || 0) + 1,
        updated_at: getTimestamp()
    };
    
    // Add backup entry for the version being restored from
    if (!updatedFile.backups) updatedFile.backups = [];
    updatedFile.backups.push({
        version: versionNumber,
        path: versionPath,
        created_at: versionDate || getTimestamp()
    });
    
    // Add backup entry for current version (if backup was created)
    if (backupPath) {
        updatedFile.backups.push({
            version: updatedFile.version - 1,
            path: backupPath,
            created_at: getTimestamp()
        });
    }
    
    data.files[fileIndex] = updatedFile;
    writeJSON(filesIndexFile, data);
    
    // Update storage usage
    const delta = newSize - oldSize;
    updateUserStorage(user_id, delta);
    updateMegaverseStats(megaverse_id, user_id, delta);
    
    return updatedFile;
}

/**
 * Soft delete file
 */
function softDeleteFile(fileId) {
    const file = getFile(fileId);
    if (!file) {
        throw new Error('File not found');
    }
    
    const user_id = file.user_id;
    const megaverse_id = file.megaverse_id;
    
    const userMegaversePath = path.join(MEGAVERSES_PATH, user_id);
    const megaPath = path.join(userMegaversePath, megaverse_id);
    const filesIndexFile = path.join(megaPath, '_files.json');
    const data = readJSON(filesIndexFile, { files: [] });
    
    const fileIndex = data.files.findIndex(f => f.id === fileId);
    if (fileIndex === -1) {
        throw new Error('File not found in index');
    }
    
    // Mark as deleted
    data.files[fileIndex].deleted = true;
    data.files[fileIndex].deleted_at = getTimestamp();
    
    writeJSON(filesIndexFile, data);
    
    // Update storage usage (subtract file size)
    updateUserStorage(user_id, -file.file_size);
    updateMegaverseStats(megaverse_id, user_id, -file.file_size, -1);
    
    return true;
}

/**
 * Permanent delete file
 */
function permanentDeleteFile(fileId) {
    const file = getFile(fileId);
    if (!file) {
        throw new Error('File not found');
    }
    
    const user_id = file.user_id;
    const megaverse_id = file.megaverse_id;
    
    // Delete file from disk
    if (fs.existsSync(file.storage_path)) {
        fs.unlinkSync(file.storage_path);
    }
    
    // Delete backups
    if (file.backups) {
        for (const backup of file.backups) {
            if (fs.existsSync(backup.path)) {
                fs.unlinkSync(backup.path);
            }
        }
    }
    
    // Remove from index
    const userMegaversePath = path.join(MEGAVERSES_PATH, user_id);
    const megaPath = path.join(userMegaversePath, megaverse_id);
    const filesIndexFile = path.join(megaPath, '_files.json');
    const data = readJSON(filesIndexFile, { files: [] });
    
    data.files = data.files.filter(f => f.id !== fileId);
    writeJSON(filesIndexFile, data);
    
    // Update storage usage if not already updated by soft delete
    // (If soft deleted first, storage already updated)
    const isSoftDeleted = file.deleted === true;
    if (!isSoftDeleted) {
        updateUserStorage(user_id, -file.file_size);
        updateMegaverseStats(megaverse_id, user_id, -file.file_size, -1);
    }
    
    return true;
}

// ============================================================
// SEARCH OPERATIONS
// ============================================================

/**
 * Search files across user's megaverses
 */
function searchFiles(userId, options) {
    const { query, type, limit } = options;
    
    if (!query) {
        return [];
    }
    
    const megaverses = getUserMegaverses(userId);
    const results = [];
    const queryLower = query.toLowerCase();
    
    for (const mega of megaverses) {
        const files = getMegaverseFiles(userId, mega.id);
        
        for (const file of files) {
            if (file.deleted) continue;
            
            // Search by filename
            const matchName = file.filename.toLowerCase().includes(queryLower);
            
            // Search by metadata
            let matchMeta = false;
            if (file.metadata) {
                const metaStr = JSON.stringify(file.metadata).toLowerCase();
                matchMeta = metaStr.includes(queryLower);
            }
            
            // Search by type
            let matchType = true;
            if (type && file.mime_type) {
                matchType = file.mime_type.includes(type);
            }
            
            if ((matchName || matchMeta) && matchType) {
                results.push({
                    ...file,
                    megaverse: mega.name,
                    megaverse_id: mega.id,
                    match_type: matchName ? 'filename' : 'metadata'
                });
            }
        }
    }
    
    // Sort by relevance (filename matches first)
    results.sort((a, b) => {
        if (a.match_type === 'filename' && b.match_type !== 'filename') return -1;
        if (b.match_type === 'filename' && a.match_type !== 'filename') return 1;
        return 0;
    });
    
    return results.slice(0, limit || 50);
}

// ============================================================
// ACTIVITY OPERATIONS
// ============================================================

/**
 * Log activity
 */
function logActivity(activityData) {
    const data = readJSON(ACTIVITY_LOG, { activities: [] });
    
    // Keep only last 10,000 entries to prevent file bloat
    if (data.activities.length > 10000) {
        data.activities = data.activities.slice(-9000);
    }
    
    data.activities.push({
        id: generateId('a_'),
        timestamp: getTimestamp(),
        user_id: activityData.user_id || null,
        user_email: activityData.user_email || 'system',
        action: activityData.action || 'unknown',
        details: activityData.details || {}
    });
    
    writeJSON(ACTIVITY_LOG, data);
    return true;
}

/**
 * Get user activity
 */
function getUserActivity(userId, options = {}) {
    const { limit, offset } = options;
    const data = readJSON(ACTIVITY_LOG, { activities: [] });
    
    let activities = data.activities.filter(a => a.user_id === userId);
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const start = offset || 0;
    const end = limit ? start + limit : undefined;
    
    return activities.slice(start, end);
}

/**
 * Get all activity (admin)
 */
function getAllActivity(options = {}) {
    const { limit, offset, user_id, action } = options;
    const data = readJSON(ACTIVITY_LOG, { activities: [] });
    
    let activities = data.activities;
    
    if (user_id) {
        activities = activities.filter(a => a.user_id === user_id);
    }
    
    if (action) {
        activities = activities.filter(a => a.action === action);
    }
    
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const start = offset || 0;
    const end = limit ? start + limit : undefined;
    
    return activities.slice(start, end);
}

/**
 * Clear activity logs older than N days
 */
function clearActivityLogs(days = 30) {
    const data = readJSON(ACTIVITY_LOG, { activities: [] });
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    data.activities = data.activities.filter(a => new Date(a.timestamp) > cutoff);
    writeJSON(ACTIVITY_LOG, data);
    
    return data.activities.length;
}

// ============================================================
// SYSTEM STATS
// ============================================================

/**
 * Get system statistics (admin)
 */
function getSystemStats() {
    const users = getAllUsers();
    const totalUsers = users.length;
    const adminUsers = users.filter(u => u.role === 'admin').length;
    
    let totalFiles = 0;
    let totalStorage = 0;
    let totalMegaverses = 0;
    let totalVersions = 0;
    
    for (const user of users) {
        const megaverses = getUserMegaverses(user.id);
        totalMegaverses += megaverses.length;
        
        for (const mega of megaverses) {
            const files = getMegaverseFiles(user.id, mega.id);
            totalFiles += files.filter(f => !f.deleted).length;
            
            for (const file of files) {
                if (!file.deleted) {
                    totalStorage += file.file_size || 0;
                    totalVersions += (file.backups ? file.backups.length : 0) + 1;
                }
            }
        }
    }
    
    // Activity stats
    const activityData = readJSON(ACTIVITY_LOG, { activities: [] });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayActivities = activityData.activities.filter(a => 
        new Date(a.timestamp) >= today
    ).length;
    
    return {
        users: {
            total: totalUsers,
            admin: adminUsers,
            regular: totalUsers - adminUsers
        },
        files: {
            total: totalFiles,
            total_versions: totalVersions
        },
        storage: {
            total_bytes: totalStorage,
            total_formatted: formatBytes(totalStorage)
        },
        megaverses: {
            total: totalMegaverses
        },
        activity: {
            today: todayActivities,
            total: activityData.activities.length
        },
        system: {
            uptime: process.uptime(),
            timestamp: getTimestamp()
        }
    };
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
}

// ============================================================
// MAINTENANCE
// ============================================================

/**
 * Run system maintenance
 */
function runMaintenance() {
    // Clean expired sessions
    const sessionCount = cleanExpiredSessions();
    
    // Clean expired OTPs
    const otpCount = cleanExpiredOTPs();
    
    // Clean old activity logs (older than 90 days)
    const activityCount = clearActivityLogs(90);
    
    return {
        sessions_cleaned: sessionCount,
        otps_cleaned: otpCount,
        activity_cleaned: activityCount,
        timestamp: getTimestamp()
    };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    // Init
    ensureSystemFiles,
    
    // Config
    getSystemConfig,
    updateSystemConfig,
    
    // Sessions
    createSession,
    getSession,
    deleteSession,
    cleanExpiredSessions,
    
    // Users
    getAllUsers,
    getUserById,
    getUserByEmail,
    getUserByApiKey,
    createUser,
    updateUser,
    updateUserRole,
    updateUserQuota,
    updateUserStorage,
    updateUserLastLogin,
    deleteUser,
    getAdminUsers,
    getUserStorageStats,
    getAllUsersWithStats,
    
    // OTP
    storeOTP,
    verifyOTP,
    cleanExpiredOTPs,
    
    // Megaverses
    getUserMegaverses,
    getMegaverse,
    createMegaverse,
    deleteMegaverse,
    updateMegaverseStats,
    
    // Files
    getMegaverseFiles,
    getFile,
    saveFile,
    backupExistingFile,
    getFileVersions,
    restoreFileVersion,
    softDeleteFile,
    permanentDeleteFile,
    
    // Search
    searchFiles,
    
    // Activity
    logActivity,
    getUserActivity,
    getAllActivity,
    clearActivityLogs,
    
    // System
    getSystemStats,
    runMaintenance,
    
    // Helpers
    getTimestamp,
    getFileTimestamp,
    generateId,
    formatBytes
};
