const API_BASE = '';
let currentToken = localStorage.getItem('token');
let currentUser = null;
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
let isLoginMode = true;
let currentCategory = 'all';
let currentSearch = '';
let isDark = localStorage.getItem('theme') === 'dark';
if (isDark) document.documentElement.classList.add('dark');

document.addEventListener('DOMContentLoaded', () => {
    updateThemeIcon();
    updateCartCount();
    setupSearch();
    if (currentToken) { loadUserProfile(); }
    else { document.getElementById('welcome-section').classList.remove('hidden'); }
});

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const colors = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-blue-500', warning: 'bg-yellow-500' };
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
    toast.className = `toast ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-3 min-w-[300px]`;
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'fadeOut 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function toggleTheme() {
    isDark = !isDark;
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon();
    showToast(isDark ? 'Тёмная тема включена' : 'Светлая тема включена', 'info');
}
function updateThemeIcon() {
    const icon = document.getElementById('theme-icon');
    if (icon) icon.className = isDark ? 'fas fa-sun text-yellow-400' : 'fas fa-moon text-gray-600';
}

function setupSearch() {
    const searchInput = document.getElementById('search-input');
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentSearch = e.target.value.trim();
            if (currentSearch) showCatalog();
            else loadProducts();
        }, 300);
    });
}

function hideAllSections() {
    ['welcome-section', 'catalog-section', 'cart-section', 'orders-section', 'admin-section'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}
function goHome() {
    hideAllSections();
    if (currentUser) {
        document.getElementById('catalog-section').classList.remove('hidden');
        currentCategory = 'all'; currentSearch = '';
        document.getElementById('search-input').value = '';
        loadProducts();
    } else {
        document.getElementById('welcome-section').classList.remove('hidden');
    }
}
function showCatalog() {
    hideAllSections();
    document.getElementById('catalog-section').classList.remove('hidden');
    loadProducts();
}
function showCart() {
    if (!currentToken) { showToast('Войдите, чтобы открыть корзину', 'warning'); showAuthModal(); return; }
    hideAllSections();
    document.getElementById('cart-section').classList.remove('hidden');
    renderCart();
}

async function showOrders() {
    if (!currentToken) { showToast('Войдите, чтобы посмотреть заказы', 'warning'); showAuthModal(); return; }
    hideAllSections();
    document.getElementById('orders-section').classList.remove('hidden');
    try {
        const response = await fetch(`${API_BASE}/orders/my`, { headers: { 'Authorization': `Bearer ${currentToken}` } });
        if (!response.ok) throw new Error();
        const orders = await response.json();
        const list = document.getElementById('orders-list');
        if (orders.length === 0) { list.innerHTML = '<p class="text-center text-gray-500 py-12">Заказов пока нет</p>'; return; }
        list.innerHTML = orders.map(o => {
            const isPending = o.status === 'pending';
            const deliveryCost = o.delivery_cost || 0;
            const finalTotal = o.total_amount + deliveryCost;
            const statusBadge = isPending
                ? '<span class="px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800">Ожидает оплаты</span>'
                : '<span class="px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">Оплачен</span>';
            const payButton = isPending
                ? `<button onclick="payOrder(${o.id})" class="mt-4 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition flex items-center justify-center"><i class="fas fa-credit-card mr-2"></i> Оплатить заказ</button>`
                : '';
            return `
                <div class="bg-white rounded-lg p-6 shadow border-l-4 ${isPending ? 'border-yellow-400' : 'border-green-500'}">
                    <div class="flex justify-between items-center mb-3"><h3 class="font-bold text-lg text-gray-800">Заказ №${o.id}</h3>${statusBadge}</div>
                    <div class="text-gray-600 mb-3 space-y-1">${o.items.map(i => `<div>• ${i.quantity} шт. × ${i.price_at_purchase.toLocaleString()} ₽</div>`).join('')}</div>
                    <div class="mt-4 pt-4 border-t border-gray-200 space-y-1">
                        <div class="flex justify-between text-sm text-gray-600"><span>Товары:</span><span>${o.total_amount.toLocaleString()} ₽</span></div>
                        <div class="flex justify-between text-sm text-gray-600"><span>Доставка:</span><span>${deliveryCost === 0 ? 'Бесплатно 🎉' : deliveryCost.toLocaleString() + ' ₽'}</span></div>
                        <div class="flex justify-between text-xl font-bold text-primary-500 pt-2 border-t border-gray-200"><span>Итого:</span><span>${finalTotal.toLocaleString()} ₽</span></div>
                    </div>
                    ${payButton}
                </div>`;
        }).join('');
    } catch (e) {
        document.getElementById('orders-list').innerHTML = '<p class="text-red-500 text-center py-12">Ошибка загрузки заказов</p>';
    }
}

function showAuthModal() { document.getElementById('auth-modal').classList.remove('hidden'); }
function showAddProductModal() { document.getElementById('add-product-modal').classList.remove('hidden'); }
function closeModal(modalId) { document.getElementById(modalId).classList.add('hidden'); }
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('modal-title').textContent = isLoginMode ? 'Вход' : 'Регистрация';
    document.getElementById('submit-btn-text').textContent = isLoginMode ? 'Войти' : 'Зарегистрироваться';
    document.getElementById('toggle-auth').textContent = isLoginMode ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти';
    document.getElementById('role-field').classList.toggle('hidden', isLoginMode);
}

