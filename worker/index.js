/**
 * HIKARI Sushi - Cloudflare Worker API
 * =====================================
 * API endpoints for D1 database operations
 * Optimized for performance with KV caching
 * Cron job runs at 3:00 AM daily to refresh cache
 */

// CORS headers - cached for reuse
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Shared cache headers - aggressive caching for cached data
const cacheHeaders = {
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
};

// Cache keys
const CACHE_KEYS = {
    CONTENT: 'cache:content',
    MENU: 'cache:menu',
    SETTINGS: 'cache:settings',
    LAST_UPDATE: 'cache:last_update'
};

// Helper: JSON response with caching
function jsonResponse(data, status = 200, cache = false) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
            ...(cache ? cacheHeaders : {})
        }
    });
}

// Helper: Error response
function errorResponse(message, status = 400) {
    return jsonResponse({ success: false, error: message }, status);
}

// Helper: Hash password (simple for demo - use bcrypt in production)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'hikari-salt-2024');
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Generate session token
function generateToken() {
    return crypto.randomUUID() + '-' + Date.now();
}

// ===== 2FA TOTP HELPERS =====
// Base32 encoding/decoding for TOTP secrets
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
    let bits = '';
    for (const byte of buffer) {
        bits += byte.toString(2).padStart(8, '0');
    }
    let result = '';
    for (let i = 0; i < bits.length; i += 5) {
        const chunk = bits.slice(i, i + 5).padEnd(5, '0');
        result += BASE32_CHARS[parseInt(chunk, 2)];
    }
    return result;
}

