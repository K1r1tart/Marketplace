const API_BASE = '';
let currentToken = localStorage.getItem('token');
let currentUser = null;
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
let isLoginMode = true;
let currentCategory = 'all';
let currentSearch = '';
let isDark = localStorage.getItem('theme') === 'dark';

// Применяем тему при загрузке
if (isDark) document.documentElement.classList.add('dark');

document.addEventListener('DOMContentLoaded', () => {
    updateThemeIcon();
    if (currentToken) loadUserProfile();
    updateCartCount();
    setupSearch();
});

// === Toast уведомления ===
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
        warning: 'bg-yellow-500'
    };
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    toast.className = `toast ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-3 min-w-[300px]`;
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// === Тёмная тема ===
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

// === Поиск ===
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentSearch = e.target.value.trim();
            if (currentUser) loadProducts();
        }, 300);
    });
}

// === Навигация ===
function hideAllSections() {
    ['welcome-section', 'catalog-section', 'cart-section', 'orders-section']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
}

function goHome() {
    hideAllSections();
    if (currentUser) {
        document.getElementById('catalog-section').classList.remove('hidden');
        currentCategory = 'all';
        currentSearch = '';
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
    hideAllSections();
    document.getElementById('cart-section').classList.remove('hidden');
    renderCart();
}

async function showOrders() {
    hideAllSections();
    document.getElementById('orders-section').classList.remove('hidden');
    try {
        const response = await fetch(`${API_BASE}/orders/my`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!response.ok) throw new Error();
        const orders = await response.json();
        const list = document.getElementById('orders-list');
        if (orders.length === 0) {
            list.innerHTML = '<p class="text-center text-gray-500 py-12">Заказов пока нет</p>';
            return;
        }
        list.innerHTML = orders.map(o => `
            <div class="bg-white rounded-lg p-6 shadow">
                <div class="flex justify-between items-center mb-3">
                    <h3 class="font-bold text-lg text-gray-800">Заказ №${o.id}</h3>
                    <span class="px-3 py-1 rounded-full text-sm ${o.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">
                        ${o.status === 'pending' ? 'Ожидает оплаты' : 'Оплачен'}
                    </span>
                </div>
                <div class="text-gray-600 mb-3 space-y-1">
                    ${o.items.map(i => `<div>• ${i.quantity} шт. × ${i.price_at_purchase.toLocaleString()} ₽</div>`).join('')}
                </div>
                <div class="text-xl font-bold text-primary-500 mt-4 pt-4 border-t border-gray-200">Итого: ${o.total_amount.toLocaleString()} ₽</div>
            </div>
        `).join('');
    } catch (e) {
        document.getElementById('orders-list').innerHTML = '<p class="text-red-500 text-center py-12">Ошибка загрузки заказов</p>';
    }
}

// === Модальные окна ===
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

// === Аутентификация ===
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
            showToast(msg, 'error');
            return;
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
    } catch (error) {
        showToast('Ошибка сети: ' + error.message, 'error');
    }
}

async function loadUserProfile() {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!response.ok) { logout(); return; }
        currentUser = await response.json();
        document.getElementById('nav-auth').classList.add('hidden');
        document.getElementById('nav-links').classList.remove('hidden');
        document.getElementById('nav-user').classList.remove('hidden');
        document.getElementById('nav-user').classList.add('flex');
        document.getElementById('user-email').textContent = currentUser.email;
        document.getElementById('user-role').textContent = currentUser.role;
        document.getElementById('welcome-section').classList.add('hidden');
        document.getElementById('catalog-section').classList.remove('hidden');
        if (currentUser.role === 'seller' || currentUser.role === 'admin') {
            document.getElementById('add-product-btn').classList.remove('hidden');
        }
        loadProducts();
    } catch (error) { logout(); }
}

