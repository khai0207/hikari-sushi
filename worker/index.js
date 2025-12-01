/**
 * HIKARI Sushi - Cloudflare Worker API
 * =====================================
 * API endpoints for D1 database operations
 */

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Helper: JSON response
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
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
            if (path === '/api/auth/logout' && method === 'POST') {
                return await handleLogout(request, env);
            }
            if (path === '/api/auth/verify' && method === 'GET') {
                return await verifySession(request, env);
            }
            if (path === '/api/auth/create-admin' && method === 'POST') {
                return await createAdmin(request, env);
            }

            // ===== PUBLIC ROUTES =====
            if (path === '/api/content' && method === 'GET') {
                return await getContent(request, env);
            }
            if (path === '/api/menu' && method === 'GET') {
                return await getMenuItems(request, env);
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

            return errorResponse('Not found', 404);

        } catch (error) {
            console.error('API Error:', error);
            return errorResponse('Internal server error: ' + error.message, 500);
        }
    }
};

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

    // Create session
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

// ===== CONTENT HANDLERS =====

async function getContent(request, env) {
    const url = new URL(request.url);
    const section = url.searchParams.get('section');
    
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

    return jsonResponse({ success: true, content });
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

    return jsonResponse({ success: true });
}

// ===== MENU HANDLERS =====

async function getMenuItems(request, env) {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    
    let query = 'SELECT * FROM menu_items WHERE is_active = 1';
    let params = [];
    
    if (category && category !== 'all') {
        query += ' AND category = ?';
        params.push(category);
    }
    
    query += ' ORDER BY category, display_order';

    const result = await env.hikari_db.prepare(query).bind(...params).all();
    return jsonResponse({ success: true, items: result.results });
}

async function createMenuItem(request, env) {
    const data = await request.json();
    
    const result = await env.hikari_db.prepare(`
        INSERT INTO menu_items (name, description, price, category, image, badge, display_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
        data.name, data.description, data.price, data.category,
        data.image, data.badge, data.display_order || 0
    ).run();

    return jsonResponse({ success: true, id: result.meta.last_row_id });
}

async function updateMenuItem(request, env, id) {
    const data = await request.json();
    
    await env.hikari_db.prepare(`
        UPDATE menu_items SET
        name = ?, description = ?, price = ?, category = ?,
        image = ?, badge = ?, display_order = ?, is_active = ?,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).bind(
        data.name, data.description, data.price, data.category,
        data.image, data.badge, data.display_order || 0, data.is_active ?? 1, id
    ).run();

    return jsonResponse({ success: true });
}

async function deleteMenuItem(env, id) {
    await env.hikari_db.prepare('DELETE FROM menu_items WHERE id = ?').bind(id).run();
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

async function getSettings(env) {
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
