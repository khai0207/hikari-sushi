/**
 * HIKARI Sushi - Firebase Configuration
 * =====================================
 * 
 * HƯỚNG DẪN SETUP FIREBASE:
 * 
 * 1. Vào https://console.firebase.google.com/
 * 2. Tạo project mới tên "hikari-sushi"
 * 3. Vào Project Settings > General > Your apps > Web app
 * 4. Đăng ký app và copy firebaseConfig vào đây
 * 5. Vào Authentication > Sign-in method > Enable Email/Password
 * 6. Vào Firestore Database > Create database > Start in test mode
 * 7. Vào Storage > Get started > Start in test mode
 */

// ⚠️ THAY THẾ CẤU HÌNH NÀY BẰNG CẤU HÌNH FIREBASE CỦA BẠN
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ===== AUTHENTICATION FUNCTIONS =====

/**
 * Đăng nhập admin
 */
async function loginAdmin(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: getErrorMessage(error.code) };
    }
}

/**
 * Đăng xuất
 */
async function logoutAdmin() {
    try {
        await auth.signOut();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

/**
 * Kiểm tra trạng thái đăng nhập
 */
function checkAuthState(callback) {
    auth.onAuthStateChanged(callback);
}

/**
 * Bảo vệ trang admin
 */
function protectAdminPage() {
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'login.html';
        }
    });
}

// ===== MENU FUNCTIONS =====

/**
 * Lấy tất cả món ăn
 */
async function getAllMenuItems() {
    try {
        const snapshot = await db.collection('menu').orderBy('category').orderBy('order').get();
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return { success: true, items: items };
    } catch (error) {
        console.error('Error getting menu:', error);
        return { success: false, items: [], error: error.message };
    }
}

/**
 * Lấy món ăn theo category
 */
async function getMenuByCategory(category) {
    try {
        const snapshot = await db.collection('menu')
            .where('category', '==', category)
            .orderBy('order')
            .get();
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return { success: true, items: items };
    } catch (error) {
        console.error('Error getting menu by category:', error);
        return { success: false, items: [], error: error.message };
    }
}

/**
 * Thêm món ăn mới
 */