// === Каталог ===
async function loadProducts() {
    const grid = document.getElementById('products-grid');
    // Показываем скелетоны
    grid.innerHTML = Array(8).fill(0).map(() => `
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="h-48 skeleton"></div>
            <div class="p-4 space-y-3">
                <div class="h-3 skeleton rounded w-1/3"></div>
                <div class="h-5 skeleton rounded w-3/4"></div>
                <div class="h-3 skeleton rounded w-full"></div>
                <div class="h-8 skeleton rounded w-1/2"></div>
                <div class="h-10 skeleton rounded w-full"></div>
            </div>
        </div>
    `).join('');

    try {
        const params = new URLSearchParams();
        if (currentCategory && currentCategory !== 'all') params.append('category', currentCategory);
        if (currentSearch) params.append('search', currentSearch);
        const url = `${API_BASE}/products/?${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Ошибка загрузки');
        const products = await response.json();
        products.forEach(p => {
            fetch(`${API_BASE}/products/${p.id}/view`, { method: 'POST' }).catch(() => {});
        });
        if (products.length === 0) {
            grid.innerHTML = '<p class="col-span-4 text-center text-gray-500 py-12">Товаров не найдено</p>';
            return;
        }
        grid.innerHTML = products.map(p => `
            <div class="product-card bg-white rounded-lg shadow overflow-hidden cursor-pointer" onclick="showProductDetail(${p.id})">
                <div class="h-48 bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center overflow-hidden">
                    <img src="https://picsum.photos/seed/${p.id}/400/300" alt="${p.title}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\\'fas fa-box text-6xl text-purple-300\\'></i>';">
                </div>
                <div class="p-4">
                    <div class="text-xs text-gray-500 mb-1 uppercase tracking-wide">${getCategoryName(p.category)}</div>
                    <h3 class="font-bold text-lg mb-2 truncate text-gray-800">${p.title}</h3>
                    <p class="text-gray-500 text-sm mb-3 h-10 overflow-hidden">${p.description || 'Нет описания'}</p>
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-2xl font-bold text-primary-500">${p.price.toLocaleString()} ₽</span>
                        <span class="text-xs bg-gray-200 px-2 py-1 rounded">👁 ${p.views || 0}</span>
                    </div>
                    <button onclick="event.stopPropagation(); addToCart(${p.id}, '${p.title.replace(/'/g, "\\'")}', ${p.price})" 
                            class="w-full btn-primary text-white py-2 rounded-lg hover:opacity-90 transition">
                        <i class="fas fa-cart-plus mr-2"></i>В корзину
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        grid.innerHTML = '<p class="text-red-500 col-span-4 text-center py-12">Ошибка загрузки каталога</p>';
    }
}

// === Детальная страница товара ===
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
        content.innerHTML = `
            <div class="relative">
                <button onclick="closeModal('product-modal')" class="absolute top-4 right-4 bg-white rounded-full p-2 shadow hover:bg-gray-100 z-10">
                    <i class="fas fa-times text-xl"></i>
                </button>
                <img src="https://picsum.photos/seed/${product.id}/800/400" alt="${product.title}" class="w-full h-64 object-cover" onerror="this.src='https://via.placeholder.com/800x400?text=No+Image'">
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
                <div class="flex space-x-4">
                    <button onclick="addToCart(${product.id}, '${product.title.replace(/'/g, "\\'")}', ${product.price}); closeModal('product-modal');" 
                            class="flex-1 btn-primary text-white py-3 rounded-lg text-lg">
                        <i class="fas fa-cart-plus mr-2"></i>В корзину
                    </button>
                </div>
            </div>
        `;
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
        if (recommendations.length === 0) {
            showToast('Похожих товаров не найдено', 'info');
            return;
        }
        grid.innerHTML = `
            <div class="col-span-4 mb-4">
                <button onclick="loadProducts()" class="text-primary-500 hover:underline font-medium">
                    <i class="fas fa-arrow-left mr-2"></i>Назад ко всем товарам
                </button>
                <h3 class="text-xl font-bold mt-4 text-gray-800">Похожие товары в категории "${getCategoryName(category)}"</h3>
            </div>
        ` + recommendations.map(p => `
            <div class="product-card bg-white rounded-lg shadow overflow-hidden">
                <div class="h-48 bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center overflow-hidden">
                    <img src="https://picsum.photos/seed/${p.id}/400/300" alt="${p.title}" class="w-full h-full object-cover" onerror="this.style.display='none'">
                </div>
                <div class="p-4">
                    <h3 class="font-bold text-lg mb-2 truncate text-gray-800">${p.title}</h3>
                    <p class="text-gray-500 text-sm mb-3 h-10 overflow-hidden">${p.description || 'Нет описания'}</p>
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-2xl font-bold text-primary-500">${p.price.toLocaleString()} ₽</span>
                        <span class="text-xs bg-gray-200 px-2 py-1 rounded">👁 ${p.views || 0}</span>
                    </div>
                    <button onclick="addToCart(${p.id}, '${p.title.replace(/'/g, "\\'")}', ${p.price})" 
                            class="w-full btn-primary text-white py-2 rounded-lg hover:opacity-90 transition">
                        <i class="fas fa-cart-plus mr-2"></i>В корзину
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        showToast('Ошибка загрузки рекомендаций', 'error');
    }
}

function getCategoryName(category) {
    const names = {
        'electronics': 'Электроника', 'clothing': 'Одежда', 'home': 'Дом',
        'books': 'Книги', 'sport': 'Спорт', 'other': 'Другое'
    };
    return names[category] || category;
}

function filterByCategory(category) {
    currentCategory = category;
    document.querySelectorAll('.category-card').forEach(card => card.classList.remove('active'));
    event.currentTarget.classList.add('active');
    if (currentUser) loadProducts();
}

async function handleAddProduct(event) {
    event.preventDefault();
    try {
        const response = await fetch(`${API_BASE}/products/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
            body: JSON.stringify({
                title: document.getElementById('product-title').value,
                description: document.getElementById('product-description').value,
                price: parseFloat(document.getElementById('product-price').value),
                stock: parseInt(document.getElementById('product-stock').value),
                category: document.getElementById('product-category').value
            })
        });
        if (!response.ok) {
            const error = await response.json();
            showToast(error.detail || 'Ошибка', 'error');
            return;
        }
        showToast('Товар добавлен!', 'success');
        closeModal('add-product-modal');
        loadProducts();
        event.target.reset();
    } catch (error) {
        showToast('Ошибка сети', 'error');
    }
}

