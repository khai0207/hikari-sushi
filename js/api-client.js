/**
 * HIKARI Sushi - D1 API Client
 * ============================
 * Client-side API for Cloudflare D1 database
 */

const API_BASE = 'https://hikari-sushi-api.nguyenphuockhai1234123.workers.dev';

// Storage for auth token - using sessionStorage so token is cleared on tab close/refresh
const AUTH_KEY = 'hikari_auth_token';

function getToken() {
    return sessionStorage.getItem(AUTH_KEY);
}

function setToken(token) {
    sessionStorage.setItem(AUTH_KEY, token);
}

function removeToken() {
    sessionStorage.removeItem(AUTH_KEY);
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
        
        // Normalize response: items -> data for consistency
        if (data.items && !data.data) {
            data.data = data.items;
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
            
            // Check if 2FA is required
            if (data.success && data.requires2FA) {
                return { 
                    success: true, 
                    requires2FA: true, 
                    tempToken: data.tempToken 
                };
            }
            
            if (data.success && data.token) {
                setToken(data.token);
                return { success: true, user: data.user };
            }
            return { success: false, error: data.error || 'Login failed' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    async verify2FA(tempToken, code) {
        try {
            const data = await apiRequest('/api/auth/verify-2fa', {
                method: 'POST',
                body: JSON.stringify({ tempToken, code })
            });
            
            if (data.success && data.token) {
                setToken(data.token);
                return { success: true, user: data.user };
            }
            return { success: false, error: data.error || 'Verification failed' };
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
            console.log('Verify result:', data);
            return data;
        } catch (error) {
            console.error('Verify error:', error);
            return { valid: false };
        }
    },

    isLoggedIn() {
        return !!getToken();
    },

    async protectPage() {
        const token = getToken();
        
        // No token at all
        if (!token) {
            console.log('No token found, redirecting to login');
            window.location.href = 'login.html';
            return false;
        }
        
        // Skip verification for pending-2fa tokens (shouldn't be stored, but just in case)
        if (token.startsWith('pending-2fa-')) {
            console.log('Pending 2FA token found, clearing and redirecting');
            removeToken();
            window.location.href = 'login.html';
            return false;
        }
        
        try {
            const result = await this.verify();
            console.log('Session verification:', result);
            
            if (!result.valid) {
                console.log('Session invalid, clearing token');
                removeToken();
                window.location.href = 'login.html';
                return false;
            }
            return true;
        } catch (error) {
            console.error('Session verification failed:', error);
            // Don't logout on network errors, just return true to allow page access
            // This prevents logout on temporary network issues
            return true;
        }
    },
    
    // 2FA Methods
    async get2FAStatus() {
        try {
            const data = await apiRequest('/api/auth/2fa/status');
            return data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    async setup2FA() {
        try {
            const data = await apiRequest('/api/auth/2fa/setup', { method: 'POST' });
            return data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    async verify2FASetup(code) {
        try {
            const data = await apiRequest('/api/auth/2fa/verify', {
                method: 'POST',
                body: JSON.stringify({ code })
            });
            return data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    async disable2FA(password, code) {
        try {
            const data = await apiRequest('/api/auth/2fa/disable', {
                method: 'POST',
                body: JSON.stringify({ password, code })
            });
            return data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};

// ===== CONTENT API =====
const HikariContent = {
    async getAll() {
        const result = await apiRequest('/api/content');
        // Normalize: convert content object to array with section_key format
        if (result.success && result.content) {
            const data = [];
            for (const section in result.content) {
                const sectionData = result.content[section];
                if (typeof sectionData === 'object' && sectionData !== null) {
                    for (const key in sectionData) {
                        const value = sectionData[key];
                        // Convert value to string if it's array or object
                        const stringValue = (typeof value === 'object') 
                            ? JSON.stringify(value) 
                            : String(value);
                        
                        // Special handling for gallery - when section == key (e.g., gallery1.gallery1)
                        // use just the section as the key
                        let finalKey;
                        if (section === key || section.startsWith('gallery')) {
                            finalKey = section;
                        } else {
                            finalKey = `${section}_${key}`;
                        }
                        
                        data.push({
                            section,
                            key: finalKey,
                            value: stringValue
                        });
                    }
                }
            }
            result.data = data;
        }
        return result;
    },

    async getBySection(section) {
        return apiRequest(`/api/content?section=${section}`);
    },

    async update(key, value, type = 'text') {
        // Extract section from key (e.g., 'hero_title' -> section='hero', key='title')
        const parts = key.split('_');
        const section = parts[0];
        const actualKey = parts.slice(1).join('_') || key;
        
        return apiRequest('/api/admin/content', {
            method: 'PUT',
            body: JSON.stringify({ section, key: actualKey, value, type })
        });
    },

    async updateDirect(section, key, value, type = 'text') {
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

    async update(id, data) {
        return apiRequest(`/api/admin/reservations/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
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
        const result = await apiRequest('/api/settings');
        // Normalize: settings -> data
        if (result.success && result.settings) {
            result.data = result.settings;
        }
        return result;
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
        const result = await apiRequest('/api/admin/stats');
        // Normalize: stats -> data
        if (result.success && result.stats) {
            result.data = result.stats;
        }
        return result;
    }
};

// ===== UPLOAD API =====

// Image size configurations for different content types
// Only gallery images are resized - others use original quality for better display
const CONTENT_IMAGE_SIZES = {
    'gallery': { width: 600, height: 400, quality: 0.85 },         // Gallery images - small thumbnails
    // The following are NOT resized - upload original quality:
    // 'about', 'about-secondary', 'signature', 'signature-bg', 
    // 'specialty-large', 'specialty', 'reservation', 'reservation-bg'
};

// Resize image on canvas to target dimensions
async function resizeImageToSize(file, targetWidth, targetHeight, quality = 0.85) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        
        reader.onload = (e) => {
            img.onload = () => {
                // Create canvas with target size
                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');
                
                // Calculate scaling to cover (may crop)
                const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
                const scaledWidth = img.width * scale;
                const scaledHeight = img.height * scale;
                
                // Center the image (crop if needed)
                const offsetX = (targetWidth - scaledWidth) / 2;
                const offsetY = (targetHeight - scaledHeight) / 2;
                
                // Enable high quality rendering
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // Draw white background (in case of transparency)
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, targetWidth, targetHeight);
                
                // Draw image
                ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
                
                // Export as WebP
                const resizedBase64 = canvas.toDataURL('image/webp', quality);
                resolve(resizedBase64);
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

// Upload content image - only resize for gallery, others keep original quality
async function uploadContentImage(file, contentType, filename = null) {
    try {
        const token = getToken();
        
        // Get size config for this content type (only gallery has resize config)
        const sizeConfig = CONTENT_IMAGE_SIZES[contentType];
        
        let imageData;
        
        if (sizeConfig) {
            // Resize image to exact display dimensions (only for gallery)
            imageData = await resizeImageToSize(
                file, 
                sizeConfig.width, 
                sizeConfig.height, 
                sizeConfig.quality
            );
        } else {
            // For about, signature, specialty, reservation - upload original quality
            // Just convert to base64 without resize
            imageData = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
        
        // Upload image
        const response = await fetch(`${API_BASE}/api/admin/upload-content`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            body: JSON.stringify({
                image: imageData,
                contentType: contentType,
                filename: filename || file.name
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Upload failed');
        }
        
        return result;
    } catch (error) {
        console.error('Content upload error:', error);
        return {
            success: false,
            error: error.message || 'Upload failed'
        };
    }
}

// Get image size config
function getContentImageSize(contentType) {
    return CONTENT_IMAGE_SIZES[contentType] || null;
}

async function uploadImage(imageData, filename = 'image', type = 'menu', thumbnailData = null) {
    try {
        const token = getToken();
        
        const response = await fetch(`${API_BASE}/api/admin/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            body: JSON.stringify({
                image: imageData,  // base64 data URL
                filename: filename,
                type: type,  // 'menu' for menu items
                thumbnail: thumbnailData  // base64 thumbnail (generated on frontend)
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Upload failed');
        }
        
        // Result includes: url, key, thumbnail, thumbnailKey
        return result;
    } catch (error) {
        console.error('Upload error:', error);
        return {
            success: false,
            error: error.message || 'Upload failed'
        };
    }
}

// Delete image from R2
async function deleteImageFromR2(key) {
    try {
        const token = getToken();
        
        const response = await fetch(`${API_BASE}/api/admin/upload/${encodeURIComponent(key)}`, {
            method: 'DELETE',
            headers: {
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        });
        
        return await response.json();
    } catch (error) {
        console.error('Delete image error:', error);
        return { success: false, error: error.message };
    }
}

// Export main API object with consistent interface
window.HikariAPI = {
    // Auth methods directly on HikariAPI
    login: HikariAuth.login.bind(HikariAuth),
    logout: HikariAuth.logout.bind(HikariAuth),
    isLoggedIn: HikariAuth.isLoggedIn.bind(HikariAuth),
    protectAdminPage: HikariAuth.protectPage.bind(HikariAuth),
    
    // 2FA methods
    verify2FA: HikariAuth.verify2FA.bind(HikariAuth),
    get2FAStatus: HikariAuth.get2FAStatus.bind(HikariAuth),
    setup2FA: HikariAuth.setup2FA.bind(HikariAuth),
    verify2FASetup: HikariAuth.verify2FASetup.bind(HikariAuth),
    disable2FA: HikariAuth.disable2FA.bind(HikariAuth),
    
    getCurrentUser: function() {
        const token = getToken();
        if (!token) return null;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return { email: payload.email, name: payload.name };
        } catch (e) {
            return { email: 'admin@hikari-sushi.fr' };
        }
    },

    // Nested APIs for different resources
    content: HikariContent,
    menu: HikariMenu,
    reservations: HikariReservations,
    gallery: HikariGallery,
    settings: HikariSettings,
    stats: HikariStats,
    
    // Upload functions
    uploadImage: uploadImage,
    uploadContentImage: uploadContentImage,
    getContentImageSize: getContentImageSize,
    CONTENT_IMAGE_SIZES: CONTENT_IMAGE_SIZES,
    deleteImage: deleteImageFromR2
};

// Also export individual modules
window.HikariAuth = HikariAuth;
window.HikariContent = HikariContent;
window.HikariMenu = HikariMenu;
window.HikariReservations = HikariReservations;
window.HikariGallery = HikariGallery;
window.HikariSettings = HikariSettings;
window.HikariStats = HikariStats;