async function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    try {
        const response = await fetch(`${API_BASE}${isLoginMode ? '/auth/login' : '/auth/register'}`, {
            method: 'POST',
            headers: isLoginMode ? { 'Content-Type': 'application/x-www-form-urlencoded' } : { 'Content-Type': 'application/json' },
            body: isLoginMode ? new URLSearchParams({ username: email, password }) : JSON.stringify({ email, password, role })
        });
        if (!response.ok) {
            const error = await response.json();
            let msg = 'Ошибка';
            if (typeof error.detail === 'string') msg = error.detail;
            else if (Array.isArray(error.detail)) msg = error.detail.map(e => e.msg).join('; ');
            showToast(msg, 'error'); return;
        }
        const data = await response.json();
        if (isLoginMode) {
            currentToken = data.access_token;
            localStorage.setItem('token', currentToken);
            closeModal('auth-modal');
            showToast('Добро пожаловать!', 'success');
            loadUserProfile();
        } else {
            showToast('Регистрация успешна! Войдите в аккаунт.', 'success');
            toggleAuthMode();
        }
    } catch (error) { showToast('Ошибка сети: ' + error.message, 'error'); }
}

async function loadUserProfile() {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, { headers: { 'Authorization': `Bearer ${currentToken}` } });
        if (!response.ok) { logout(); return; }
        currentUser = await response.json();
        document.getElementById('nav-auth').classList.add('hidden');
        document.getElementById('nav-links').classList.remove('hidden');
        const navUser = document.getElementById('nav-user');
        navUser.classList.remove('hidden'); navUser.classList.add('flex');
        document.getElementById('user-email').textContent = currentUser.email;
        document.getElementById('user-role').textContent = currentUser.role;
        if (currentUser.role === 'seller' || currentUser.role === 'admin') {
            document.getElementById('add-product-btn').classList.remove('hidden');
        }
        if (currentUser.role === 'admin') {
            document.getElementById('admin-nav-btn').classList.remove('hidden');
        }
        showCatalog();
    } catch (error) { logout(); }
}

