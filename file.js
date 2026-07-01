/**
 * ============================================================
 * A.L.S — Advanced Local Storage
 * File: file.js
 * Description: JSON file database operations
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================
// PATHS
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
const ACTIVITY_FILE = path.join(SYSTEMDATA_PATH, 'activity.log.json');
const OTP_FILE = path.join(SYSTEMDATA_PATH, 'otp.json');

// ============================================================
// UTILITY FUNCTIONS
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
        const content = JSON.stringify(data, null, pretty ? 2 : 0);
        // Write to temp file then rename for atomicity
        const tempFile = filePath + '.tmp';
        fs.writeFileSync(tempFile, content, 'utf8');
        fs.renameSync(tempFile, filePath);
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
    const random = crypto.randomBytes(6).toString('hex');
    return `${prefix}${timestamp}_${random}`;
}

/**
 * Get timestamp for filenames (YYYY-MM-DD-HH-MM-SS-NNNNNNNNN)
 */
function getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    const ns = String(process.hrtime()[1]).padStart(9, '0');
    return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}-${ms}${ns}`;
}

/**
 * Get ISO timestamp
 */
function getISOTimestamp() {
    return new Date().toISOString();
}

/**
 * Safe filename for storage
 */
function sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

/**
 * Hash a file (SHA-256)
 */
function hashFile(filePath) {
    try {
        const data = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(data).digest('hex');
    } catch (error) {
        return crypto.createHash('sha256').update(filePath + Date.now()).digest('hex');
    }
}

// ============================================================
// SYSTEM INITIALIZATION
// ============================================================

/**
 * Ensure all required system files exist
 */
function ensureSystemFiles() {
    // Ensure directories exist
    [SYSTEM_PATH, USERS_PATH, MEGAVERSES_PATH, SYSTEMDATA_PATH, LOGS_PATH].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    // Config file
    if (!fs.existsSync(CONFIG_FILE)) {
        writeJSON(CONFIG_FILE, {
            system_name: 'A.L.S',
            version: '1.0.0',
            created_at: getISOTimestamp(),
            admin_email: '',
            max_file_size: 104857600, // 100 MB
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
            default_quota: 10 * 1024 * 1024 * 1024, // 10 GB
            backup_retention: 100,
            session_timeout_hours: 24,
            otp_expiry_minutes: 5,
            maintenance_mode: false,
            allow_registrations: true
        });
    }

    // Sessions file
    if (!fs.existsSync(SESSIONS_FILE)) {
        writeJSON(SESSIONS_FILE, { sessions: [] });
    }

    // Users file
    if (!fs.existsSync(USERS_FILE)) {
        writeJSON(USERS_FILE, { users: [] });
    }

    // Megaverses index
    if (!fs.existsSync(MEGAVERSES_INDEX)) {
        writeJSON(MEGAVERSES_INDEX, { megaverses: [] });
    }

    // Activity log
    if (!fs.existsSync(ACTIVITY_FILE)) {
        writeJSON(ACTIVITY_FILE, { activities: [] });
    }

    // OTP storage
    if (!fs.existsSync(OTP_FILE)) {
        writeJSON(OTP_FILE, { otps: [] });
    }

    return true;
}

// ============================================================
// SESSION FUNCTIONS
// ============================================================

/**
 * Create a new session
 */
function createSession(sessionData) {
    const sessions = readJSON(SESSIONS_FILE, { sessions: [] });
    sessions.sessions.push({
        token: sessionData.token,
        user_id: sessionData.user_id,
        email: sessionData.email,
        role: sessionData.role || 'user',
        created_at: getISOTimestamp(),
        expires_at: sessionData.expires_at
    });
    writeJSON(SESSIONS_FILE, sessions);
    return sessionData;
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
 * Delete expired sessions
 */
function deleteExpiredSessions() {
    const sessions = readJSON(SESSIONS_FILE, { sessions: [] });
    const now = new Date();
    sessions.sessions = sessions.sessions.filter(s => {
        return s.expires_at && new Date(s.expires_at) > now;
    });
    writeJSON(SESSIONS_FILE, sessions);
    return sessions.sessions.length;
}

// ============================================================
// USER FUNCTIONS
// ============================================================

/**
 * Get all users
 */
function getAllUsers() {
    const data = readJSON(USERS_FILE, { users: [] });
    return data.users;
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

    // Check if email already exists
    if (users.find(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
        throw new Error('User with this email already exists');
    }

    const newUser = {
        id: generateId('u'),
        email: userData.email.toLowerCase(),
        username: userData.username || userData.email.split('@')[0],
        role: userData.role || 'user',
        api_key: 'als_' + crypto.randomBytes(20).toString('hex'),
        created_at: getISOTimestamp(),
        last_login: null,
        storage_quota: userData.storage_quota || 10 * 1024 * 1024 * 1024,
        storage_used: 0,
        settings: userData.settings || {},
        megaverses: []
    };

    const allUsers = getAllUsers();
    allUsers.push(newUser);
    writeJSON(USERS_FILE, { users: allUsers });

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

    users[index] = { ...users[index], ...updates };
    writeJSON(USERS_FILE, { users: users });
    return users[index];
}

/**
 * Update user's last login
 */
function updateUserLastLogin(userId) {
    return updateUser(userId, { last_login: getISOTimestamp() });
}

/**
 * Update user's storage used
 */
function updateUserStorage(userId, delta) {
    const user = getUserById(userId);
    if (!user) throw new Error('User not found');
    const newUsed = Math.max(0, user.storage_used + delta);
    return updateUser(userId, { storage_used: newUsed });
}

/**
 * Update user role
 */
function updateUserRole(userId, role) {
    return updateUser(userId, { role: role });
}

/**
 * Update user quota
 */
function updateUserQuota(userId, quota) {
    return updateUser(userId, { storage_quota: quota });
}

/**
 * Add megaverse to user's list
 */
function addUserMegaverse(userId, megaverseId, megaverseName) {
    const user = getUserById(userId);
    if (!user) throw new Error('User not found');

    if (!user.megaverses) {
        user.megaverses = [];
    }

    if (!user.megaverses.find(m => m.id === megaverseId)) {
        user.megaverses.push({
            id: megaverseId,
            name: megaverseName,
            added_at: getISOTimestamp()
        });
        updateUser(userId, { megaverses: user.megaverses });
    }
    return user;
}

/**
 * Delete user and all their data
 */
function deleteUser(userId) {
    const user = getUserById(userId);
    if (!user) throw new Error('User not found');

    // Delete all user's megaverses
    const megaverses = getUserMegaverses(userId);
    for (const mega of megaverses) {
        deleteMegaverse(mega.id);
    }

    // Remove user from users list
    const users = getAllUsers();
    users.users = users.users.filter(u => u.id !== userId);
    writeJSON(USERS_FILE, { users: users });

    // Delete user's directory
    const userDir = path.join(MEGAVERSES_PATH, userId);
    if (fs.existsSync(userDir)) {
        fs.rmSync(userDir, { recursive: true, force: true });
    }

    return true;
}

/**
 * Get all users with storage stats (admin)
 */
function getAllUsersWithStats() {
    const users = getAllUsers();
    const result = [];

    for (const user of users) {
        const stats = getUserStorageStats(user.id);
        result.push({
            ...user,
            file_count: stats.file_count || 0,
            storage_used: stats.total_size || 0,
            megaverse_count: stats.megaverse_count || 0
        });
    }

    return result;
}

/**
 * Get admin users
 */
function getAdminUsers() {
    const users = getAllUsers();
    return users.filter(u => u.role === 'admin');
}

// ============================================================
// MEGAVERSE FUNCTIONS
// ============================================================

/**
 * Get megaverse by ID
 */
function getMegaverse(megaverseId) {
    const index = readJSON(MEGAVERSES_INDEX, { megaverses: [] });
    return index.megaverses.find(m => m.id === megaverseId) || null;
}

/**
 * Get user's megaverses
 */
function getUserMegaverses(userId) {
    const index = readJSON(MEGAVERSES_INDEX, { megaverses: [] });
    return index.megaverses.filter(m => m.user_id === userId);
}

/**
 * Create a new megaverse
 */
function createMegaverse(data) {
    const { user_id, name, description } = data;

    // Create megaverse directory
    const megaPath = path.join(MEGAVERSES_PATH, user_id, name);
    if (fs.existsSync(megaPath)) {
        throw new Error('Megaverse already exists');
    }

    // Create directory structure
    const liveFile = path.join(megaPath, 'live', 'file');
    const liveJson = path.join(megaPath, 'live', 'json');
    const backupFile = path.join(megaPath, 'backup', 'file');
    const backupJson = path.join(megaPath, 'backup', 'json');

    [liveFile, liveJson, backupFile, backupJson].forEach(dir => {
        fs.mkdirSync(dir, { recursive: true });
    });

    // Create metadata
    const newMegaverse = {
        id: generateId('m'),
        user_id: user_id,
        name: name,
        description: description || '',
        created_at: getISOTimestamp(),
        updated_at: getISOTimestamp(),
        file_count: 0,
        total_size: 0,
        path: megaPath
    };

    // Save meta
    writeJSON(path.join(megaPath, '_meta.json'), newMegaverse);

    // Save files index
    writeJSON(path.join(megaPath, '_files.json'), { files: [] });

    // Add to global index
    const index = readJSON(MEGAVERSES_INDEX, { megaverses: [] });
    index.megaverses.push({
        id: newMegaverse.id,
        user_id: user_id,
        name: name,
        description: description || '',
        created_at: newMegaverse.created_at,
        file_count: 0,
        total_size: 0,
        path: megaPath
    });
    writeJSON(MEGAVERSES_INDEX, index);

    // Add to user's megaverse list
    addUserMegaverse(user_id, newMegaverse.id, name);

    return newMegaverse;
}

/**
 * Delete megaverse
 */
function deleteMegaverse(megaverseId) {
    const mega = getMegaverse(megaverseId);
    if (!mega) throw new Error('Megaverse not found');

    // Delete all files in this megaverse
    const files = getFiles(megaverseId);
    for (const file of files) {
        // Delete physical file
        if (fs.existsSync(file.storage_path)) {
            fs.unlinkSync(file.storage_path);
        }
        // Delete backups
        const versions = getFileVersions(file.id);
        for (const version of versions) {
            if (fs.existsSync(version.storage_path)) {
                fs.unlinkSync(version.storage_path);
            }
        }
    }

    // Delete megaverse directory
    if (fs.existsSync(mega.path)) {
        fs.rmSync(mega.path, { recursive: true, force: true });
    }

    // Remove from global index
    const index = readJSON(MEGAVERSES_INDEX, { megaverses: [] });
    index.megaverses = index.megaverses.filter(m => m.id !== megaverseId);
    writeJSON(MEGAVERSES_INDEX, index);

    // Remove from user's megaverse list
    const user = getUserById(mega.user_id);
    if (user && user.megaverses) {
        user.megaverses = user.megaverses.filter(m => m.id !== megaverseId);
        updateUser(user.id, { megaverses: user.megaverses });
    }

    return true;
}

// ============================================================
// FILE FUNCTIONS
// ============================================================

/**
 * Get files in a megaverse
 */
function getFiles(megaverseId, options = {}) {
    const mega = getMegaverse(megaverseId);
    if (!mega) throw new Error('Megaverse not found');

    const filesPath = path.join(mega.path, '_files.json');
    const data = readJSON(filesPath, { files: [] });
    let files = data.files;

    // Filter by search
    if (options.search) {
        const search = options.search.toLowerCase();
        files = files.filter(f =>
            f.filename.toLowerCase().includes(search) ||
            (f.metadata && f.metadata.tags && f.metadata.tags.some(t => t.toLowerCase().includes(search)))
        );
    }

    // Sort by uploaded date (newest first)
    files = files.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));

    // Limit and offset
    if (options.limit) {
        const offset = options.offset || 0;
        files = files.slice(offset, offset + options.limit);
    }

    return files;
}

/**
 * Get a single file by ID
 */
function getFile(fileId) {
    // Search all megaverses
    const index = readJSON(MEGAVERSES_INDEX, { megaverses: [] });
    for (const mega of index.megaverses) {
        const filesPath = path.join(mega.path, '_files.json');
        const data = readJSON(filesPath, { files: [] });
        const file = data.files.find(f => f.id === fileId);
        if (file) {
            return {
                ...file,
                user_id: mega.user_id,
                megaverse_id: mega.id,
                megaverse_name: mega.name
            };
        }
    }
    return null;
}

/**
 * Save a new file
 */
function saveFile(fileData) {
    const { user_id, megaverse_id, filename, storage_path, file_size, file_hash, mime_type, metadata } = fileData;

    const mega = getMegaverse(megaverse_id);
    if (!mega) throw new Error('Megaverse not found');

    if (mega.user_id !== user_id) {
        throw new Error('User does not own this megaverse');
    }

    const filesPath = path.join(mega.path, '_files.json');
    const data = readJSON(filesPath, { files: [] });

    // Check if file already exists
    const existing = data.files.find(f => f.filename === filename);
    let fileRecord;

    if (existing) {
        // Update existing file - create backup
        const backupDir = path.join(mega.path, 'backup', 'file', sanitizeFilename(filename));
        const timestamp = getTimestamp();
        const backupPath = path.join(backupDir, `${timestamp}_${filename}`);

        // Create backup directory
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // Copy file to backup
        if (fs.existsSync(existing.storage_path)) {
            fs.copyFileSync(existing.storage_path, backupPath);

            // Also backup metadata
            const metaBackupDir = path.join(mega.path, 'backup', 'json', sanitizeFilename(filename));
            if (!fs.existsSync(metaBackupDir)) {
                fs.mkdirSync(metaBackupDir, { recursive: true });
            }
            const metaBackupPath = path.join(metaBackupDir, `${timestamp}.json`);
            writeJSON(metaBackupPath, {
                metadata: existing.metadata || {},
                version: existing.version,
                size: existing.size,
                hash: existing.hash
            });

            // Update file record
            existing.version = (existing.version || 1) + 1;
            existing.size = file_size;
            existing.hash = file_hash || hashFile(storage_path);
            existing.mime_type = mime_type;
            existing.storage_path = storage_path;
            existing.updated_at = getISOTimestamp();
            existing.metadata = { ...(existing.metadata || {}), ...(metadata || {}) };

            // Add backup reference
            if (!existing.backups) existing.backups = [];
            existing.backups.push({
                version: existing.version - 1,
                path: backupPath,
                created_at: getISOTimestamp()
            });

            fileRecord = existing;
        } else {
            // File doesn't exist on disk, treat as new
            fileRecord = createNewFileRecord();
        }
    } else {
        // New file
        fileRecord = createNewFileRecord();
    }

    function createNewFileRecord() {
        const newFile = {
            id: generateId('f'),
            filename: filename,
            storage_path: storage_path,
            size: file_size,
            hash: file_hash || hashFile(storage_path),
            mime_type: mime_type,
            version: 1,
            uploaded_at: getISOTimestamp(),
            updated_at: getISOTimestamp(),
            metadata: metadata || {},
            backups: []
        };

        data.files.push(newFile);

        // Update megaverse stats
        mega.file_count = (mega.file_count || 0) + 1;
        mega.total_size = (mega.total_size || 0) + file_size;
        mega.updated_at = getISOTimestamp();

        // Update global index
        const index = readJSON(MEGAVERSES_INDEX, { megaverses: [] });
        const idx = index.megaverses.findIndex(m => m.id === megaverse_id);
        if (idx !== -1) {
            index.megaverses[idx].file_count = mega.file_count;
            index.megaverses[idx].total_size = mega.total_size;
            index.megaverses[idx].updated_at = mega.updated_at;
            writeJSON(MEGAVERSES_INDEX, index);
        }

        // Update user storage
        updateUserStorage(user_id, file_size);

        return newFile;
    }

    // Save files index
    writeJSON(filesPath, data);

    // Update megaverse meta
    writeJSON(path.join(mega.path, '_meta.json'), mega);

    return {
        ...fileRecord,
        user_id: user_id,
        megaverse_id: megaverse_id
    };
}

/**
 * Soft delete a file
 */
function softDeleteFile(fileId) {
    const file = getFile(fileId);
    if (!file) throw new Error('File not found');

    const mega = getMegaverse(file.megaverse_id);
    if (!mega) throw new Error('Megaverse not found');

    const filesPath = path.join(mega.path, '_files.json');
    const data = readJSON(filesPath, { files: [] });

    const index = data.files.findIndex(f => f.id === fileId);
    if (index === -1) throw new Error('File not found in megaverse');

    // Mark as deleted
    data.files[index].deleted_at = getISOTimestamp();
    data.files[index].is_deleted = true;

    // Update megaverse stats
    mega.file_count = Math.max(0, (mega.file_count || 0) - 1);
    mega.total_size = Math.max(0, (mega.total_size || 0) - file.size);
    mega.updated_at = getISOTimestamp();

    writeJSON(filesPath, data);

    // Update global index
    const globalIndex = readJSON(MEGAVERSES_INDEX, { megaverses: [] });
    const idx = globalIndex.megaverses.findIndex(m => m.id === file.megaverse_id);
    if (idx !== -1) {
        globalIndex.megaverses[idx].file_count = mega.file_count;
        globalIndex.megaverses[idx].total_size = mega.total_size;
        globalIndex.megaverses[idx].updated_at = mega.updated_at;
        writeJSON(MEGAVERSES_INDEX, globalIndex);
    }

    // Update user storage
    updateUserStorage(file.user_id, -file.size);

    return true;
}

/**
 * Permanent delete a file
 */
function permanentDeleteFile(fileId) {
    const file = getFile(fileId);
    if (!file) throw new Error('File not found');

    const mega = getMegaverse(file.megaverse_id);
    if (!mega) throw new Error('Megaverse not found');

    const filesPath = path.join(mega.path, '_files.json');
    const data = readJSON(filesPath, { files: [] });

    // Remove file from index
    data.files = data.files.filter(f => f.id !== fileId);

    // Delete physical file
    if (fs.existsSync(file.storage_path)) {
        fs.unlinkSync(file.storage_path);
    }

    // Delete backup files
    if (file.backups) {
        for (const backup of file.backups) {
            if (fs.existsSync(backup.path)) {
                fs.unlinkSync(backup.path);
            }
        }
    }

    writeJSON(filesPath, data);
    return true;
}

// ============================================================
// VERSION FUNCTIONS
// ============================================================

/**
 * Get file version history
 */
function getFileVersions(fileId) {
    const file = getFile(fileId);
    if (!file) throw new Error('File not found');

    return file.backups || [];
}

/**
 * Restore a file to a specific version
 */
function restoreFileVersion(fileId, versionNumber) {
    const file = getFile(fileId);
    if (!file) throw new Error('File not found');

    const backup = file.backups.find(b => b.version === versionNumber);
    if (!backup) throw new Error('Version not found');

    if (!fs.existsSync(backup.path)) {
        throw new Error('Backup file not found on disk');
    }

    const mega = getMegaverse(file.megaverse_id);
    if (!mega) throw new Error('Megaverse not found');

    const filesPath = path.join(mega.path, '_files.json');
    const data = readJSON(filesPath, { files: [] });

    const index = data.files.findIndex(f => f.id === fileId);
    if (index === -1) throw new Error('File not found');

    // Backup current version before restoring
    const currentFile = data.files[index];
    const backupDir = path.join(mega.path, 'backup', 'file', sanitizeFilename(currentFile.filename));
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = getTimestamp();
    const currentBackupPath = path.join(backupDir, `${timestamp}_${currentFile.filename}`);

    if (fs.existsSync(currentFile.storage_path)) {
        fs.copyFileSync(currentFile.storage_path, currentBackupPath);

        if (!currentFile.backups) currentFile.backups = [];
        currentFile.backups.push({
            version: currentFile.version,
            path: currentBackupPath,
            created_at: getISOTimestamp()
        });
    }

    // Restore from backup
    const restoredFilePath = path.join(mega.path, 'live', 'file', currentFile.filename);
    fs.copyFileSync(backup.path, restoredFilePath);

    // Update file record
    currentFile.storage_path = restoredFilePath;
    currentFile.size = fs.statSync(restoredFilePath).size;
    currentFile.hash = hashFile(restoredFilePath);
    currentFile.version = (currentFile.version || 0) + 1;
    currentFile.updated_at = getISOTimestamp();

    // Get metadata from backup if available
    const metaBackupPath = path.join(mega.path, 'backup', 'json', sanitizeFilename(currentFile.filename), `${timestamp}.json`);
    if (fs.existsSync(metaBackupPath)) {
        const metaData = readJSON(metaBackupPath);
        if (metaData && metaData.metadata) {
            currentFile.metadata = { ...currentFile.metadata, ...metaData.metadata };
        }
    }

    writeJSON(filesPath, data);

    return currentFile;
}

// ============================================================
// OTP FUNCTIONS
// ============================================================

/**
 * Store OTP for email
 */
function storeOTP(email, otp) {
    const data = readJSON(OTP_FILE, { otps: [] });
    const config = readJSON(CONFIG_FILE);
    const expiryMinutes = config.otp_expiry_minutes || 5;

    // Remove existing OTPs for this email
    data.otps = data.otps.filter(o => o.email !== email);

    data.otps.push({
        email: email.toLowerCase(),
        otp: otp,
        created_at: getISOTimestamp(),
        expires_at: new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString(),
        attempts: 0
    });

    writeJSON(OTP_FILE, data);
    return true;
}

/**
 * Verify OTP
 */
function verifyOTP(email, otp) {
    const data = readJSON(OTP_FILE, { otps: [] });
    const record = data.otps.find(o => o.email === email.toLowerCase());

    if (!record) {
        return false;
    }

    // Check expiry
    if (new Date(record.expires_at) < new Date()) {
        // Remove expired OTP
        data.otps = data.otps.filter(o => o.email !== email.toLowerCase());
        writeJSON(OTP_FILE, data);
        return false;
    }

    // Check attempts (max 3)
    if (record.attempts >= 3) {
        data.otps = data.otps.filter(o => o.email !== email.toLowerCase());
        writeJSON(OTP_FILE, data);
        return false;
    }

    // Verify OTP
    if (record.otp === otp) {
        // Remove OTP on success
        data.otps = data.otps.filter(o => o.email !== email.toLowerCase());
        writeJSON(OTP_FILE, data);
        return true;
    }

    // Increment attempts
    record.attempts = (record.attempts || 0) + 1;
    writeJSON(OTP_FILE, data);
    return false;
}

// ============================================================
// ACTIVITY FUNCTIONS
// ============================================================

/**
 * Log an activity
 */
function logActivity(data) {
    const { user_id, user_email, action, details } = data;

    const activity = {
        id: generateId('a'),
        timestamp: getISOTimestamp(),
        user_id: user_id || null,
        user_email: user_email || 'system',
        action: action,
        details: details || {},
        ip: data.ip || null,
        user_agent: data.user_agent || null
    };

    const activities = readJSON(ACTIVITY_FILE, { activities: [] });
    activities.activities.push(activity);

    // Keep last 10,000 activities
    if (activities.activities.length > 10000) {
        activities.activities = activities.activities.slice(-10000);
    }

    writeJSON(ACTIVITY_FILE, activities);
    return activity;
}

/**
 * Get user activity
 */
function getUserActivity(userId, options = {}) {
    const activities = readJSON(ACTIVITY_FILE, { activities: [] });
    let result = activities.activities.filter(a => a.user_id === userId);

    if (options.limit) {
        const offset = options.offset || 0;
        result = result.slice(offset, offset + options.limit);
    }

    return result;
}

/**
 * Get all activity (admin)
 */
function getAllActivity(options = {}) {
    const activities = readJSON(ACTIVITY_FILE, { activities: [] });
    let result = activities.activities;

    // Filter by user
    if (options.user_id) {
        result = result.filter(a => a.user_id === options.user_id);
    }

    // Filter by action
    if (options.action) {
        result = result.filter(a => a.action === options.action);
    }

    // Sort by timestamp (newest first)
    result = result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (options.limit) {
        const offset = options.offset || 0;
        result = result.slice(offset, offset + options.limit);
    }

    return result;
}

/**
 * Clear activity logs older than N days
 */
function clearActivityLogs(days = 30) {
    const activities = readJSON(ACTIVITY_FILE, { activities: [] });
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    activities.activities = activities.activities.filter(a => {
        return new Date(a.timestamp) > cutoff;
    });

    writeJSON(ACTIVITY_FILE, activities);
    return activities.activities.length;
}

// ============================================================
// STORAGE STATS FUNCTIONS
// ============================================================

/**
 * Get user storage statistics
 */
function getUserStorageStats(userId) {
    const megaverses = getUserMegaverses(userId);
    let totalSize = 0;
    let fileCount = 0;
    let versionCount = 0;

    for (const mega of megaverses) {
        const files = getFiles(mega.id);
        for (const file of files) {
            if (!file.is_deleted) {
                totalSize += file.size || 0;
                fileCount++;
                versionCount += (file.backups || []).length;
            }
        }
    }

    return {
        total_size: totalSize,
        file_count: fileCount,
        version_count: versionCount,
        megaverse_count: megaverses.length
    };
}

/**
 * Get system statistics (admin)
 */
function getSystemStats() {
    const users = getAllUsers();
    const index = readJSON(MEGAVERSES_INDEX, { megaverses: [] });
    const activities = readJSON(ACTIVITY_FILE, { activities: [] });

    let totalFiles = 0;
    let totalSize = 0;
    let totalVersions = 0;

    for (const mega of index.megaverses) {
        const files = getFiles(mega.id);
        for (const file of files) {
            if (!file.is_deleted) {
                totalFiles++;
                totalSize += file.size || 0;
                totalVersions += (file.backups || []).length;
            }
        }
    }

    const today = new Date().toDateString();
    const todayActivities = activities.activities.filter(a => {
        return new Date(a.timestamp).toDateString() === today;
    });

    return {
        total_users: users.length,
        total_files: totalFiles,
        total_size: totalSize,
        total_versions: totalVersions,
        total_megaverses: index.megaverses.length,
        today_activities: todayActivities.length,
        active_sessions: getActiveSessionCount()
    };
}

/**
 * Get active session count
 */
function getActiveSessionCount() {
    const sessions = readJSON(SESSIONS_FILE, { sessions: [] });
    const now = new Date();
    return sessions.sessions.filter(s => new Date(s.expires_at) > now).length;
}

// ============================================================
// SYSTEM CONFIG FUNCTIONS
// ============================================================

/**
 * Get system configuration
 */
function getSystemConfig() {
    return readJSON(CONFIG_FILE);
}

/**
 * Update system configuration
 */
function updateSystemConfig(updates) {
    const config = readJSON(CONFIG_FILE);
    const newConfig = { ...config, ...updates };
    writeJSON(CONFIG_FILE, newConfig);
    return newConfig;
}

// ============================================================
// SEARCH FUNCTIONS
// ============================================================

/**
 * Search files across all user megaverses
 */
function searchFiles(userId, options = {}) {
    const { query, type, limit = 50 } = options;
    const megaverses = getUserMegaverses(userId);
    const results = [];

    for (const mega of megaverses) {
        const files = getFiles(mega.id);
        for (const file of files) {
            if (file.is_deleted) continue;

            // Filter by type
            if (type && file.mime_type !== type && !file.mime_type.startsWith(type)) {
                continue;
            }

            // Search by filename
            if (query && !file.filename.toLowerCase().includes(query.toLowerCase())) {
                // Search in metadata tags
                if (file.metadata && file.metadata.tags) {
                    const tagsMatch = file.metadata.tags.some(t =>
                        t.toLowerCase().includes(query.toLowerCase())
                    );
                    if (!tagsMatch) continue;
                } else {
                    continue;
                }
            }

            results.push({
                ...file,
                megaverse_id: mega.id,
                megaverse_name: mega.name
            });

            if (results.length >= limit) break;
        }
        if (results.length >= limit) break;
    }

    return results;
}

// ============================================================
// FILE SYSTEM HELPERS
// ============================================================

/**
 * Get user directory path
 */
function getUserDirectory(userId) {
    return path.join(MEGAVERSES_PATH, userId);
}

/**
 * Get megaverse directory path
 */
function getMegaverseDirectory(userId, megaverseName) {
    return path.join(MEGAVERSES_PATH, userId, megaverseName);
}

/**
 * Ensure user directory exists
 */
function ensureUserDirectory(userId) {
    const dir = getUserDirectory(userId);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    // System
    ensureSystemFiles,

    // Sessions
    createSession,
    getSession,
    deleteSession,
    deleteExpiredSessions,
    getActiveSessionCount,

    // Users
    getAllUsers,
    getUserById,
    getUserByEmail,
    getUserByApiKey,
    createUser,
    updateUser,
    updateUserLastLogin,
    updateUserStorage,
    updateUserRole,
    updateUserQuota,
    addUserMegaverse,
    deleteUser,
    getAllUsersWithStats,
    getAdminUsers,

    // Megaverses
    getMegaverse,
    getUserMegaverses,
    createMegaverse,
    deleteMegaverse,

    // Files
    getFiles,
    getFile,
    saveFile,
    softDeleteFile,
    permanentDeleteFile,

    // Versions
    getFileVersions,
    restoreFileVersion,

    // OTP
    storeOTP,
    verifyOTP,

    // Activity
    logActivity,
    getUserActivity,
    getAllActivity,
    clearActivityLogs,

    // Stats
    getUserStorageStats,
    getSystemStats,

    // Config
    getSystemConfig,
    updateSystemConfig,

    // Search
    searchFiles,

    // Utilities
    getTimestamp,
    getISOTimestamp,
    sanitizeFilename,
    hashFile,
    generateId,
    readJSON,
    writeJSON,

    // Paths
    getUserDirectory,
    getMegaverseDirectory,
    ensureUserDirectory
};
