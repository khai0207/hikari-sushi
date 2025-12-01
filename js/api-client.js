/**
 * HIKARI Sushi - D1 API Client
 * ============================
 * Client-side API for Cloudflare D1 database
 */

const API_BASE = 'https://hikari-sushi-api.nguyenphuockhai1234123.workers.dev';

// Storage for auth token
const AUTH_KEY = 'hikari_auth_token';

function getToken() {
    return localStorage.getItem(AUTH_KEY);
}

function setToken(token) {
    localStorage.setItem(AUTH_KEY, token);
}

function removeToken() {
    localStorage.removeItem(AUTH_KEY);
}

// API request helper
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const token = getToken();
    
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ===== AUTH API =====
const HikariAuth = {
    async login(email, password) {
        try {
            const data = await apiRequest('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            
            if (data.success && data.token) {
                setToken(data.token);
                return { success: true, user: data.user };
            }
            return { success: false, error: data.error || 'Login failed' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async logout() {
        try {
            await apiRequest('/api/auth/logout', { method: 'POST' });
        } catch (e) {
            // Ignore logout errors
        }
        removeToken();
        window.location.href = 'login.html';
    },

    async verify() {
        try {
            const data = await apiRequest('/api/auth/verify');
            return data;
        } catch (error) {
            return { valid: false };
        }
    },

    isLoggedIn() {
        return !!getToken();
    },

    async protectPage() {
        if (!this.isLoggedIn()) {
            window.location.href = 'login.html';
            return false;
        }
        
        const result = await this.verify();
        if (!result.valid) {
            removeToken();
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }
};

// ===== CONTENT API =====
const HikariContent = {
    async getAll() {
        return apiRequest('/api/content');
    },

    async getBySection(section) {
        return apiRequest(`/api/content?section=${section}`);
    },

    async update(section, key, value, type = 'text') {
        return apiRequest('/api/admin/content', {
            method: 'PUT',
            body: JSON.stringify({ section, key, value, type })
        });
    },

    async getAllAdmin() {
        return apiRequest('/api/admin/content');
    }
};

// ===== MENU API =====
const HikariMenu = {
    async getAll(category = null) {
        const params = category && category !== 'all' ? `?category=${category}` : '';
        return apiRequest(`/api/menu${params}`);
    },

    async create(item) {
        return apiRequest('/api/admin/menu', {
            method: 'POST',
            body: JSON.stringify(item)
        });
    },

    async update(id, item) {
        return apiRequest(`/api/admin/menu/${id}`, {
            method: 'PUT',
            body: JSON.stringify(item)
        });
    },

    async delete(id) {
        return apiRequest(`/api/admin/menu/${id}`, {
            method: 'DELETE'
        });
    }
};

// ===== RESERVATIONS API =====
const HikariReservations = {
    async create(data) {
        return apiRequest('/api/reservations', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async getAll(status = null, date = null) {
        let params = [];
        if (status && status !== 'all') params.push(`status=${status}`);
        if (date) params.push(`date=${date}`);
        const query = params.length ? `?${params.join('&')}` : '';
        return apiRequest(`/api/admin/reservations${query}`);
    },

    async updateStatus(id, status) {
        return apiRequest(`/api/admin/reservations/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
    },

    async delete(id) {
        return apiRequest(`/api/admin/reservations/${id}`, {
            method: 'DELETE'
        });
    }
};

// ===== GALLERY API =====
const HikariGallery = {
    async getAll() {
        return apiRequest('/api/gallery');
    },

    async create(item) {
        return apiRequest('/api/admin/gallery', {
            method: 'POST',
            body: JSON.stringify(item)
        });
    },

    async delete(id) {
        return apiRequest(`/api/admin/gallery/${id}`, {
            method: 'DELETE'
        });
    }
};

// ===== SETTINGS API =====
const HikariSettings = {
    async get() {
        return apiRequest('/api/settings');
    },

    async update(settings) {
        return apiRequest('/api/admin/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
    }
};

// ===== STATS API =====
const HikariStats = {
    async get() {
        return apiRequest('/api/admin/stats');
    }
};

// Export all APIs
window.HikariAPI = {
    Auth: HikariAuth,
    Content: HikariContent,
    Menu: HikariMenu,
    Reservations: HikariReservations,
    Gallery: HikariGallery,
    Settings: HikariSettings,
    Stats: HikariStats
};

// Also export individual for convenience
window.HikariAuth = HikariAuth;
window.HikariContent = HikariContent;
window.HikariMenu = HikariMenu;
window.HikariReservations = HikariReservations;
window.HikariGallery = HikariGallery;
window.HikariSettings = HikariSettings;
window.HikariStats = HikariStats;
