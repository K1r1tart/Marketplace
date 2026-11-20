const API_BASE = '';
let currentToken = localStorage.getItem('token');
let currentUser = null;
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
let isLoginMode = true;
let currentCategory = 'all';
let currentSearch = '';

document.addEventListener('DOMContentLoaded', () => {
    if (currentToken) {
        loadUserProfile();
    }
    updateCartCount();
    setupSearch();
});

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

// === Навигация и управление секциями ===
function hideAllSections() {
    ['welcome-section', 'catalog-section', 'cart-section', 'orders-section']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');  // ← защита от null
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
                    <h3 class="font-bold text-lg">Заказ №${o.id}</h3>
                    <span class="px-3 py-1 rounded-full text-sm ${o.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">
                        ${o.status === 'pending' ? 'Ожидает' : 'Оплачен'}
                    </span>
                </div>
                <div class="text-gray-600 mb-3 space-y-1">
                    ${o.items.map(i => `<div>• ${i.quantity} шт. × ${i.price_at_purchase.toLocaleString()} ₽</div>`).join('')}
                </div>
                <div class="text-xl font-bold text-purple-600 mt-4 pt-4 border-t">Итого: ${o.total_amount.toLocaleString()} ₽</div>
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
    const title = document.getElementById('modal-title');
    const submitBtn = document.getElementById('submit-btn-text');
    const toggleBtn = document.getElementById('toggle-auth');
    const roleField = document.getElementById('role-field');

    if (isLoginMode) {
        title.textContent = 'Вход';
        submitBtn.textContent = 'Войти';
        toggleBtn.textContent = 'Нет аккаунта? Зарегистрироваться';
        roleField.classList.add('hidden');
    } else {
        title.textContent = 'Регистрация';
        submitBtn.textContent = 'Зарегистрироваться';
        toggleBtn.textContent = 'Уже есть аккаунт? Войти';
        roleField.classList.remove('hidden');
    }
}

// === Аутентификация (исправлена обработка JSON vs Form-data) ===
async function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;

    let response;
    try {
        if (isLoginMode) {
            response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ username: email, password })
            });
        } else {
            response = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role })
            });
        }

        if (!response.ok) {
            const error = await response.json();
            let message = 'Ошибка';
            if (typeof error.detail === 'string') {
                message = error.detail;
            } else if (Array.isArray(error.detail)) {
                message = error.detail.map(e => e.msg).join('; ');
            }
            alert(message);
            return;
        }

        const data = await response.json();
        if (isLoginMode) {
            currentToken = data.access_token;
            localStorage.setItem('token', currentToken);
            closeModal('auth-modal');
            loadUserProfile();
        } else {
            alert('Регистрация успешна! Теперь войдите.');
            toggleAuthMode();
        }
    } catch (error) {
        alert('Ошибка сети: ' + error.message);
    }
}

async function loadUserProfile() {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });

        if (!response.ok) {
            logout();
            return;
        }

        currentUser = await response.json();
        document.getElementById('nav-auth').classList.add('hidden');
        document.getElementById('nav-links').classList.remove('hidden'); // Показываем навигацию
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
    } catch (error) {
        logout();
    }
}

// === Каталог и рекомендации ===
async function loadProducts() {
    try {
        const params = new URLSearchParams();
        if (currentCategory && currentCategory !== 'all') params.append('category', currentCategory);
        if (currentSearch) params.append('search', currentSearch);

        const url = `${API_BASE}/products/?${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Ошибка загрузки товаров');
        
        const products = await response.json();
        const grid = document.getElementById('products-grid');
        
        if (products.length === 0) {
            grid.innerHTML = '<p class="col-span-4 text-center text-gray-500 py-12">Товаров не найдено</p>';
            return;
        }

        // Регистрируем просмотры для каждого товара (асинхронно, не блокируем UI)
        products.forEach(p => {
            fetch(`${API_BASE}/products/${p.id}/view`, { method: 'POST' }).catch(() => {});
        });

        grid.innerHTML = products.map(p => `
            <div class="product-card bg-white rounded-lg shadow overflow-hidden">
                <div class="h-48 bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                    <i class="fas fa-box text-6xl text-purple-300"></i>
                </div>
                <div class="p-4">
                    <div class="text-xs text-gray-500 mb-1 uppercase tracking-wide">${getCategoryName(p.category)}</div>
                    <h3 class="font-bold text-lg mb-2 truncate">${p.title}</h3>
                    <p class="text-gray-500 text-sm mb-3 h-10 overflow-hidden">${p.description || 'Нет описания'}</p>
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-2xl font-bold text-purple-600">${p.price.toLocaleString()} ₽</span>
                        <span class="text-xs bg-gray-200 px-2 py-1 rounded">👁 ${p.views} | Остаток: ${p.stock}</span>
                    </div>
                    <button onclick="addToCart(${p.id}, '${p.title.replace(/'/g, "\\'")}', ${p.price})" 
                            class="w-full btn-primary text-white py-2 rounded-lg hover:opacity-90 transition">
                        <i class="fas fa-cart-plus mr-2"></i>В корзину
                    </button>
                    <button onclick="showRecommendations(${p.id}, '${p.category}')" 
                            class="w-full mt-2 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition text-sm">
                        <i class="fas fa-lightbulb mr-2"></i>Похожие товары
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Ошибка:', error);
        document.getElementById('products-grid').innerHTML = '<p class="text-red-500 col-span-4 text-center py-12">Ошибка загрузки каталога</p>';
    }
}

