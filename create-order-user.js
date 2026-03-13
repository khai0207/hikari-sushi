const crypto = require('crypto');

function hashPassword(password) {
    const data = password + 'hikari-salt-2024';
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    console.log(`Password: ${password}`);
    console.log(`Hash: ${hash}`);

    // Output SQL command
    console.log(`\nSQL Command:\nINSERT INTO admin_users (email, password_hash, role) VALUES ('commande@hikari-sushi.fr', '${hash}', 'order_admin');`);
}

hashPassword('CommandeHikari!2024');