function base32Decode(str) {
    let bits = '';
    for (const char of str.toUpperCase()) {
        const val = BASE32_CHARS.indexOf(char);
        if (val === -1) continue;
        bits += val.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    return new Uint8Array(bytes);
}

// Generate random 2FA secret
function generate2FASecret() {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    return base32Encode(bytes);
}

// HMAC-SHA1 for TOTP
async function hmacSha1(key, message) {
    const cryptoKey = await crypto.subtle.importKey(
        'raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
    return new Uint8Array(signature);
}

// Generate TOTP code
async function generateTOTP(secret, timeStep = 30, digits = 6) {
    const time = Math.floor(Date.now() / 1000 / timeStep);
    const timeBuffer = new ArrayBuffer(8);
    const timeView = new DataView(timeBuffer);
    timeView.setBigUint64(0, BigInt(time));
    
    const key = base32Decode(secret);
    const hmac = await hmacSha1(key, new Uint8Array(timeBuffer));
    
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = (
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)
    ) % Math.pow(10, digits);
    
    return code.toString().padStart(digits, '0');
}

// Verify TOTP code (allows 1 step before/after for clock drift)
async function verifyTOTP(secret, code, window = 1) {
    const timeStep = 30;
    const currentTime = Math.floor(Date.now() / 1000 / timeStep);
    
    for (let i = -window; i <= window; i++) {
        const time = currentTime + i;
        const timeBuffer = new ArrayBuffer(8);
        const timeView = new DataView(timeBuffer);
        timeView.setBigUint64(0, BigInt(time));
        
        const key = base32Decode(secret);
        const hmac = await hmacSha1(key, new Uint8Array(timeBuffer));
        
        const offset = hmac[hmac.length - 1] & 0x0f;
        const generatedCode = (
            ((hmac[offset] & 0x7f) << 24) |
            ((hmac[offset + 1] & 0xff) << 16) |
            ((hmac[offset + 2] & 0xff) << 8) |
            (hmac[offset + 3] & 0xff)
        ) % 1000000;
        
        if (generatedCode.toString().padStart(6, '0') === code) {
            return true;
        }
    }
    return false;
}

// Main request handler
export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        try {
            // ===== AUTH ROUTES =====
            if (path === '/api/auth/login' && method === 'POST') {
                return await handleLogin(request, env);
            }
            if (path === '/api/auth/verify-2fa' && method === 'POST') {
                return await verify2FALogin(request, env);
            }
            if (path === '/api/auth/logout' && method === 'POST') {
                return await handleLogout(request, env);
            }
            if (path === '/api/auth/verify' && method === 'GET') {
                return await verifySession(request, env);
            }
            if (path === '/api/auth/create-admin' && method === 'POST') {
                return await createAdmin(request, env);
            }
            
            // 2FA Setup routes (requires auth)
            if (path === '/api/auth/2fa/setup' && method === 'POST') {
                return await setup2FA(request, env);
            }
            if (path === '/api/auth/2fa/verify' && method === 'POST') {
                return await verify2FASetup(request, env);
            }
            if (path === '/api/auth/2fa/disable' && method === 'POST') {
                return await disable2FA(request, env);
            }
            if (path === '/api/auth/2fa/status' && method === 'GET') {
                return await get2FAStatus(request, env);
            }

            // ===== PUBLIC ROUTES =====
            if (path === '/api/content' && method === 'GET') {
                return await getContent(request, env, true); // Enable caching
            }
            if (path === '/api/menu' && method === 'GET') {
                return await getMenuItems(request, env, true); // Enable caching
            }
            if (path === '/api/gallery' && method === 'GET') {
                return await getGallery(env);
            }
            if (path === '/api/settings' && method === 'GET') {
                return await getSettings(env);
            }
            if (path === '/api/reservations' && method === 'POST') {
                return await createReservation(request, env);
            }
            
            // Serve images from R2 with optional resizing
            // Format: /assets/menu/image.jpg?w=300&h=300&q=85
            if (path.startsWith('/assets/') && method === 'GET') {
                const key = path.replace('/assets/', '');
                const width = parseInt(url.searchParams.get('w')) || null;
                const height = parseInt(url.searchParams.get('h')) || null;
                const quality = parseInt(url.searchParams.get('q')) || 85;
                return await serveImage(env, key, { width, height, quality }, request);
            }

            // Manual cache refresh endpoint (before auth - protected by secret key)
            if (path === '/api/refresh-cache' && method === 'POST') {
                const { secret } = await request.json().catch(() => ({}));
                if (secret !== 'hikari-cache-2024') {
                    return errorResponse('Invalid secret', 403);
                }
                return await refreshAllCache(env);
            }

            // ===== PROTECTED ADMIN ROUTES =====
            const authResult = await checkAuth(request, env);
            if (!authResult.valid) {
                return errorResponse('Unauthorized', 401);
            }

            // Content Management
            if (path === '/api/admin/content' && method === 'GET') {
                return await getAllContent(env);
            }
            if (path === '/api/admin/content' && method === 'PUT') {
                return await updateContent(request, env);
            }

            // Menu Management
            if (path === '/api/admin/menu' && method === 'GET') {
                return await getMenuItems(request, env);
            }
            if (path === '/api/admin/menu' && method === 'POST') {
                return await createMenuItem(request, env);
            }
            if (path.startsWith('/api/admin/menu/') && method === 'PUT') {
                const id = path.split('/').pop();
                return await updateMenuItem(request, env, id);
            }
            if (path.startsWith('/api/admin/menu/') && method === 'DELETE') {
                const id = path.split('/').pop();
                return await deleteMenuItem(env, id);
            }

            // Reservations Management
            if (path === '/api/admin/reservations' && method === 'GET') {
                return await getAllReservations(request, env);
            }
            if (path.startsWith('/api/admin/reservations/') && method === 'PUT') {
                const id = path.split('/').pop();
                return await updateReservation(request, env, id);
            }
            if (path.startsWith('/api/admin/reservations/') && method === 'DELETE') {
                const id = path.split('/').pop();
                return await deleteReservation(env, id);
            }

            // Gallery Management
            if (path === '/api/admin/gallery' && method === 'POST') {
                return await createGalleryItem(request, env);
            }
            if (path.startsWith('/api/admin/gallery/') && method === 'DELETE') {
                const id = path.split('/').pop();
                return await deleteGalleryItem(env, id);
            }

            // Settings Management
            if (path === '/api/admin/settings' && method === 'PUT') {
                return await updateSettings(request, env);
            }

            // Stats
            if (path === '/api/admin/stats' && method === 'GET') {
                return await getStats(env);
            }

            // Image Upload to R2
            if (path === '/api/admin/upload' && method === 'POST') {
                return await uploadImage(request, env);
            }

            // Delete image from R2
            if (path.startsWith('/api/admin/upload/') && method === 'DELETE') {
                const key = path.replace('/api/admin/upload/', '');
                return await deleteImage(env, key);
            }
            
            // Migration: Generate thumbnails for existing images
            if (path === '/api/admin/migrate-thumbnails' && method === 'POST') {
                return await migrateThumbnails(env);
            }

            return errorResponse('Not found', 404);

        } catch (error) {
            console.error('API Error:', error);
            return errorResponse('Internal server error: ' + error.message, 500);
        }
    },

    // ===== SCHEDULED (CRON) HANDLER =====
    // Runs at 3:00 AM daily (configured in wrangler.json)
    async scheduled(event, env, ctx) {
        console.log('🕐 Cron job started at:', new Date().toISOString());
        
        try {
            // Refresh all KV cache
            const result = await refreshCacheInternal(env);
            console.log('✅ KV Cache refreshed successfully');
            
            // Warm CDN cache for images
            await warmImageCache(env, result.menu, result.content);
            console.log('✅ Image CDN cache warmed');
        } catch (error) {
            console.error('❌ Cache refresh failed:', error);
        }
    }
};

// ===== CACHE FUNCTIONS =====

// Warm CDN cache by fetching all images
async function warmImageCache(env, menuItems, content) {
    const imageUrls = new Set();
    const baseUrl = 'https://hikari-sushi-api.nguyenphuockhai1234123.workers.dev';
    
    // Collect menu item images
    menuItems.forEach(item => {
        if (item.image && item.image.includes('/assets/')) {
            imageUrls.add(item.image);
        }
    });
    
    // Collect content images (gallery, about, etc.)
    Object.values(content).forEach(section => {
        if (typeof section === 'object') {
            Object.values(section).forEach(value => {
                if (typeof value === 'string' && value.includes('/assets/')) {
                    imageUrls.add(value);
                }
            });
        }
    });
    
    console.log(`🖼️ Warming cache for ${imageUrls.size} images...`);
    
    // Fetch all images in parallel (max 10 concurrent)
    const urlArray = Array.from(imageUrls);
    const batchSize = 10;
    
    for (let i = 0; i < urlArray.length; i += batchSize) {
        const batch = urlArray.slice(i, i + batchSize);
        await Promise.allSettled(
            batch.map(url => {
                const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
                return fetch(fullUrl, { 
                    method: 'GET',
                    cf: { cacheTtl: 86400, cacheEverything: true }
                });
            })
        );
    }
    
    return imageUrls.size;
}