async function showRecommendations(productId, category) {
    try {
        const response = await fetch(`${API_BASE}/products/recommendations?category=${category}&exclude_id=${productId}`);
        if (!response.ok) throw new Error('Ошибка загрузки рекомендаций');
        
        const recommendations = await response.json();
        const grid = document.getElementById('products-grid');
        
        if (recommendations.length === 0) {
            alert('Похожих товаров не найдено');
            return;
        }

        grid.innerHTML = `
            <div class="col-span-4 mb-4">
                <button onclick="loadProducts()" class="text-purple-600 hover:underline font-medium">
                    <i class="fas fa-arrow-left mr-2"></i>Назад ко всем товарам
                </button>
                <h3 class="text-xl font-bold mt-4">Похожие товары в категории "${getCategoryName(category)}"</h3>
            </div>
        ` + recommendations.map(p => `
            <div class="product-card bg-white rounded-lg shadow overflow-hidden">
                <div class="h-48 bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                    <i class="fas fa-box text-6xl text-purple-300"></i>
                </div>
                <div class="p-4">
                    <h3 class="font-bold text-lg mb-2 truncate">${p.title}</h3>
                    <p class="text-gray-500 text-sm mb-3 h-10 overflow-hidden">${p.description || 'Нет описания'}</p>
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-2xl font-bold text-purple-600">${p.price.toLocaleString()} ₽</span>
                        <span class="text-xs bg-gray-200 px-2 py-1 rounded">Остаток: ${p.stock}</span>
                    </div>
                    <button onclick="addToCart(${p.id}, '${p.title.replace(/'/g, "\\'")}', ${p.price})" 
                            class="w-full btn-primary text-white py-2 rounded-lg hover:opacity-90 transition">
                        <i class="fas fa-cart-plus mr-2"></i>В корзину
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        alert('Ошибка загрузки рекомендаций');
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
    document.querySelectorAll('.category-card').forEach(card => {
        card.classList.remove('ring-2', 'ring-purple-500', 'bg-purple-50');
    });
    event.currentTarget.classList.add('ring-2', 'ring-purple-500', 'bg-purple-50');
    if (currentUser) loadProducts();
}

async function handleAddProduct(event) {
    event.preventDefault();
    const title = document.getElementById('product-title').value;
    const description = document.getElementById('product-description').value;
    const price = parseFloat(document.getElementById('product-price').value);
    const stock = parseInt(document.getElementById('product-stock').value);
    const category = document.getElementById('product-category').value;

    try {
        const response = await fetch(`${API_BASE}/products/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
            body: JSON.stringify({ title, description, price, stock, category })
        });

        if (!response.ok) {
            const error = await response.json();
            alert(error.detail || 'Ошибка');
            return;
        }

        alert('Товар добавлен!');
        closeModal('add-product-modal');
        loadProducts();
        event.target.reset();
    } catch (error) {
        alert('Ошибка сети');
    }
}

// === Корзина ===
function addToCart(productId, title, price) {
    const existingItem = cart.find(item => item.product_id === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ product_id: productId, title, price, quantity: 1 });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    
    const cartIcon = document.querySelector('.fa-shopping-cart');
    cartIcon.classList.add('text-purple-600', 'scale-110');
    setTimeout(() => cartIcon.classList.remove('text-purple-600', 'scale-110'), 300);
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
                    <div class="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded flex items-center justify-center">
                        <i class="fas fa-box text-3xl text-purple-300"></i>
                    </div>
                    <div>
                        <h3 class="font-bold">${item.title}</h3>
                        <p class="text-gray-500">${item.price.toLocaleString()} ₽ / шт.</p>
                    </div>
                </div>
                <div class="flex items-center space-x-6">
                    <div class="flex items-center space-x-2 border rounded-lg bg-gray-50">
                        <button onclick="changeQuantity(${item.product_id}, -1)" class="px-3 py-1 text-gray-600 hover:bg-gray-200 rounded-l-lg font-bold">−</button>
                        <span class="px-2 font-bold min-w-[20px] text-center">${item.quantity}</span>
                        <button onclick="changeQuantity(${item.product_id}, 1)" class="px-3 py-1 text-gray-600 hover:bg-gray-200 rounded-r-lg font-bold">+</button>
                    </div>
                    <span class="text-xl font-bold text-purple-600 min-w-[100px] text-right">${itemTotal.toLocaleString()} ₽</span>
                    <button onclick="removeFromCart(${item.product_id})" class="text-red-400 hover:text-red-600 p-2" title="Удалить полностью">
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
    if (item.quantity <= 0) {
        cart = cart.filter(i => i.product_id !== productId);
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.product_id !== productId);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
}

async function checkout() {
    if (cart.length === 0) {
        alert('Корзина пуста');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/orders/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
            body: JSON.stringify({ items: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity })) })
        });

        if (!response.ok) {
            const error = await response.json();
            alert(error.detail || 'Ошибка оформления заказа');
            return;
        }

        alert('Заказ успешно оформлен! Чек отправлен на email.');
        cart = [];
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        showOrders(); // Перенаправляем сразу в заказы
    } catch (error) {
        alert('Ошибка сети');
    }
}

function logout() {
    currentToken = null;
    currentUser = null;
    localStorage.removeItem('token');
    document.getElementById('nav-auth').classList.remove('hidden');
    document.getElementById('nav-links').classList.add('hidden'); // Скрываем навигацию
    document.getElementById('nav-user').classList.add('hidden');
    document.getElementById('nav-user').classList.remove('flex');
    goHome(); // Возвращаем на главную
}