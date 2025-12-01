-- HIKARI Sushi D1 Database Schema
-- ================================

-- Site Content Table (for all text content)
CREATE TABLE IF NOT EXISTS site_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    type TEXT DEFAULT 'text', -- text, html, image, json
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(section, key)
);

-- Menu Items Table
CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category TEXT NOT NULL,
    image TEXT,
    badge TEXT,
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reservations Table
CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    guests INTEGER NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'pending', -- pending, confirmed, cancelled
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Gallery Images Table
CREATE TABLE IF NOT EXISTS gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings Table
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    type TEXT DEFAULT 'text',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Admin Users Table
CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Sessions Table (for auth)
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES admin_users(id)
);

-- Insert Default Site Content
INSERT OR IGNORE INTO site_content (section, key, value, type) VALUES
-- Hero Section
('hero', 'title', 'Découvrez l''art de la', 'text'),
('hero', 'typed_words', '["cuisine japonaise", "sushis frais", "saveurs uniques", "traditions"]', 'json'),
('hero', 'subtitle', 'Une expérience culinaire authentique au cœur de Toulouse', 'text'),
('hero', 'background_image', 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=1920&h=1080&fit=crop', 'image'),

-- About Section  
('about', 'title', 'Notre Histoire', 'text'),
('about', 'subtitle', 'Une passion pour la cuisine japonaise', 'text'),
('about', 'description', 'Depuis notre ouverture, HIKARI Sushi & Roll s''engage à vous offrir une expérience culinaire japonaise authentique. Notre chef, formé au Japon, sélectionne chaque jour les meilleurs ingrédients pour créer des plats qui respectent la tradition tout en apportant une touche de créativité.', 'html'),
('about', 'image', 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=600&h=400&fit=crop', 'image'),

-- Contact Info
('contact', 'phone', '05 61 55 50 77', 'text'),
('contact', 'email', 'hikari.sushi31@gmail.com', 'text'),
('contact', 'address', '17 allée des Soupirs, 31000 Toulouse', 'text'),
('contact', 'map_embed', '', 'html'),

-- Social Links
('social', 'facebook', '', 'text'),
('social', 'instagram', '', 'text'),
('social', 'tripadvisor', '', 'text'),

-- Opening Hours
('hours', 'monday', '{"lunch": "Fermé", "dinner": "19h - 22h"}', 'json'),
('hours', 'tuesday', '{"lunch": "12h - 14h30", "dinner": "19h - 22h"}', 'json'),
('hours', 'wednesday', '{"lunch": "12h - 14h30", "dinner": "19h - 22h"}', 'json'),
('hours', 'thursday', '{"lunch": "12h - 14h30", "dinner": "19h - 22h"}', 'json'),
('hours', 'friday', '{"lunch": "12h - 14h30", "dinner": "19h - 22h"}', 'json'),
('hours', 'saturday', '{"lunch": "12h - 14h30", "dinner": "19h - 22h"}', 'json'),
('hours', 'sunday', '{"lunch": "12h - 14h30", "dinner": "19h - 22h"}', 'json');

-- Insert Default Settings
INSERT OR IGNORE INTO settings (key, value, type) VALUES
('restaurant_name', 'HIKARI Sushi & Roll', 'text'),
('tagline', 'Restaurant Japonais à Toulouse', 'text'),
('logo_url', 'images/logo.png', 'image'),
('primary_color', '#c9a962', 'text'),
('zenchef_id', '', 'text');

-- Insert Sample Menu Items
INSERT OR IGNORE INTO menu_items (name, description, price, category, image, badge, display_order) VALUES
('Sushi Saumon', '2 pièces de sushi au saumon frais', 6.50, 'sushi', 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=300&h=300&fit=crop', 'Populaire', 1),
('Sushi Thon', '2 pièces de sushi au thon rouge premium', 7.00, 'sushi', 'https://images.unsplash.com/photo-1633478062482-790e3bb4e2c7?w=300&h=300&fit=crop', '', 2),
('California Saumon', '8 pièces au saumon, avocat, cheese', 12.00, 'maki', 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=300&h=300&fit=crop', '', 1),
('Dragon Roll', '8 pièces tempura crevette, avocat, anguille', 16.00, 'maki', 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=300&h=300&fit=crop', 'Nouveau', 2),
('Ramen Tonkotsu', 'Bouillon porc, nouilles, œuf, chashu, nori', 14.50, 'plats', 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=300&h=300&fit=crop', 'Populaire', 1),
('Gyoza', '6 raviolis japonais grillés au porc', 9.00, 'plats', 'https://images.unsplash.com/photo-1580822184713-fc5400e7fe10?w=300&h=300&fit=crop', '', 2),
('Mochi Glacé', '3 pièces - Matcha, mangue, fraise', 6.50, 'desserts', 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=300&h=300&fit=crop', '', 1);

-- Insert Sample Gallery
INSERT OR IGNORE INTO gallery (title, image_url, display_order) VALUES
('Sushi Selection', 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&h=600&fit=crop', 1),
('Maki Rolls', 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&h=600&fit=crop', 2),
('Fresh Sashimi', 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=800&h=600&fit=crop', 3),
('Ramen Bowl', 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=800&h=600&fit=crop', 4),
('Restaurant Interior', 'https://images.unsplash.com/photo-1514190051997-0f6f39ca5cde?w=800&h=600&fit=crop', 5),
('Chef at Work', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&h=600&fit=crop', 6);