async function refreshCacheInternal(env) {
    // 1. Cache all content
    const contentResult = await env.hikari_db.prepare('SELECT * FROM site_content').all();
    const content = {};
    contentResult.results.forEach(row => {
        if (!content[row.section]) content[row.section] = {};
        content[row.section][row.key] = row.type === 'json' ? JSON.parse(row.value) : row.value;
    });
    await env.hikari_cache.put(CACHE_KEYS.CONTENT, JSON.stringify(content), { expirationTtl: 86400 }); // 24h

    // 2. Cache menu items
    const menuResult = await env.hikari_db.prepare(
        'SELECT * FROM menu_items WHERE is_active = 1 ORDER BY category, display_order'
    ).all();
    await env.hikari_cache.put(CACHE_KEYS.MENU, JSON.stringify(menuResult.results), { expirationTtl: 86400 });

    // 3. Cache settings
    const settingsResult = await env.hikari_db.prepare('SELECT * FROM settings').all();
    const settings = {};
    settingsResult.results.forEach(row => {
        settings[row.key] = row.type === 'json' ? JSON.parse(row.value) : row.value;
    });
    await env.hikari_cache.put(CACHE_KEYS.SETTINGS, JSON.stringify(settings), { expirationTtl: 86400 });

    // 4. Save last update timestamp
    await env.hikari_cache.put(CACHE_KEYS.LAST_UPDATE, new Date().toISOString());

    return { content, menu: menuResult.results, settings };
}

async function refreshAllCache(env) {
    try {
        const result = await refreshCacheInternal(env);
        
        // Also warm image CDN cache
        const imageCount = await warmImageCache(env, result.menu, result.content);
        
        return jsonResponse({ 
            success: true, 
            message: 'Cache refreshed',
            lastUpdate: await env.hikari_cache.get(CACHE_KEYS.LAST_UPDATE),
            stats: {
                contentSections: Object.keys(result.content).length,
                menuItems: result.menu.length,
                settingsKeys: Object.keys(result.settings).length,
                imagesWarmed: imageCount
            }
        });
    } catch (error) {
        return errorResponse('Cache refresh failed: ' + error.message, 500);
    }
}

// ===== AUTH HANDLERS =====