// === Корзина ===
function addToCart(productId, title, price) {
    const existingItem = cart.find(item => item.product_id === productId);
    if (existingItem) existingItem.quantity += 1;
    else cart.push({ product_id: productId, title, price, quantity: 1 });
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    showToast(`${title} добавлен в корзину`, 'success');
}

function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cart-count').textContent = count;
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
        return `
            <div class="bg-white rounded-lg p-4 shadow flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <img src="https://picsum.photos/seed/${item.product_id}/80/80" class="w-20 h-20 rounded object-cover" onerror="this.style.display='none'">
                    <div>
                        <h3 class="font-bold text-gray-800">${item.title}</h3>
                        <p class="text-gray-500">${item.price.toLocaleString()} ₽ / шт.</p>
                    </div>
                </div>
                <div class="flex items-center space-x-6">
                    <div class="flex items-center space-x-2 border rounded-lg bg-gray-50">
                        <button onclick="changeQuantity(${item.product_id}, -1)" class="px-3 py-1 text-gray-600 hover:bg-gray-200 rounded-l-lg font-bold">−</button>
                        <span class="px-2 font-bold min-w-[20px] text-center">${item.quantity}</span>
                        <button onclick="changeQuantity(${item.product_id}, 1)" class="px-3 py-1 text-gray-600 hover:bg-gray-200 rounded-r-lg font-bold">+</button>
                    </div>
                    <span class="text-xl font-bold text-primary-500 min-w-[100px] text-right">${itemTotal.toLocaleString()} ₽</span>
                    <button onclick="removeFromCart(${item.product_id})" class="text-red-400 hover:text-red-600 p-2" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    document.getElementById('cart-total').textContent = total.toLocaleString() + ' ₽';
}

function changeQuantity(productId, delta) {
    const item = cart.find(i => i.product_id === productId);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) cart = cart.filter(i => i.product_id !== productId);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.product_id !== productId);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
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
        if (!response.ok) {
            const error = await response.json();
            showToast(error.detail || 'Ошибка оформления', 'error');
            return;
        }
        showToast('Заказ оформлен! Чек отправлен на email.', 'success');
        cart = [];
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        showOrders();
    } catch (error) {
        showToast('Ошибка сети', 'error');
    }
}

function logout() {
    currentToken = null;
    currentUser = null;
    localStorage.removeItem('token');
    document.getElementById('nav-auth').classList.remove('hidden');
    document.getElementById('nav-links').classList.add('hidden');
    document.getElementById('nav-user').classList.add('hidden');
    document.getElementById('nav-user').classList.remove('flex');
    document.getElementById('add-product-btn').classList.add('hidden');
    goHome();
    showToast('Вы вышли из аккаунта', 'info');
}