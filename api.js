#!/usr/bin/env node

/**
 * ============================================================
 * A.L.S — Advanced Local Storage
 * File: API.js
 * Description: External API services (Email, Downloads, etc.)
 * ============================================================
 */

const nodemailer = require('nodemailer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

// ============================================================
// CONFIGURATION
// ============================================================

// Email configuration — Load from environment or config
const EMAIL_CONFIG = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
        user: process.env.SMTP_USER || 'citytechuk@gmail.com',
        pass: process.env.SMTP_PASS || 'odnjyxywzrcgubzw'
    },
    from: process.env.SMTP_FROM || 'citytechuk@gmail.com',
    from_name: process.env.SMTP_FROM_NAME || 'A.L.S System'
};

// Download configuration
const DOWNLOAD_CONFIG = {
    timeout: 30000, // 30 seconds
    maxSize: 100 * 1024 * 1024, // 100 MB
    maxRedirects: 5,
    tempDir: path.join(__dirname, 'database', 'downloads')
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Generate random OTP (6 digits)
 */
function generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
}

/**
 * Generate random token
 */
function generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Get email status
 */
function getEmailStatus() {
    return !!(EMAIL_CONFIG.auth.user && EMAIL_CONFIG.auth.pass);
}

// ============================================================
// EMAIL SERVICES
// ============================================================

/**
 * Create email transporter
 */
function createTransporter() {
    if (!getEmailStatus()) {
        throw new Error('Email not configured');
    }

    return nodemailer.createTransport({
        host: EMAIL_CONFIG.host,
        port: EMAIL_CONFIG.port,
        secure: EMAIL_CONFIG.secure,
        auth: {
            user: EMAIL_CONFIG.auth.user,
            pass: EMAIL_CONFIG.auth.pass
        },
        tls: {
            rejectUnauthorized: false
        }
    });
}

/**
 * Send OTP email with beautiful HTML template
 */
async function sendOTPEmail(toEmail, otp) {
    if (!getEmailStatus()) {
        console.warn('⚠️ Email not configured. OTP:', otp);
        return {
            success: true,
            otp: otp,
            message: 'Email not configured — OTP returned for testing'
        };
    }

    try {
        const transporter = createTransporter();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

        const htmlContent = generateOTPEmailHTML(otp, now, expiresAt);
        const textContent = generateOTPEmailText(otp, now, expiresAt);

        const info = await transporter.sendMail({
            from: `"${EMAIL_CONFIG.from_name}" <${EMAIL_CONFIG.from}>`,
            to: toEmail,
            subject: `🔐 Your A.L.S Verification Code - ${now.toLocaleTimeString()}`,
            text: textContent,
            html: htmlContent
        });

        return {
            success: true,
            messageId: info.messageId,
            otp: otp // Only for development
        };

    } catch (error) {
        console.error('Email send error:', error);
        return {
            success: false,
            error: error.message,
            otp: otp // Only for development
        };
    }
}

/**
 * Generate HTML email template with glassmorphism design
 */