async function handleLogin(request, env) {
    const { email, password } = await request.json();
    
    if (!email || !password) {
        return errorResponse('Email and password required');
    }

    const passwordHash = await hashPassword(password);
    
    const user = await env.hikari_db.prepare(
        'SELECT * FROM admin_users WHERE email = ? AND password_hash = ?'
    ).bind(email, passwordHash).first();

    if (!user) {
        return errorResponse('Invalid credentials', 401);
    }

    // Check if 2FA is enabled
    if (user.totp_secret && user.totp_enabled) {
        // Return a temporary token for 2FA verification
        const tempToken = 'pending-2fa-' + generateToken();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes
        
        await env.hikari_db.prepare(
            'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
        ).bind(user.id, tempToken, expiresAt).run();
        
        return jsonResponse({
            success: true,
            requires2FA: true,
            tempToken,
            message: 'Please enter your 2FA code'
        });
    }

    // No 2FA - create full session
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    await env.hikari_db.prepare(
        'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(user.id, token, expiresAt).run();

    // Update last login
    await env.hikari_db.prepare(
        'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(user.id).run();

    return jsonResponse({
        success: true,
        token,
        user: { id: user.id, email: user.email, name: user.name }
    });
}

// Verify 2FA code during login
async function verify2FALogin(request, env) {
    const { tempToken, code } = await request.json();
    
    if (!tempToken || !code) {
        return errorResponse('Token and code required');
    }
    
    // Verify temp token is valid pending-2fa token
    if (!tempToken.startsWith('pending-2fa-')) {
        return errorResponse('Invalid token', 401);
    }
    
    const session = await env.hikari_db.prepare(`
        SELECT s.*, u.id as user_id, u.email, u.name, u.totp_secret
        FROM sessions s 
        JOIN admin_users u ON s.user_id = u.id 
        WHERE s.token = ? AND s.expires_at > datetime('now')
    `).bind(tempToken).first();
    
    if (!session) {
        return errorResponse('Session expired, please login again', 401);
    }
    
    // Verify TOTP code
    const isValid = await verifyTOTP(session.totp_secret, code);
    if (!isValid) {
        return errorResponse('Invalid 2FA code', 401);
    }
    
    // Delete temp session
    await env.hikari_db.prepare('DELETE FROM sessions WHERE token = ?').bind(tempToken).run();
    
    // Create full session
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    await env.hikari_db.prepare(
        'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(session.user_id, token, expiresAt).run();
    
    // Update last login
    await env.hikari_db.prepare(
        'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(session.user_id).run();
    
    return jsonResponse({
        success: true,
        token,
        user: { id: session.user_id, email: session.email, name: session.name }
    });
}

async function handleLogout(request, env) {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (token) {
        await env.hikari_db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    }

    return jsonResponse({ success: true });
}

async function verifySession(request, env) {
    const result = await checkAuth(request, env);
    return jsonResponse({ valid: result.valid, user: result.user || null });
}

async function checkAuth(request, env) {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
        return { valid: false };
    }

    const session = await env.hikari_db.prepare(`
        SELECT s.*, u.email, u.name 
        FROM sessions s 
        JOIN admin_users u ON s.user_id = u.id 
        WHERE s.token = ? AND s.expires_at > datetime('now')
    `).bind(token).first();

    if (!session) {
        return { valid: false };
    }

    return { 
        valid: true, 
        user: { id: session.user_id, email: session.email, name: session.name }
    };
}

async function createAdmin(request, env) {
    const { email, password, name, secret } = await request.json();
    
    // Simple secret key protection for creating admin
    if (secret !== 'hikari-admin-2024') {
        return errorResponse('Invalid secret', 403);
    }

    if (!email || !password) {
        return errorResponse('Email and password required');
    }

    const passwordHash = await hashPassword(password);

    try {
        await env.hikari_db.prepare(
            'INSERT INTO admin_users (email, password_hash, name) VALUES (?, ?, ?)'
        ).bind(email, passwordHash, name || 'Admin').run();

        return jsonResponse({ success: true, message: 'Admin created' });
    } catch (e) {
        return errorResponse('Email already exists', 400);
    }
}

// ===== 2FA SETUP HANDLERS =====

// Get 2FA status for current user
async function get2FAStatus(request, env) {
    const auth = await checkAuth(request, env);
    if (!auth.valid) {
        return errorResponse('Unauthorized', 401);
    }
    
    const user = await env.hikari_db.prepare(
        'SELECT totp_enabled FROM admin_users WHERE id = ?'
    ).bind(auth.user.id).first();
    
    return jsonResponse({
        success: true,
        enabled: user?.totp_enabled === 1
    });
}

// Start 2FA setup - generate secret and QR data
async function setup2FA(request, env) {
    const auth = await checkAuth(request, env);
    if (!auth.valid) {
        return errorResponse('Unauthorized', 401);
    }
    
    // Generate new secret
    const secret = generate2FASecret();
    
    // Store pending secret (not enabled yet)
    await env.hikari_db.prepare(
        'UPDATE admin_users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?'
    ).bind(secret, auth.user.id).run();
    
    // Generate otpauth URL for QR code
    const otpauthUrl = `otpauth://totp/HIKARI:${encodeURIComponent(auth.user.email)}?secret=${secret}&issuer=HIKARI&algorithm=SHA1&digits=6&period=30`;
    
    return jsonResponse({
        success: true,
        secret,
        otpauthUrl,
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`
    });
}

// Verify 2FA setup with a code from authenticator app
async function verify2FASetup(request, env) {
    const auth = await checkAuth(request, env);
    if (!auth.valid) {
        return errorResponse('Unauthorized', 401);
    }
    
    const { code } = await request.json();
    if (!code) {
        return errorResponse('Code required');
    }
    
    // Get user's pending secret
    const user = await env.hikari_db.prepare(
        'SELECT totp_secret FROM admin_users WHERE id = ?'
    ).bind(auth.user.id).first();
    
    if (!user?.totp_secret) {
        return errorResponse('Please start 2FA setup first');
    }
    
    // Verify code
    const isValid = await verifyTOTP(user.totp_secret, code);
    if (!isValid) {
        return errorResponse('Invalid code. Please try again.');
    }
    
    // Enable 2FA
    await env.hikari_db.prepare(
        'UPDATE admin_users SET totp_enabled = 1 WHERE id = ?'
    ).bind(auth.user.id).run();
    
    return jsonResponse({
        success: true,
        message: '2FA enabled successfully'
    });
}

// Disable 2FA
async function disable2FA(request, env) {
    const auth = await checkAuth(request, env);
    if (!auth.valid) {
        return errorResponse('Unauthorized', 401);
    }
    
    const { code, password } = await request.json();
    
    // Require password verification
    if (!password) {
        return errorResponse('Password required');
    }
    
    const passwordHash = await hashPassword(password);
    const user = await env.hikari_db.prepare(
        'SELECT * FROM admin_users WHERE id = ? AND password_hash = ?'
    ).bind(auth.user.id, passwordHash).first();
    
    if (!user) {
        return errorResponse('Invalid password');
    }
    
    // If 2FA is enabled, also require current 2FA code
    if (user.totp_enabled && user.totp_secret) {
        if (!code) {
            return errorResponse('2FA code required');
        }
        const isValid = await verifyTOTP(user.totp_secret, code);
        if (!isValid) {
            return errorResponse('Invalid 2FA code');
        }
    }
    
    // Disable 2FA
    await env.hikari_db.prepare(
        'UPDATE admin_users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?'
    ).bind(auth.user.id).run();
    
    return jsonResponse({
        success: true,
        message: '2FA disabled'
    });
}

// ===== CONTENT HANDLERS =====

async function getContent(request, env, useCache = false) {
    const url = new URL(request.url);
    const section = url.searchParams.get('section');
    
    // Try to get from KV cache first (for public requests)
    if (useCache && !section) {
        try {
            const cached = await env.hikari_cache.get(CACHE_KEYS.CONTENT);
            if (cached) {
                console.log('📦 Serving content from cache');
                return jsonResponse({ success: true, content: JSON.parse(cached), cached: true }, 200, true);
            }
        } catch (e) {
            console.log('Cache miss, falling back to D1');
        }
    }
    
    let query = 'SELECT * FROM site_content';
    let params = [];
    
    if (section) {
        query += ' WHERE section = ?';
        params.push(section);
    }

    const result = await env.hikari_db.prepare(query).bind(...params).all();
    
    // Convert to object format
    const content = {};
    result.results.forEach(row => {
        if (!content[row.section]) content[row.section] = {};
        content[row.section][row.key] = row.type === 'json' ? JSON.parse(row.value) : row.value;
    });

    return jsonResponse({ success: true, content }, 200, useCache);
}

async function getAllContent(env) {
    const result = await env.hikari_db.prepare('SELECT * FROM site_content ORDER BY section, key').all();
    return jsonResponse({ success: true, items: result.results });
}

async function updateContent(request, env) {
    const { section, key, value, type } = await request.json();
    
    await env.hikari_db.prepare(`
        INSERT INTO site_content (section, key, value, type, updated_at) 
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(section, key) DO UPDATE SET 
        value = excluded.value, 
        type = excluded.type,
        updated_at = CURRENT_TIMESTAMP
    `).bind(section, key, value, type || 'text').run();

    // Invalidate content cache after update
    await env.hikari_cache.delete(CACHE_KEYS.CONTENT);
    console.log('🗑️ Content cache invalidated');

    return jsonResponse({ success: true });
}

// ===== MENU HANDLERS =====

async function getMenuItems(request, env, useCache = false) {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    
    // Try to get from KV cache first (for public requests without category filter)
    if (useCache && (!category || category === 'all')) {
        try {
            const cached = await env.hikari_cache.get(CACHE_KEYS.MENU);
            if (cached) {
                console.log('📦 Serving menu from cache');
                return jsonResponse({ success: true, items: JSON.parse(cached), cached: true }, 200, true);
            }
        } catch (e) {
            console.log('Cache miss, falling back to D1');
        }
    }
    
    let query = 'SELECT * FROM menu_items WHERE is_active = 1';
    let params = [];
    
    if (category && category !== 'all') {
        query += ' AND category = ?';
        params.push(category);
    }
    
    query += ' ORDER BY category, display_order';

    const result = await env.hikari_db.prepare(query).bind(...params).all();
    return jsonResponse({ success: true, items: result.results }, 200, useCache);
}

// Helper: Ensure thumbnail column exists
async function ensureThumbnailColumn(env) {
    try {
        // Check if column exists by querying table info
        const tableInfo = await env.hikari_db.prepare("PRAGMA table_info(menu_items)").all();
        const hasThumbCol = tableInfo.results.some(col => col.name === 'thumbnail');
        
        if (!hasThumbCol) {
            await env.hikari_db.prepare('ALTER TABLE menu_items ADD COLUMN thumbnail TEXT').run();
            console.log('📊 Added thumbnail column to menu_items');
        }
        return true;
    } catch (e) {
        console.error('Migration error:', e);
        return false;
    }
}

async function createMenuItem(request, env) {
    const data = await request.json();
    
    // Ensure thumbnail column exists
    await ensureThumbnailColumn(env);
    
    const result = await env.hikari_db.prepare(`
        INSERT INTO menu_items (name, description, price, category, image, thumbnail, badge, display_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        data.name, data.description, data.price, data.category,
        data.image, data.thumbnail || null, data.badge, data.display_order || 0
    ).run();

    // Invalidate menu cache after create
    await env.hikari_cache.delete(CACHE_KEYS.MENU);
    console.log('🗑️ Menu cache invalidated');

    return jsonResponse({ success: true, id: result.meta.last_row_id });
}

async function updateMenuItem(request, env, id) {
    const data = await request.json();
    
    // Ensure thumbnail column exists
    await ensureThumbnailColumn(env);
    
    await env.hikari_db.prepare(`
        UPDATE menu_items SET
        name = ?, description = ?, price = ?, category = ?,
        image = ?, thumbnail = ?, badge = ?, display_order = ?, is_active = ?,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).bind(
        data.name, data.description, data.price, data.category,
        data.image, data.thumbnail || null, data.badge, data.display_order || 0, data.is_active ?? 1, id
    ).run();

    // Invalidate menu cache after update
    await env.hikari_cache.delete(CACHE_KEYS.MENU);
    console.log('🗑️ Menu cache invalidated');

    return jsonResponse({ success: true });
}

async function deleteMenuItem(env, id) {
    await env.hikari_db.prepare('DELETE FROM menu_items WHERE id = ?').bind(id).run();
    
    // Invalidate menu cache after delete
    await env.hikari_cache.delete(CACHE_KEYS.MENU);
    console.log('🗑️ Menu cache invalidated');
    
    return jsonResponse({ success: true });
}

// ===== RESERVATIONS HANDLERS =====

async function createReservation(request, env) {
    const data = await request.json();
    
    const result = await env.hikari_db.prepare(`
        INSERT INTO reservations (name, phone, email, guests, date, time, message)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
        data.name, data.phone, data.email, data.guests,
        data.date, data.time, data.message || ''
    ).run();

    return jsonResponse({ success: true, id: result.meta.last_row_id });
}

async function getAllReservations(request, env) {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const date = url.searchParams.get('date');
    
    let query = 'SELECT * FROM reservations WHERE 1=1';
    let params = [];
    
    if (status && status !== 'all') {
        query += ' AND status = ?';
        params.push(status);
    }
    if (date) {
        query += ' AND date = ?';
        params.push(date);
    }
    
    query += ' ORDER BY created_at DESC';

    const result = await env.hikari_db.prepare(query).bind(...params).all();
    return jsonResponse({ success: true, items: result.results });
}

async function updateReservation(request, env, id) {
    const { status } = await request.json();
    
    await env.hikari_db.prepare(`
        UPDATE reservations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(status, id).run();

    return jsonResponse({ success: true });
}

async function deleteReservation(env, id) {
    await env.hikari_db.prepare('DELETE FROM reservations WHERE id = ?').bind(id).run();
    return jsonResponse({ success: true });
}

// ===== GALLERY HANDLERS =====

async function getGallery(env) {
    const result = await env.hikari_db.prepare(
        'SELECT * FROM gallery WHERE is_active = 1 ORDER BY display_order'
    ).all();
    return jsonResponse({ success: true, items: result.results });
}

async function createGalleryItem(request, env) {
    const data = await request.json();
    
    const result = await env.hikari_db.prepare(`
        INSERT INTO gallery (title, image_url, thumbnail_url, display_order)
        VALUES (?, ?, ?, ?)
    `).bind(data.title, data.image_url, data.thumbnail_url, data.display_order || 0).run();

    return jsonResponse({ success: true, id: result.meta.last_row_id });
}

async function deleteGalleryItem(env, id) {
    await env.hikari_db.prepare('DELETE FROM gallery WHERE id = ?').bind(id).run();
    return jsonResponse({ success: true });
}

// ===== SETTINGS HANDLERS =====

async function getSettings(env, useCache = true) {
    // Try to get from KV cache first
    if (useCache) {
        try {
            const cached = await env.hikari_cache.get(CACHE_KEYS.SETTINGS);
            if (cached) {
                console.log('📦 Serving settings from cache');
                return jsonResponse({ success: true, settings: JSON.parse(cached), cached: true });
            }
        } catch (e) {
            console.log('Cache miss, falling back to D1');
        }
    }
    
    const result = await env.hikari_db.prepare('SELECT * FROM settings').all();
    
    const settings = {};
    result.results.forEach(row => {
        settings[row.key] = row.type === 'json' ? JSON.parse(row.value) : row.value;
    });

    return jsonResponse({ success: true, settings });
}

async function updateSettings(request, env) {
    const data = await request.json();
    
    for (const [key, value] of Object.entries(data)) {
        await env.hikari_db.prepare(`
            INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `).bind(key, typeof value === 'object' ? JSON.stringify(value) : value).run();
    }

    // Invalidate settings cache after update
    await env.hikari_cache.delete(CACHE_KEYS.SETTINGS);
    console.log('🗑️ Settings cache invalidated');

    return jsonResponse({ success: true });
}

// ===== STATS HANDLER =====

async function getStats(env) {
    const menuCount = await env.hikari_db.prepare('SELECT COUNT(*) as count FROM menu_items WHERE is_active = 1').first();
    const totalRes = await env.hikari_db.prepare('SELECT COUNT(*) as count FROM reservations').first();
    const pendingRes = await env.hikari_db.prepare("SELECT COUNT(*) as count FROM reservations WHERE status = 'pending'").first();
    const todayRes = await env.hikari_db.prepare("SELECT COUNT(*) as count FROM reservations WHERE date = date('now')").first();

    return jsonResponse({
        success: true,
        stats: {
            totalMenuItems: menuCount.count,
            totalReservations: totalRes.count,
            pendingReservations: pendingRes.count,
            todayReservations: todayRes.count
        }
    });
}

// ===== R2 IMAGE UPLOAD HANDLER =====

async function uploadImage(request, env) {
    try {
        const contentType = request.headers.get('Content-Type') || '';
        
        let imageData, mimeType, fileName, thumbnailData;
        let isMenuImage = false;
        
        if (contentType.includes('application/json')) {
            // Handle base64 upload
            const { image, filename, type, thumbnail } = await request.json();
            
            if (!image) {
                return errorResponse('No image provided');
            }
            
            isMenuImage = type === 'menu';
            
            // Parse main image base64
            const matches = image.match(/^data:(.+);base64,(.+)$/);
            if (!matches) {
                return errorResponse('Invalid image format');
            }
            
            mimeType = matches[1];
            const base64Data = matches[2];
            imageData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            fileName = filename || `image-${Date.now()}`;
            
            // Parse thumbnail if provided
            if (thumbnail) {
                const thumbMatches = thumbnail.match(/^data:(.+);base64,(.+)$/);
                if (thumbMatches) {
                    thumbnailData = Uint8Array.from(atob(thumbMatches[2]), c => c.charCodeAt(0));
                }
            }
        } else if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            const file = formData.get('image');
            const type = formData.get('type');
            const thumbFile = formData.get('thumbnail');
            
            if (!file) {
                return errorResponse('No image provided');
            }
            
            isMenuImage = type === 'menu';
            imageData = new Uint8Array(await file.arrayBuffer());
            mimeType = file.type;
            fileName = file.name || `image-${Date.now()}`;
            
            if (thumbFile) {
                thumbnailData = new Uint8Array(await thumbFile.arrayBuffer());
            }
        } else {
            return errorResponse('Unsupported content type');
        }
        
        // Generate unique key
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const key = `menu/${timestamp}-${random}.webp`;
        
        let thumbnailKey = null;
        let thumbnailUrl = null;
        
        // Upload main image
        await env.hikari_assets.put(key, imageData, {
            httpMetadata: { contentType: 'image/webp' }
        });
        
        // Upload thumbnail if provided (save to menu-thumbnails folder)
        if (thumbnailData && isMenuImage) {
            thumbnailKey = `menu-thumbnails/${timestamp}-${random}.webp`;
            await env.hikari_assets.put(thumbnailKey, thumbnailData, {
                httpMetadata: { contentType: 'image/webp' }
            });
            thumbnailUrl = `https://hikari-sushi-api.nguyenphuockhai1234123.workers.dev/assets/${thumbnailKey}`;
            console.log(`📷 Thumbnail uploaded: ${thumbnailKey} (${Math.round(thumbnailData.byteLength / 1024)}KB)`);
        }
        
        const publicUrl = `https://hikari-sushi-api.nguyenphuockhai1234123.workers.dev/assets/${key}`;
        
        console.log(`🖼️ Image uploaded: ${key} (${Math.round(imageData.byteLength / 1024)}KB)`);
        
        return jsonResponse({
            success: true,
            url: publicUrl,
            key: key,
            thumbnail: thumbnailUrl,
            thumbnailKey: thumbnailKey
        });
    } catch (error) {
        console.error('Upload error:', error);
        return errorResponse('Upload failed: ' + error.message, 500);
    }
}

async function deleteImage(env, key) {
    try {
        // Decode the key (in case it's URL encoded)
        const decodedKey = decodeURIComponent(key);
        
        // Delete original image
        await env.hikari_assets.delete(decodedKey);
        
        // Also delete thumbnail if exists (in menu-thumbnails folder)
        const filename = decodedKey.split('/').pop().replace(/\.[^.]+$/, '.webp');
        const thumbKey = `menu-thumbnails/${filename}`;
        try {
            await env.hikari_assets.delete(thumbKey);
            console.log('🗑️ Thumbnail deleted:', thumbKey);
        } catch (e) {
            // Thumbnail might not exist, ignore error
        }
        
        console.log('🗑️ Image deleted:', decodedKey);
        
        return jsonResponse({ success: true });
    } catch (error) {
        console.error('Delete error:', error);
        return errorResponse('Delete failed: ' + error.message, 500);
    }
}

// ===== MIGRATE THUMBNAILS FOR EXISTING IMAGES =====
async function migrateThumbnails(env) {
    try {
        // Ensure thumbnail column exists
        await ensureThumbnailColumn(env);
        
        // Get all menu items with images but no thumbnails
        const items = await env.hikari_db.prepare(`
            SELECT id, name, image FROM menu_items 
            WHERE image IS NOT NULL 
            AND image != '' 
            AND image LIKE '%/assets/%'
            AND (thumbnail IS NULL OR thumbnail = '')
        `).all();
        
        const results = {
            total: items.results.length,
            success: 0,
            failed: 0,
            skipped: 0,
            details: []
        };
        
        for (const item of items.results) {
            try {
                // Extract key from URL
                const match = item.image.match(/\/assets\/(.+)$/);
                if (!match) {
                    results.skipped++;
                    results.details.push({ id: item.id, name: item.name, status: 'skipped', reason: 'Invalid URL' });
                    continue;
                }
                
                const key = match[1];
                
                // Create thumbnail key in menu-thumbnails folder
                const filename = key.split('/').pop().replace(/\.[^.]+$/, '.webp');
                const thumbKey = `menu-thumbnails/${filename}`;
                
                // Check if thumbnail already exists
                const existingThumb = await env.hikari_assets.head(thumbKey);
                
                if (existingThumb) {
                    // Thumbnail exists, just update database
                    const thumbnailUrl = `https://hikari-sushi-api.nguyenphuockhai1234123.workers.dev/assets/${thumbKey}`;
                    await env.hikari_db.prepare('UPDATE menu_items SET thumbnail = ? WHERE id = ?')
                        .bind(thumbnailUrl, item.id).run();
                    results.success++;
                    results.details.push({ id: item.id, name: item.name, status: 'linked', thumbnail: thumbnailUrl });
                    continue;
                }
                
                // Get original image from R2
                const originalImage = await env.hikari_assets.get(key);
                if (!originalImage) {
                    results.skipped++;
                    results.details.push({ id: item.id, name: item.name, status: 'skipped', reason: 'Image not found in R2' });
                    continue;
                }
                
                // Get image data
                const imageData = await originalImage.arrayBuffer();
                const sizeKB = Math.round(imageData.byteLength / 1024);
                
                // Skip small images (< 50KB)
                if (sizeKB < 50) {
                    results.skipped++;
                    results.details.push({ id: item.id, name: item.name, status: 'skipped', reason: `Too small (${sizeKB}KB)` });
                    continue;
                }
                
                // Create a simple resized version as thumbnail
                // Note: This creates a copy with same format but we'll mark it as thumb
                // For proper resize, frontend should re-upload
                await env.hikari_assets.put(thumbKey, imageData, {
                    httpMetadata: { contentType: originalImage.httpMetadata?.contentType || 'image/webp' }
                });
                
                const thumbnailUrl = `https://hikari-sushi-api.nguyenphuockhai1234123.workers.dev/assets/${thumbKey}`;
                
                // Update database
                await env.hikari_db.prepare('UPDATE menu_items SET thumbnail = ? WHERE id = ?')
                    .bind(thumbnailUrl, item.id).run();
                
                results.success++;
                results.details.push({ 
                    id: item.id, 
                    name: item.name, 
                    status: 'created', 
                    thumbnail: thumbnailUrl,
                    originalSize: `${sizeKB}KB`
                });
                
                console.log(`📷 Thumbnail created for ${item.name}: ${thumbKey}`);
                
            } catch (e) {
                results.failed++;
                results.details.push({ id: item.id, name: item.name, status: 'failed', error: e.message });
            }
        }
        
        // Invalidate cache
        await env.hikari_cache.delete(CACHE_KEYS.MENU);
        
        console.log(`✅ Migration complete: ${results.success} success, ${results.failed} failed, ${results.skipped} skipped`);
        
        return jsonResponse({
            success: true,
            message: `Migration complete: ${results.success} thumbnails created/linked`,
            results
        });
        
    } catch (error) {
        console.error('Migration error:', error);
        return errorResponse('Migration failed: ' + error.message, 500);
    }
}

// ===== SERVE IMAGE FROM R2 WITH OPTIONAL RESIZING =====

async function serveImage(env, key, options = {}, request = null) {
    try {
        const { width, height, quality = 85 } = options;
        
        const object = await env.hikari_assets.get(key);
        
        if (!object) {
            // If og-image.jpg not found, generate placeholder or use first menu item image
            if (key === 'og-image.jpg') {
                // Try to get first menu item with image from cache
                try {
                    const cachedMenu = await env.hikari_cache?.get('MENU');
                    if (cachedMenu) {
                        const items = JSON.parse(cachedMenu);
                        const firstWithImage = items.find(item => item.image);
                        if (firstWithImage?.image) {
                            // Redirect to first menu item image
                            return Response.redirect(firstWithImage.image, 302);
                        }
                    }
                } catch (e) {}
                
                // Return 1200x630 placeholder SVG for og:image
                const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
                    <rect fill="#1a1a1a" width="1200" height="630"/>
                    <text x="50%" y="45%" fill="#c5a47e" font-family="serif" font-size="72" text-anchor="middle">🍣 HIKARI</text>
                    <text x="50%" y="60%" fill="#e0d5c5" font-family="sans-serif" font-size="32" text-anchor="middle">Sushi &amp; Roll - Toulouse</text>
                </svg>`;
                return new Response(svg, {
                    headers: {
                        'Content-Type': 'image/svg+xml',
                        'Cache-Control': 'public, max-age=86400',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            }
            return new Response('Image not found', { status: 404 });
        }
        
        // If resize requested and Cloudflare Image Resizing is available
        if ((width || height) && request) {
            const contentType = object.httpMetadata?.contentType || 'image/jpeg';
            
            // Only resize JPEG/PNG/WebP images
            if (contentType.match(/image\/(jpeg|jpg|png|webp)/i)) {
                // Build resize options for sharp quality (2x for retina)
                const resizeOptions = {
                    cf: {
                        image: {
                            // Use 2x size for retina displays, max reasonable size
                            width: width ? Math.min(width * 2, 1200) : undefined,
                            height: height ? Math.min(height * 2, 1200) : undefined,
                            fit: 'cover',
                            quality: quality,
                            format: 'webp', // Convert to WebP for better compression
                            metadata: 'none' // Strip metadata to reduce size
                        }
                    }
                };
                
                // Create a new request to fetch resized image through Cloudflare
                const imageUrl = `https://hikari-sushi-api.nguyenphuockhai1234123.workers.dev/assets/${key}`;
                
                try {
                    // Fetch the original image and let Cloudflare resize it
                    const resizedResponse = await fetch(imageUrl, resizeOptions);
                    
                    if (resizedResponse.ok) {
                        const headers = new Headers(resizedResponse.headers);
                        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
                        headers.set('Access-Control-Allow-Origin', '*');
                        headers.set('Vary', 'Accept, Accept-Encoding');
                        headers.set('X-Resized', `${width}x${height}@${quality}`);
                        
                        return new Response(resizedResponse.body, { headers });
                    }
                } catch (e) {
                    console.log('Image resize fallback to original:', e.message);
                }
            }
        }
        
        // Return original image if no resize or resize failed
        const headers = new Headers();
        headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year immutable
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Vary', 'Accept-Encoding');
        
        return new Response(object.body, { headers });
    } catch (error) {
        console.error('Serve image error:', error);
        return new Response('Error serving image', { status: 500 });
    }
}