async function loadProducts() {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = Array(8).fill(0).map(() => `
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="h-48 skeleton"></div>
            <div class="p-4 space-y-3">
                <div class="h-3 skeleton rounded w-1/3"></div><div class="h-5 skeleton rounded w-3/4"></div>
                <div class="h-3 skeleton rounded w-full"></div><div class="h-8 skeleton rounded w-1/2"></div>
                <div class="h-10 skeleton rounded w-full"></div>
            </div>
        </div>`).join('');
    try {
        const params = new URLSearchParams();
        if (currentCategory && currentCategory !== 'all') params.append('category', currentCategory);
        if (currentSearch) params.append('search', currentSearch);
        const response = await fetch(`${API_BASE}/products/?${params.toString()}`);
        if (!response.ok) throw new Error('Ошибка загрузки');
        const products = await response.json();
        products.forEach(p => { fetch(`${API_BASE}/products/${p.id}/view`, { method: 'POST' }).catch(() => {}); });
        if (products.length === 0) { grid.innerHTML = '<p class="col-span-4 text-center text-gray-500 py-12">Товаров не найдено</p>'; return; }
        grid.innerHTML = products.map(p => {
            const imgUrl = p.image_url ? p.image_url : `https://picsum.photos/seed/${p.id}/400/300`;
            const safeTitle = p.title.replace(/'/g, "\\'");
            const safeImg = (p.image_url || '').replace(/'/g, "\\'");
            return `
                <div class="product-card bg-white rounded-lg shadow overflow-hidden cursor-pointer" onclick="showProductDetail(${p.id})">
                    <div class="h-48 bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center overflow-hidden">
                        <img src="${imgUrl}" alt="${p.title}" class="w-full h-full object-cover" onerror="this.src='https://picsum.photos/seed/${p.id}/400/300'">
                    </div>
                    <div class="p-4">
                        <div class="text-xs text-gray-500 mb-1 uppercase tracking-wide">${getCategoryName(p.category)}</div>
                        <h3 class="font-bold text-lg mb-2 truncate text-gray-800">${p.title}</h3>
                        <p class="text-gray-500 text-sm mb-3 h-10 overflow-hidden">${p.description || 'Нет описания'}</p>
                        <div class="flex justify-between items-center mb-3">
                            <span class="text-2xl font-bold text-primary-500">${p.price.toLocaleString()} ₽</span>
                            <span class="text-xs bg-gray-200 px-2 py-1 rounded">👁 ${p.views || 0}</span>
                        </div>
                        <button onclick="event.stopPropagation(); addToCart(${p.id}, '${safeTitle}', ${p.price}, '${safeImg}')" class="w-full btn-primary text-white py-2 rounded-lg hover:opacity-90 transition"><i class="fas fa-cart-plus mr-2"></i>В корзину</button>
                        <button onclick="event.stopPropagation(); showRecommendations(${p.id}, '${p.category}')" class="w-full mt-2 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition text-sm"><i class="fas fa-lightbulb mr-2"></i>Похожие товары</button>
                    </div>
                </div>`;
        }).join('');
    } catch (error) {
        grid.innerHTML = '<p class="text-red-500 col-span-4 text-center py-12">Ошибка загрузки каталога</p>';
    }
}

async function showProductDetail(productId) {
    const modal = document.getElementById('product-modal');
    const content = document.getElementById('product-modal-content');
    content.innerHTML = '<div class="p-8 text-center"><i class="fas fa-spinner fa-spin text-4xl text-primary-500"></i></div>';
    modal.classList.remove('hidden');
    try {
        const response = await fetch(`${API_BASE}/products/?search=&category=`);
        const products = await response.json();
        const product = products.find(p => p.id === productId);
        if (!product) throw new Error();
        const detailImgUrl = product.image_url ? product.image_url : `https://picsum.photos/seed/${product.id}/800/400`;
        const safeTitle = product.title.replace(/'/g, "\\'");
        const safeImg = (product.image_url || '').replace(/'/g, "\\'");
        content.innerHTML = `
            <div class="relative">
                <button onclick="closeModal('product-modal')" class="absolute top-4 right-4 bg-white rounded-full p-2 shadow hover:bg-gray-100 z-10"><i class="fas fa-times text-xl"></i></button>
                <img src="${detailImgUrl}" alt="${product.title}" class="w-full h-64 object-cover" onerror="this.src='https://picsum.photos/seed/${product.id}/800/400'">
            </div>
            <div class="p-8">
                <div class="text-xs text-gray-500 mb-2 uppercase tracking-wide">${getCategoryName(product.category)}</div>
                <h2 class="text-3xl font-bold mb-4 text-gray-800">${product.title}</h2>
                <p class="text-gray-600 mb-6 text-lg">${product.description || 'Нет описания'}</p>
                <div class="flex items-center space-x-6 mb-6">
                    <span class="text-4xl font-bold text-primary-500">${product.price.toLocaleString()} ₽</span>
                    <span class="text-gray-500">👁 ${product.views || 0} просмотров</span>
                    <span class="text-gray-500">📦 Остаток: ${product.stock} шт.</span>
                </div>
                <button onclick="addToCart(${product.id}, '${safeTitle}', ${product.price}, '${safeImg}'); closeModal('product-modal');" class="w-full btn-primary text-white py-3 rounded-lg text-lg"><i class="fas fa-cart-plus mr-2"></i>В корзину</button>
            </div>`;
    } catch (e) {
        content.innerHTML = '<p class="p-8 text-center text-red-500">Ошибка загрузки товара</p>';
    }
}

async function showRecommendations(productId, category) {
    try {
        const response = await fetch(`${API_BASE}/products/recommendations?category=${category}&exclude_id=${productId}`);
        if (!response.ok) throw new Error();
        const recommendations = await response.json();
        const grid = document.getElementById('products-grid');
        if (recommendations.length === 0) { showToast('Похожих товаров не найдено', 'info'); return; }
        grid.innerHTML = `<div class="col-span-4 mb-4"><button onclick="loadProducts()" class="text-primary-500 hover:underline font-medium"><i class="fas fa-arrow-left mr-2"></i>Назад ко всем товарам</button><h3 class="text-xl font-bold mt-4 text-gray-800">Похожие товары в категории "${getCategoryName(category)}"</h3></div>` + recommendations.map(p => {
            const safeTitle = p.title.replace(/'/g, "\\'");
            const safeImg = (p.image_url || '').replace(/'/g, "\\'");
            return `<div class="product-card bg-white rounded-lg shadow overflow-hidden"><div class="h-48 bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center overflow-hidden"><img src="${p.image_url || `https://picsum.photos/seed/${p.id}/400/300`}" alt="${p.title}" class="w-full h-full object-cover"></div><div class="p-4"><h3 class="font-bold text-lg mb-2 truncate text-gray-800">${p.title}</h3><p class="text-gray-500 text-sm mb-3 h-10 overflow-hidden">${p.description || 'Нет описания'}</p><div class="flex justify-between items-center mb-3"><span class="text-2xl font-bold text-primary-500">${p.price.toLocaleString()} ₽</span><span class="text-xs bg-gray-200 px-2 py-1 rounded">👁 ${p.views || 0}</span></div><button onclick="addToCart(${p.id}, '${safeTitle}', ${p.price}, '${safeImg}')" class="w-full btn-primary text-white py-2 rounded-lg hover:opacity-90 transition"><i class="fas fa-cart-plus mr-2"></i>В корзину</button></div></div>`;
        }).join('');
    } catch (error) { showToast('Ошибка загрузки рекомендаций', 'error'); }
}

function getCategoryName(category) {
    const names = { 'electronics': 'Электроника', 'clothing': 'Одежда', 'home': 'Дом', 'books': 'Книги', 'sport': 'Спорт', 'other': 'Другое' };
    return names[category] || category;
}

function filterByCategory(category) {
    currentCategory = category;
    document.querySelectorAll('.category-card').forEach(card => card.classList.remove('active'));
    event.currentTarget.classList.add('active');
    showCatalog();
}

async function handleAddProduct(event) {
    event.preventDefault();
    let title, description, price, stock, category, imageFile;
    try {
        title = document.getElementById('product-title').value.trim();
        description = document.getElementById('product-description').value.trim();
        price = parseFloat(document.getElementById('product-price').value);
        stock = parseInt(document.getElementById('product-stock')?.value || 0);
        category = document.getElementById('product-category').value;
        imageFile = document.getElementById('product-image')?.files[0];
        if (!title || isNaN(price) || price <= 0) { showToast('Заполните название и корректную цену', 'warning'); return; }
    } catch (e) { showToast('Ошибка формы: ' + e.message, 'error'); console.error(e); return; }
    try {
        const response = await fetch(`${API_BASE}/products/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
            body: JSON.stringify({ title, description, price, stock, category, image_url: "" })
        });
        if (!response.ok) {
            const error = await response.json();
            let msg = 'Ошибка создания товара';
            if (typeof error.detail === 'string') msg = error.detail;
            else if (Array.isArray(error.detail)) msg = error.detail.map(e => e.msg).join('; ');
            showToast(msg, 'error'); return;
        }
        const product = await response.json();
        showToast('Товар создан!', 'success');
        if (imageFile) {
            const formData = new FormData();
            formData.append('file', imageFile);
            const uploadRes = await fetch(`${API_BASE}/products/${product.id}/upload-image`, {
                method: 'POST', headers: { 'Authorization': `Bearer ${currentToken}` }, body: formData
            });
            if (uploadRes.ok) showToast('Изображение успешно загружено!', 'success');
            else { const err = await uploadRes.json().catch(() => ({})); showToast('Фото не загружено: ' + (err.detail || uploadRes.status), 'warning'); }
        }
        closeModal('add-product-modal');
        loadProducts();
        event.target.reset();
    } catch (error) { showToast('Ошибка сети: ' + error.message, 'error'); console.error(error); }
}

function addToCart(productId, title, price, imageUrl = '') {
    if (!currentToken) { showToast('Войдите в аккаунт, чтобы добавлять товары', 'warning'); showAuthModal(); return; }
    const existingItem = cart.find(item => item.product_id === productId);
    if (existingItem) existingItem.quantity += 1;
    else cart.push({ product_id: productId, title, price, quantity: 1, image_url: imageUrl });
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    showToast(`${title} добавлен в корзину`, 'success');
}

function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cart-count');
    if (badge) { badge.textContent = count; badge.style.display = count === 0 ? 'none' : 'flex'; }
}

function renderCart() {
    const cartItems = document.getElementById('cart-items');
    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="text-center text-gray-500 py-12">Корзина пуста</p>';
        document.getElementById('cart-total').textContent = '0 ₽';
        return;
    }
    let total = 0;
    cartItems.innerHTML = cart.map(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const cartImgUrl = item.image_url || `https://picsum.photos/seed/${item.product_id}/80/80`;
        return `
            <div class="bg-white rounded-lg p-4 shadow flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <img src="${cartImgUrl}" class="w-20 h-20 rounded object-cover" onerror="this.src='https://picsum.photos/seed/${item.product_id}/80/80'">
                    <div><h3 class="font-bold text-gray-800">${item.title}</h3><p class="text-gray-500">${item.price.toLocaleString()} ₽ / шт.</p></div>
                </div>
                <div class="flex items-center space-x-6">
                    <div class="flex items-center space-x-2 border rounded-lg bg-gray-50">
                        <button onclick="changeQuantity(${item.product_id}, -1)" class="px-3 py-1 text-gray-600 hover:bg-gray-200 rounded-l-lg font-bold">−</button>
                        <span class="px-2 font-bold min-w-[20px] text-center">${item.quantity}</span>
                        <button onclick="changeQuantity(${item.product_id}, 1)" class="px-3 py-1 text-gray-600 hover:bg-gray-200 rounded-r-lg font-bold">+</button>
                    </div>
                    <span class="text-xl font-bold text-primary-500 min-w-[100px] text-right">${itemTotal.toLocaleString()} ₽</span>
                    <button onclick="removeFromCart(${item.product_id})" class="text-red-400 hover:text-red-600 p-2"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
    }).join('');
    const deliveryCost = total >= 5000 ? 0 : Math.max(200, Math.min(total * 0.05, 1000));
    document.getElementById('cart-total').innerHTML = `
        <div class="space-y-2 text-right">
            <div class="flex justify-between text-gray-600"><span>Товары:</span><span>${total.toLocaleString()} ₽</span></div>
            <div class="flex justify-between text-gray-600"><span>Доставка:</span><span>${deliveryCost === 0 ? 'Бесплатно' : deliveryCost.toLocaleString() + ' ₽'}</span></div>
            <div class="flex justify-between text-xl font-bold text-primary-500 pt-2 border-t"><span>Итого:</span><span>${(total + deliveryCost).toLocaleString()} ₽</span></div>
        </div>`;
}

function changeQuantity(productId, delta) {
    const item = cart.find(i => i.product_id === productId);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) cart = cart.filter(i => i.product_id !== productId);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount(); renderCart();
}
function removeFromCart(productId) {
    cart = cart.filter(item => item.product_id !== productId);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount(); renderCart();
    showToast('Товар удалён из корзины', 'info');
}

async function checkout() {
    if (cart.length === 0) { showToast('Корзина пуста', 'warning'); return; }
    try {
        const response = await fetch(`${API_BASE}/orders/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
            body: JSON.stringify({ items: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity })) })
        });
        if (!response.ok) { const error = await response.json(); showToast(error.detail || 'Ошибка оформления', 'error'); return; }
        showToast('Заказ оформлен! Чек отправлен на email.', 'success');
        cart = []; localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount(); showOrders();
    } catch (error) { showToast('Ошибка сети', 'error'); }
}

async function payOrder(orderId) {
    showToast('Обработка платежа...', 'info');
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}/pay`, { method: 'POST', headers: { 'Authorization': `Bearer ${currentToken}` } });
        if (!response.ok) { const error = await response.json(); showToast(error.detail || 'Ошибка оплаты', 'error'); return; }
        showToast('Оплата прошла успешно! Чек отправлен на email.', 'success');
        showOrders();
    } catch (error) { showToast('Ошибка сети при оплате', 'error'); }
}

function logout() {
    currentToken = null; currentUser = null;
    localStorage.removeItem('token');
    document.getElementById('nav-auth').classList.remove('hidden');
    document.getElementById('nav-links').classList.add('hidden');
    const navUser = document.getElementById('nav-user');
    navUser.classList.add('hidden'); navUser.classList.remove('flex');
    document.getElementById('add-product-btn').classList.add('hidden');
    document.getElementById('admin-nav-btn').classList.add('hidden');
    hideAllSections();
    document.getElementById('welcome-section').classList.remove('hidden');
    showToast('Вы вышли из аккаунта', 'info');
}

function showAdminPanel() {
    hideAllSections();
    document.getElementById('admin-section').classList.remove('hidden');
    loadAdminData();
}
async function loadAdminData() {
    try {
        const statsRes = await fetch(`${API_BASE}/admin/stats`, { headers: { 'Authorization': `Bearer ${currentToken}` } });
        if (statsRes.ok) {
            const stats = await statsRes.json();
            document.getElementById('stat-users').textContent = stats.total_users;
            document.getElementById('stat-products').textContent = stats.total_products;
            document.getElementById('stat-orders').textContent = stats.total_orders;
            document.getElementById('stat-revenue').textContent = stats.total_revenue.toLocaleString() + ' ₽';
        }
        const usersRes = await fetch(`${API_BASE}/admin/users`, { headers: { 'Authorization': `Bearer ${currentToken}` } });
        if (usersRes.ok) {
            const users = await usersRes.json();
            document.getElementById('admin-users-list').innerHTML = users.map(u => `
                <div class="flex justify-between items-center p-3 bg-gray-50 rounded border">
                    <div><span class="font-bold text-gray-800">${u.email}</span><span class="text-xs bg-gray-200 px-2 py-1 rounded ml-2">${u.role}</span></div>
                    ${u.id !== currentUser.id ? `<button onclick="deleteUser(${u.id})" class="text-red-500 hover:text-red-700 text-sm font-bold">Удалить</button>` : '<span class="text-xs text-gray-400">Это вы</span>'}
                </div>`).join('');
        }
    } catch (e) { showToast('Ошибка загрузки данных админа', 'error'); }
}
async function deleteUser(userId) {
    if (!confirm('Удалить этого пользователя?')) return;
    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${currentToken}` } });
        if (res.ok) { showToast('Пользователь удален', 'success'); loadAdminData(); }
        else showToast('Ошибка удаления', 'error');
    } catch (e) { showToast('Ошибка сети', 'error'); }
}