// js/commander.js

let menuItems = [];
let cart = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadMenu();
    setupTabs();
    setupCart();
    setupForm();
});

async function loadMenu() {
    try {
        const result = await window.HikariMenu.getAll();
        if (result.success) {
            menuItems = result.items;
            renderMenu('sushi'); // default tab
        }
    } catch (e) {
        console.error('Error loading menu:', e);
        document.getElementById('commander-menu-content').innerHTML = '<p>Erreur de chargement du menu.</p>';
    }
}

function renderMenu(category) {
    const container = document.getElementById('commander-menu-content');
    const items = menuItems.filter(item => item.category === category);

    if (items.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: var(--text-light);">Aucun produit dans cette catégorie.</p>';
        return;
    }

    let html = '<div class="menu-grid">';
    items.forEach(item => {
        const imageHtml = item.image ? `<img src="${item.image}" alt="${item.name}" loading="lazy">` : `<div style="height:200px; background:#222; display:flex; align-items:center; justify-content:center;">Sans photo</div>`;
        const badgeHtml = item.badge ? `<span class="menu-badge">${item.badge}</span>` : '';

        html += `
            <div class="menu-card" data-aos="fade-up">
                <div class="menu-img">
                    ${imageHtml}
                    ${badgeHtml}
                </div>
                <div class="menu-info">
                    <div class="menu-title-row">
                        <h3 class="menu-title">${item.name}</h3>
                        <span class="menu-price">${parseFloat(item.price).toFixed(2)}€</span>
                    </div>
                    <p class="menu-desc">${item.description || ''}</p>
                    <button class="btn-add-cart" onclick="addToCart(${item.id})">
                        <i class="fas fa-plus"></i> Ajouter au panier
                    </button>
                </div>
            </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;
}

function setupTabs() {
    const tabs = document.querySelectorAll('.commander-menu .tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            renderMenu(e.target.dataset.tab);
        });
    });
}

function addToCart(itemId) {
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return;

    const existing = cart.find(cartItem => cartItem.id === item.id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...item, quantity: 1 });
    }
    updateCartUI();
}

function updateCartQuantity(itemId, change) {
    const index = cart.findIndex(i => i.id === itemId);
    if (index > -1) {
        cart[index].quantity += change;
        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }
        updateCartUI();
    }
}

function updateCartUI() {
    const container = document.getElementById('cart-items');
    const subtotalEl = document.getElementById('cart-subtotal');
    const totalEl = document.getElementById('cart-total');
    const submitBtn = document.getElementById('btn-submit-order');

    if (cart.length === 0) {
        container.innerHTML = '<p style="color: var(--text-light); text-align: center; margin-top: 2rem;">Votre panier est vide</p>';
        subtotalEl.textContent = '0.00€';
        totalEl.textContent = '0.00€';
        submitBtn.disabled = true;
        return;
    }

    let html = '';
    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        html += `
            <div class="cart-item">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-controls">
                    <button type="button" class="qty-btn" onclick="updateCartQuantity(${item.id}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button type="button" class="qty-btn" onclick="updateCartQuantity(${item.id}, 1)">+</button>
                </div>
                <div class="cart-item-price">${itemTotal.toFixed(2)}€</div>
            </div>
        `;
    });

    container.innerHTML = html;
    subtotalEl.textContent = `${total.toFixed(2)}€`;
    totalEl.textContent = `${total.toFixed(2)}€`;
    submitBtn.disabled = false;
}

function setupCart() {
    updateCartUI();
}

function setupForm() {
    const form = document.getElementById('order-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (cart.length === 0) return;

        const name = document.getElementById('order-name').value;
        const phone = document.getElementById('order-phone').value;
        const time = document.getElementById('order-time').value;
        const submitBtn = document.getElementById('btn-submit-order');

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traitement...';

        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const orderData = {
            customer_name: name,
            phone: phone,
            pickup_time: time,
            total_price: total,
            items: cart.map(item => ({
                name: item.name,
                price: item.price,
                quantity: item.quantity
            }))
        };

        try {
            const response = await fetch('https://hikari-sushi-api.nguyenphuockhai1234123.workers.dev/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
            const result = await response.json();

            if (result.success) {
                // Show success view
                document.getElementById('cart-view').style.display = 'none';
                document.getElementById('order-success-view').style.display = 'block';
                document.getElementById('success-order-code').textContent = result.order_code;
                document.getElementById('success-pickup-time').textContent = time;

                // Clear cart
                cart = [];
                updateCartUI();

                // Scroll to top
                window.scrollTo(0, 0);
            } else {
                alert('Erreur lors de la commande : ' + result.error);
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Confirmer la Commande';
            }
        } catch (error) {
            console.error('Submit error:', error);
            alert('Erreur de connexion.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Confirmer la Commande';
        }
    });
}