async function addMenuItem(item) {
    try {
        const docRef = await db.collection('menu').add({
            ...item,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error adding menu item:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Cập nhật món ăn
 */
async function updateMenuItem(id, data) {
    try {
        await db.collection('menu').doc(id).update({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating menu item:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Xóa món ăn
 */
async function deleteMenuItem(id) {
    try {
        await db.collection('menu').doc(id).delete();
        return { success: true };
    } catch (error) {
        console.error('Error deleting menu item:', error);
        return { success: false, error: error.message };
    }
}

// ===== RESERVATION FUNCTIONS =====

/**
 * Lấy tất cả đơn đặt bàn
 */
async function getAllReservations() {
    try {
        const snapshot = await db.collection('reservations')
            .orderBy('createdAt', 'desc')
            .get();
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return { success: true, items: items };
    } catch (error) {
        console.error('Error getting reservations:', error);
        return { success: false, items: [], error: error.message };
    }
}

/**
 * Lấy đơn đặt bàn theo ngày
 */
async function getReservationsByDate(date) {
    try {
        const snapshot = await db.collection('reservations')
            .where('date', '==', date)
            .orderBy('time')
            .get();
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return { success: true, items: items };
    } catch (error) {
        console.error('Error getting reservations by date:', error);
        return { success: false, items: [], error: error.message };
    }
}

/**
 * Thêm đơn đặt bàn mới (từ form khách hàng)
 */
async function addReservation(reservation) {
    try {
        const docRef = await db.collection('reservations').add({
            ...reservation,
            status: 'pending', // pending, confirmed, cancelled
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error adding reservation:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Cập nhật trạng thái đơn đặt bàn
 */
async function updateReservationStatus(id, status) {
    try {
        await db.collection('reservations').doc(id).update({
            status: status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating reservation:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Xóa đơn đặt bàn
 */
async function deleteReservation(id) {
    try {
        await db.collection('reservations').doc(id).delete();
        return { success: true };
    } catch (error) {
        console.error('Error deleting reservation:', error);
        return { success: false, error: error.message };
    }
}

// ===== SETTINGS FUNCTIONS =====

/**
 * Lấy cài đặt website
 */
async function getSettings() {
    try {
        const doc = await db.collection('settings').doc('general').get();
        if (doc.exists) {
            return doc.data();
        }
        return getDefaultSettings();
    } catch (error) {
        console.error('Error getting settings:', error);
        return getDefaultSettings();
    }
}

/**
 * Cập nhật cài đặt
 */
async function updateSettings(settings) {
    try {
        await db.collection('settings').doc('general').set(settings, { merge: true });
        return { success: true };
    } catch (error) {
        console.error('Error updating settings:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Cài đặt mặc định
 */
function getDefaultSettings() {
    return {
        restaurantName: 'HIKARI Sushi & Roll',
        phone: '05 61 55 50 77',
        email: 'hikari.sushi31@gmail.com',
        address: '17 allée des Soupirs, 31000 Toulouse',
        openingHours: {
            monday: { lunch: 'Fermé', dinner: '19h - 22h' },
            tuesday: { lunch: '12h - 14h30', dinner: '19h - 22h' },
            wednesday: { lunch: '12h - 14h30', dinner: '19h - 22h' },
            thursday: { lunch: '12h - 14h30', dinner: '19h - 22h' },
            friday: { lunch: '12h - 14h30', dinner: '19h - 22h' },
            saturday: { lunch: '12h - 14h30', dinner: '19h - 22h' },
            sunday: { lunch: '12h - 14h30', dinner: '19h - 22h' }
        }
    };
}

// ===== IMAGE UPLOAD FUNCTIONS =====

/**
 * Upload hình ảnh
 */
async function uploadImage(file, folder = 'menu') {
    try {
        const fileName = `${folder}/${Date.now()}_${file.name}`;
        const storageRef = storage.ref(fileName);
        
        const snapshot = await storageRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        
        return { success: true, url: downloadURL, path: fileName };
    } catch (error) {
        console.error('Error uploading image:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Xóa hình ảnh
 */
async function deleteImage(path) {
    try {
        const storageRef = storage.ref(path);
        await storageRef.delete();
        return { success: true };
    } catch (error) {
        console.error('Error deleting image:', error);
        return { success: false, error: error.message };
    }
}

// ===== STATISTICS FUNCTIONS =====

/**
 * Lấy thống kê dashboard
 */
async function getDashboardStats() {
    try {
        const [menuSnapshot, reservationsSnapshot] = await Promise.all([
            db.collection('menu').get(),
            db.collection('reservations').get()
        ]);
        
        const reservations = reservationsSnapshot.docs.map(doc => doc.data());
        const today = new Date().toISOString().split('T')[0];
        
        return {
            totalMenuItems: menuSnapshot.size,
            totalReservations: reservationsSnapshot.size,
            pendingReservations: reservations.filter(r => r.status === 'pending').length,
            todayReservations: reservations.filter(r => r.date === today).length
        };
    } catch (error) {
        console.error('Error getting stats:', error);
        return {
            totalMenuItems: 0,
            totalReservations: 0,
            pendingReservations: 0,
            todayReservations: 0
        };
    }
}

// ===== HELPER FUNCTIONS =====

/**
 * Chuyển đổi mã lỗi Firebase thành thông báo tiếng Pháp
 */
function getErrorMessage(errorCode) {
    const messages = {
        'auth/invalid-email': 'Adresse email invalide',
        'auth/user-disabled': 'Ce compte a été désactivé',
        'auth/user-not-found': 'Aucun compte trouvé avec cet email',
        'auth/wrong-password': 'Mot de passe incorrect',
        'auth/too-many-requests': 'Trop de tentatives. Veuillez réessayer plus tard',
        'auth/network-request-failed': 'Erreur de connexion. Vérifiez votre internet'
    };
    return messages[errorCode] || 'Une erreur est survenue';
}

/**
 * Format ngày
 */
function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

/**
 * Format thời gian
 */
function formatDateTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ===== SEED DATA FUNCTION =====

/**
 * Khởi tạo dữ liệu mẫu cho menu
 */
async function seedMenuData() {
    const menuItems = [
        // Sushis
        { name: 'Sushi Saumon', description: '2 pièces de sushi au saumon frais, riz vinaigré', price: 6.50, category: 'sushi', image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=300&h=300&fit=crop', badge: 'Populaire', order: 1 },
        { name: 'Sushi Thon', description: '2 pièces de sushi au thon rouge premium', price: 7.00, category: 'sushi', image: 'https://images.unsplash.com/photo-1633478062482-790e3bb4e2c7?w=300&h=300&fit=crop', badge: '', order: 2 },
        { name: 'Sushi Crevette', description: '2 pièces de sushi à la crevette tempura', price: 6.00, category: 'sushi', image: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=300&h=300&fit=crop', badge: 'Nouveau', order: 3 },
        { name: 'Sashimi Mix', description: 'Assortiment de 12 tranches de poisson frais', price: 18.00, category: 'sushi', image: 'https://images.unsplash.com/photo-1534482421-64566f976cfa?w=300&h=300&fit=crop', badge: '', order: 4 },
        { name: 'Chirashi Saumon', description: 'Bol de riz garni de saumon frais et avocat', price: 16.50, category: 'sushi', image: 'https://images.unsplash.com/photo-1559410545-0bdcd187e0a6?w=300&h=300&fit=crop', badge: '', order: 5 },
        { name: 'Sushi Anguille', description: '2 pièces de sushi à l\'anguille grillée', price: 8.50, category: 'sushi', image: 'https://images.unsplash.com/photo-1582450871972-ab5ca641643d?w=300&h=300&fit=crop', badge: '', order: 6 },
        
        // Makis & Rolls
        { name: 'HIKARI Roll', description: '10 pièces - Création exclusive du chef', price: 18.50, category: 'maki', image: 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=300&h=300&fit=crop', badge: 'Signature', order: 1 },
        { name: 'California Saumon', description: '8 pièces au saumon, avocat, cheese', price: 12.00, category: 'maki', image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=300&h=300&fit=crop', badge: '', order: 2 },
        { name: 'Dragon Roll', description: '8 pièces tempura crevette, avocat, anguille', price: 16.00, category: 'maki', image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=300&h=300&fit=crop', badge: 'Nouveau', order: 3 },
        { name: 'Maki Saumon', description: '6 pièces de maki au saumon frais', price: 7.50, category: 'maki', image: 'https://images.unsplash.com/photo-1615361200098-9e630ec29b4e?w=300&h=300&fit=crop', badge: '', order: 4 },
        
        // Plats Chauds
        { name: 'Yakitori Poulet', description: '3 brochettes de poulet grillées sauce teriyaki', price: 8.50, category: 'plats', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=300&h=300&fit=crop', badge: '', order: 1 },
        { name: 'Ramen Tonkotsu', description: 'Bouillon porc, nouilles, œuf, chashu, nori', price: 14.50, category: 'plats', image: 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=300&h=300&fit=crop', badge: 'Populaire', order: 2 },
        { name: 'Tempura Mix', description: 'Assortiment de légumes et crevettes tempura', price: 13.00, category: 'plats', image: 'https://images.unsplash.com/photo-1562967916-eb82221dfb44?w=300&h=300&fit=crop', badge: '', order: 3 },
        { name: 'Gyoza', description: '6 raviolis japonais grillés au porc', price: 9.00, category: 'plats', image: 'https://images.unsplash.com/photo-1580822184713-fc5400e7fe10?w=300&h=300&fit=crop', badge: '', order: 4 },
        
        // Desserts
        { name: 'Mochi Glacé', description: '3 pièces - Matcha, mangue, fraise', price: 6.50, category: 'desserts', image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=300&h=300&fit=crop', badge: '', order: 1 },
        { name: 'Dorayaki', description: 'Pancakes japonais fourrés au haricot rouge', price: 5.50, category: 'desserts', image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=300&h=300&fit=crop', badge: '', order: 2 }
    ];
    
    try {
        const batch = db.batch();
        menuItems.forEach(item => {
            const docRef = db.collection('menu').doc();
            batch.set(docRef, {
                ...item,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
        console.log('Menu data seeded successfully!');
        return { success: true };
    } catch (error) {
        console.error('Error seeding menu data:', error);
        return { success: false, error: error.message };
    }
}

// Export functions for use in other files
window.HikariFirebase = {
    // Auth
    loginAdmin,
    logoutAdmin,
    checkAuthState,
    protectAdminPage,
    
    // Menu
    getAllMenuItems,
    getMenuByCategory,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    
    // Reservations
    getAllReservations,
    getReservationsByDate,
    addReservation,
    updateReservationStatus,
    deleteReservation,
    
    // Settings
    getSettings,
    updateSettings,
    
    // Images
    uploadImage,
    deleteImage,
    
    // Stats
    getDashboardStats,
    
    // Helpers
    formatDate,
    formatDateTime,
    seedMenuData
};
