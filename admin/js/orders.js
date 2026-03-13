// admin/js/orders.js

let orders = [];
let pollingInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Protect page
    const isLoggedIn = await HikariAPI.protectAdminPage();
    if (!isLoggedIn) return;

    // Logout handler
    document.getElementById('logoutBtn').addEventListener('click', () => HikariAPI.logout());

    // Update real-time clock
    setInterval(() => {
        document.getElementById('currentTime').textContent = new Date().toLocaleTimeString('fr-FR');
    }, 1000);

    // Initial load
    await loadOrders();

    // Start polling every 15 seconds
    pollingInterval = setInterval(loadOrders, 15000);
});

async function loadOrders() {
    try {
        const response = await fetch('https://hikari-sushi-api.nguyenphuockhai1234123.workers.dev/api/admin/orders', {
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('hikari_auth_token')}`
            }
        });

        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }

        const result = await response.json();

        if (result.success) {
            orders = result.items;
            renderOrders();
            updateStats();
        } else {
            console.error('Failed to load orders:', result.error);
        }
    } catch (e) {
        console.error('Error fetching orders:', e);
    }
}

function renderOrders() {
    const container = document.getElementById('orders-container');

    if (orders.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color);">
                <i class="fas fa-inbox" style="font-size: 3rem; color: var(--text-muted); opacity: 0.5; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-muted);">Aucune commande pour le moment.</p>
            </div>
        `;
        return;
    }

    let html = '';
    orders.forEach(order => {
        const isReceived = order.status === 'received';
        const cardClass = isReceived ? 'order-card received' : 'order-card pending';

        // Items list
        let itemsHtml = '';
        if (Array.isArray(order.items)) {
            order.items.forEach(item => {
                itemsHtml += `
                    <li>
                        <span>${item.quantity}x ${item.name}</span>
                        <span>${parseFloat(item.price * item.quantity).toFixed(2)}€</span>
                    </li>
                `;
            });
        }

        // Action button
        let actionHtml = '';
        if (isReceived) {
            actionHtml = `<span class="already-received"><i class="fas fa-check-circle"></i> Déjà reçu</span>`;
        } else {
            actionHtml = `<button class="btn-action-received" onclick="markAsReceived(${order.id})"><i class="fas fa-check"></i> Marquer comme reçu</button>`;
        }

        const date = new Date(order.created_at);
        const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        html += `
            <div class="${cardClass}">
                <div class="order-header">
                    <span class="order-code">#${order.order_code}</span>
                    <span class="order-time"><i class="fas fa-clock"></i> Commande à ${timeStr}</span>
                </div>
                
                <div class="order-customer">
                    <strong>${order.customer_name}</strong>
                    <span><i class="fas fa-phone"></i> ${order.phone}</span>
                    <span style="display:block; margin-top:5px; color: var(--gold); font-weight:600;"><i class="fas fa-box"></i> Retrait prévu : ${order.pickup_time}</span>
                </div>

                <ul class="order-items">
                    ${itemsHtml}
                </ul>

                <div class="order-total">
                    Total: ${parseFloat(order.total_price).toFixed(2)}€
                </div>

                <div class="order-actions">
                    ${actionHtml}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function updateStats() {
    let pendingCount = 0;
    let receivedCount = 0;
    let totalRevenue = 0;

    orders.forEach(order => {
        if (order.status === 'pending') {
            pendingCount++;
        } else if (order.status === 'received') {
            receivedCount++;
            totalRevenue += parseFloat(order.total_price);
        }
    });

    document.getElementById('stat-pending').textContent = pendingCount;
    document.getElementById('stat-received').textContent = receivedCount;
    document.getElementById('stat-revenue').textContent = `${totalRevenue.toFixed(2)}€`;
}

async function markAsReceived(orderId) {
    if (!confirm('Voulez-vous vraiment marquer cette commande comme reçue ?')) return;

    try {
        const response = await fetch(`https://hikari-sushi-api.nguyenphuockhai1234123.workers.dev/api/admin/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('hikari_auth_token')}`
            },
            body: JSON.stringify({ status: 'received' })
        });

        const result = await response.json();
        if (result.success) {
            // Optimistically update
            const idx = orders.findIndex(o => o.id === orderId);
            if (idx > -1) {
                orders[idx].status = 'received';
                renderOrders();
                updateStats();
            }
        } else {
            alert('Erreur: ' + result.error);
        }
    } catch (e) {
        alert('Erreur de connexion');
        console.error(e);
    }
}