function generateOTPEmailHTML(otp, now, expiresAt) {
    const timeStr = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
    const dateStr = now.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    });
    const expiresStr = expiresAt.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OTP Verification</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        
        .container {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 24px;
            max-width: 480px;
            width: 100%;
            padding: 45px 40px 35px;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
            animation: slideUp 0.6s ease-out;
            position: relative;
            overflow: hidden;
        }
        
        .container::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -50%;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle, rgba(108, 99, 234, 0.08) 0%, transparent 70%);
            pointer-events: none;
        }
        
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        
        .header {
            text-align: center;
            position: relative;
            z-index: 1;
        }
        
        .logo {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
            font-weight: 700;
            font-size: 24px;
            color: #ffffff;
            text-decoration: none;
            margin-bottom: 16px;
        }
        
        .logo i {
            color: #6C63FF;
            font-size: 28px;
            filter: drop-shadow(0 0 20px rgba(108, 99, 255, 0.3));
        }
        
        .logo span {
            background: linear-gradient(135deg, #6C63FF, #00D4FF);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .icon-wrapper {
            width: 72px;
            height: 72px;
            background: linear-gradient(135deg, #6C63FF 0%, #764ba2 100%);
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            color: white;
            margin-bottom: 16px;
            box-shadow: 0 8px 25px rgba(108, 99, 255, 0.4);
            animation: pulse 2s ease-in-out infinite;
        }
        
        h1 {
            font-size: 26px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 6px;
            letter-spacing: -0.5px;
        }
        
        .subtitle {
            color: rgba(255, 255, 255, 0.6);
            font-size: 15px;
            font-weight: 400;
        }
        
        .badge-container {
            text-align: center;
            margin: 20px 0 18px;
        }
        
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(0, 230, 118, 0.12);
            color: #00E676;
            padding: 6px 18px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        
        .badge .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #00E676;
            animation: pulse 1.5s ease-in-out infinite;
        }
        
        .otp-section {
            background: rgba(255, 255, 255, 0.04);
            border-radius: 16px;
            padding: 28px 20px 22px;
            margin: 8px 0 22px;
            border: 2px dashed rgba(108, 99, 255, 0.15);
            position: relative;
            z-index: 1;
        }
        
        .otp-label {
            text-align: center;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 3px;
            color: rgba(255, 255, 255, 0.4);
            font-weight: 600;
            margin-bottom: 10px;
        }
        
        .otp-label i {
            margin-right: 6px;
            font-size: 12px;
        }
        
        .otp-code {
            text-align: center;
            font-size: 56px;
            font-weight: 800;
            color: #ffffff;
            letter-spacing: 12px;
            font-family: 'Courier New', monospace;
            background: rgba(0, 0, 0, 0.3);
            padding: 12px 20px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.06);
        }
        
        .otp-code span {
            background: linear-gradient(135deg, #6C63FF 0%, #00D4FF 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin: 20px 0 25px;
            position: relative;
            z-index: 1;
        }
        
        .info-item {
            background: rgba(255, 255, 255, 0.04);
            border-radius: 12px;
            padding: 14px 12px;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.04);
            transition: all 0.3s ease;
        }
        
        .info-item .fa-icon {
            font-size: 18px;
            color: #6C63FF;
            display: block;
            margin-bottom: 6px;
        }
        
        .info-item .label {
            font-size: 10px;
            text-transform: uppercase;
            color: rgba(255, 255, 255, 0.3);
            letter-spacing: 1px;
            font-weight: 600;
        }
        
        .info-item .value {
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;
            margin-top: 4px;
        }
        
        .divider {
            border: none;
            height: 1px;
            background: linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent);
            margin: 20px 0 18px;
        }
        
        .footer {
            text-align: center;
            position: relative;
            z-index: 1;
        }
        
        .footer p {
            color: rgba(255, 255, 255, 0.3);
            font-size: 12px;
            line-height: 1.6;
        }
        
        .footer .brand {
            color: #6C63FF;
            font-weight: 600;
        }
        
        .footer .small {
            font-size: 10px;
            color: rgba(255, 255, 255, 0.15);
            margin-top: 4px;
        }
        
        .security-note {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 11px;
            color: rgba(255, 255, 255, 0.3);
            margin-top: 12px;
        }
        
        .security-note i {
            font-size: 13px;
            color: #6C63FF;
        }
        
        @media (max-width: 480px) {
            .container {
                padding: 30px 20px 25px;
            }
            
            .otp-code {
                font-size: 40px;
                letter-spacing: 8px;
                padding: 10px 14px;
            }
            
            h1 {
                font-size: 22px;
            }
            
            .info-grid {
                grid-template-columns: 1fr 1fr;
                gap: 8px;
            }
            
            .info-item {
                padding: 10px 8px;
            }
            
            .icon-wrapper {
                width: 60px;
                height: 60px;
                font-size: 26px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">
                <i class="fas fa-shield-alt"></i>
                <span>A.L.S</span>
            </div>
            
            <div class="icon-wrapper">
                <i class="fas fa-shield-alt"></i>
            </div>
            
            <h1>Verification Code</h1>
            <p class="subtitle">Enter this code to complete your verification</p>
        </div>
        
        <div class="badge-container">
            <span class="badge">
                <span class="dot"></span>
                Active Now
            </span>
        </div>
        
        <div class="otp-section">
            <div class="otp-label">
                <i class="fas fa-key"></i> One Time Password
            </div>
            <div class="otp-code">
                <span>${otp}</span>
            </div>
        </div>
        
        <div class="info-grid">
            <div class="info-item">
                <i class="fas fa-clock fa-icon"></i>
                <div class="label">Expires</div>
                <div class="value">${expiresStr}</div>
            </div>
            <div class="info-item">
                <i class="fas fa-calendar-day fa-icon"></i>
                <div class="label">Date</div>
                <div class="value">${dateStr}</div>
            </div>
            <div class="info-item">
                <i class="fas fa-hourglass-half fa-icon"></i>
                <div class="label">Duration</div>
                <div class="value">5 Minutes</div>
            </div>
            <div class="info-item">
                <i class="fas fa-fingerprint fa-icon"></i>
                <div class="label">Type</div>
                <div class="value">Single Use</div>
            </div>
        </div>
        
        <div class="security-note">
            <i class="fas fa-lock"></i>
            <span>This is an automated security notification</span>
        </div>
        
        <hr class="divider" />
        
        <div class="footer">
            <p>
                <i class="fas fa-shield-alt brand"></i> 
                <span class="brand">SecureVerify</span> · All rights reserved
            </p>
            <p class="small">
                <i class="fas fa-info-circle"></i>
                If you didn't request this code, please ignore this email.
            </p>
            <p class="small" style="margin-top:6px;">
                <i class="fas fa-chevron-circle-right"></i>
                <i class="fas fa-chevron-circle-right" style="margin:0 2px;"></i>
                <i class="fas fa-chevron-circle-right"></i>
            </p>
        </div>
    </div>
</body>
</html>
    `;
}

/**
 * Generate plain text email fallback
 */
function generateOTPEmailText(otp, now, expiresAt) {
    const timeStr = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
    const dateStr = now.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    });

    return `
========================================
    A.L.S — VERIFICATION CODE
========================================

OTP: ${otp}
Expires: ${timeStr}
Date: ${dateStr}
Duration: 5 Minutes
Type: Single Use

This code is valid for 5 minutes.
If you didn't request this, please ignore.

© 2026 A.L.S — Advanced Local Storage
    `;
}

// ============================================================
// URL DOWNLOAD SERVICES
// ============================================================

/**
 * Download file from URL
 */
async function downloadFromUrl(url, options = {}) {
    const {
        timeout = DOWNLOAD_CONFIG.timeout,
        maxSize = DOWNLOAD_CONFIG.maxSize,
        maxRedirects = DOWNLOAD_CONFIG.maxRedirects,
        filename = null,
        headers = {}
    } = options;

    // Create temp directory
    if (!fs.existsSync(DOWNLOAD_CONFIG.tempDir)) {
        fs.mkdirSync(DOWNLOAD_CONFIG.tempDir, { recursive: true });
    }

    try {
        // Validate URL
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw new Error('Invalid URL protocol. Only HTTP/HTTPS allowed.');
        }

        // Download file
        const response = await axios({
            method: 'GET',
            url: url,
            timeout: timeout,
            maxRedirects: maxRedirects,
            headers: {
                'User-Agent': 'A.L.S File Importer/1.0',
                ...headers
            },
            responseType: 'stream',
            validateStatus: function(status) {
                return status >= 200 && status < 300;
            }
        });

        // Check content length
        const contentLength = parseInt(response.headers['content-length']);
        if (contentLength && contentLength > maxSize) {
            throw new Error(`File too large: ${contentLength} bytes (max: ${maxSize})`);
        }

        // Determine filename
        let finalFilename = filename;
        if (!finalFilename) {
            const contentDisposition = response.headers['content-disposition'];
            if (contentDisposition) {
                const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (match && match[1]) {
                    finalFilename = match[1].replace(/['"]/g, '');
                }
            }
        }
        if (!finalFilename) {
            const urlPath = new URL(url).pathname;
            const baseName = path.basename(urlPath);
            if (baseName && baseName.includes('.')) {
                finalFilename = baseName;
            } else {
                const ext = response.headers['content-type']?.split('/')[1] || 'bin';
                finalFilename = `downloaded_${Date.now()}.${ext}`;
            }
        }

        // Clean filename
        finalFilename = finalFilename.replace(/[^a-zA-Z0-9\-_. ]/g, '');

        // Generate temp file path
        const tempFilename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${finalFilename}`;
        const tempPath = path.join(DOWNLOAD_CONFIG.tempDir, tempFilename);

        // Write file stream
        const writer = fs.createWriteStream(tempPath);
        let downloadedSize = 0;

        await new Promise((resolve, reject) => {
            response.data.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (downloadedSize > maxSize) {
                    writer.destroy();
                    fs.unlink(tempPath, () => {});
                    reject(new Error(`File exceeded max size: ${maxSize}`));
                }
            });

            response.data.pipe(writer);

            writer.on('finish', resolve);
            writer.on('error', (err) => {
                fs.unlink(tempPath, () => {});
                reject(err);
            });
            response.data.on('error', (err) => {
                fs.unlink(tempPath, () => {});
                reject(err);
            });
        });

        // Calculate hash
        const hash = calculateFileHash(tempPath);

        return {
            success: true,
            path: tempPath,
            filename: finalFilename,
            size: downloadedSize,
            hash: hash,
            mime_type: response.headers['content-type'] || 'application/octet-stream',
            headers: response.headers
        };

    } catch (error) {
        console.error('Download error:', error.message);
        return {
            success: false,
            error: error.message || 'Failed to download file'
        };
    }
}

/**
 * Calculate file hash
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
 * Get file size
 */
function getFileSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch (error) {
        return 0;
    }
}

/**
 * Delete temporary file
 */
function deleteTempFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Delete temp file error:', error);
        return false;
    }
}

/**
 * Clean old temporary files (older than 1 hour)
 */
function cleanTempFiles(maxAge = 3600000) {
    const dir = DOWNLOAD_CONFIG.tempDir;
    if (!fs.existsSync(dir)) return 0;

    let count = 0;
    const now = Date.now();

    try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);
            if (stats.isFile() && (now - stats.mtimeMs) > maxAge) {
                fs.unlinkSync(filePath);
                count++;
            }
        }
    } catch (error) {
        console.error('Clean temp files error:', error);
    }

    return count;
}

// ============================================================
// EXTERNAL API SERVICES
// ============================================================

/**
 * Make external API request
 */
async function externalRequest(options) {
    const {
        url,
        method = 'GET',
        headers = {},
        data = null,
        timeout = 10000,
        maxRedirects = 5
    } = options;

    try {
        const response = await axios({
            method: method,
            url: url,
            headers: {
                'User-Agent': 'A.L.S System/1.0',
                ...headers
            },
            data: data,
            timeout: timeout,
            maxRedirects: maxRedirects,
            validateStatus: function(status) {
                return status >= 200 && status < 300;
            }
        });

        return {
            success: true,
            status: response.status,
            headers: response.headers,
            data: response.data
        };

    } catch (error) {
        console.error('External request error:', error.message);
        return {
            success: false,
            error: error.message,
            status: error.response?.status || 500,
            data: error.response?.data || null
        };
    }
}

/**
 * Validate URL
 */
function isValidUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Extract domain from URL
 */
function extractDomain(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname;
    } catch {
        return null;
    }
}

// ============================================================
// WEBHOOK SERVICES (Optional)
// ============================================================

/**
 * Send webhook notification
 */
async function sendWebhook(url, payload, options = {}) {
    const {
        method = 'POST',
        headers = {},
        timeout = 10000
    } = options;

    try {
        const response = await axios({
            method: method,
            url: url,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            data: payload,
            timeout: timeout
        });

        return {
            success: true,
            status: response.status,
            data: response.data
        };

    } catch (error) {
        console.error('Webhook error:', error.message);
        return {
            success: false,
            error: error.message,
            status: error.response?.status || 500
        };
    }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    // OTP
    generateOTP,
    generateToken,
    sendOTPEmail,
    getEmailStatus,
    
    // Download
    downloadFromUrl,
    deleteTempFile,
    cleanTempFiles,
    calculateFileHash,
    getFileSize,
    
    // External API
    externalRequest,
    isValidUrl,
    extractDomain,
    
    // Webhook
    sendWebhook,
    
    // Config
    EMAIL_CONFIG,
    DOWNLOAD_CONFIG
};
