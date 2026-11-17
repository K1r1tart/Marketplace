const API_BASE = '';
let currentToken = localStorage.getItem('token');
let isLoginMode = true;

// Проверка авторизации при загрузке
document.addEventListener('DOMContentLoaded', () => {
    if (currentToken) {
        loadUserProfile();
    }
});

function showLoginModal() {
    document.getElementById('auth-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('auth-modal').classList.add('hidden');
    document.getElementById('auth-form').reset();
}

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

async function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;

    const endpoint = isLoginMode ? '/auth/login-json' : '/auth/register';
    const body = isLoginMode ? { email, password } : { email, password, role };

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json();
            alert(error.detail || 'Ошибка');
            return;
        }

        const data = await response.json();

        if (isLoginMode) {
            currentToken = data.access_token;
            localStorage.setItem('token', currentToken);
            closeModal();
            loadUserProfile();
        } else {
            alert('Регистрация успешна! Теперь войдите.');
            toggleAuthMode();
        }
    } catch (error) {
        alert('Ошибка сети');
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

        const user = await response.json();
        document.getElementById('nav-auth').classList.add('hidden');
        document.getElementById('nav-user').classList.remove('hidden');
        document.getElementById('nav-user').classList.add('flex');
        document.getElementById('user-email').textContent = user.email;
        document.getElementById('user-role').textContent = user.role;

        document.getElementById('welcome-section').classList.add('hidden');
        document.getElementById('catalog-section').classList.remove('hidden');

        loadMockProducts();
    } catch (error) {
        logout();
    }
}

async function loadMockProducts() {
    try {
        const response = await fetch(`${API_BASE}/products`);
        if (!response.ok) throw new Error('Ошибка загрузки товаров');
        
        const products = await response.json();
        const grid = document.getElementById('products-grid');
        
        if (products.length === 0) {
            grid.innerHTML = '<p class="col-span-3 text-center text-gray-500">Товаров пока нет. Добавьте первый через Swagger или API!</p>';
            return;
        }

        grid.innerHTML = products.map(p => `
            <div class="bg-white rounded-lg shadow p-6 hover:shadow-xl transition-shadow">
                <div class="text-6xl text-center mb-4">📦</div>
                <h3 class="font-bold text-lg mb-2 truncate" title="${p.title}">${p.title}</h3>
                <p class="text-gray-500 text-sm mb-4 h-10 overflow-hidden">${p.description || 'Нет описания'}</p>
                <div class="flex justify-between items-center mb-4">
                    <span class="text-xl font-bold text-blue-600">${p.price} ₽</span>
                    <span class="text-xs bg-gray-200 px-2 py-1 rounded">Остаток: ${p.stock}</span>
                </div>
                <button class="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors">
                    В корзину
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Ошибка:', error);
        document.getElementById('products-grid').innerHTML = '<p class="text-red-500">Ошибка загрузки каталога</p>';
    }
}

function logout() {
    currentToken = null;
    localStorage.removeItem('token');
    document.getElementById('nav-auth').classList.remove('hidden');
    document.getElementById('nav-user').classList.add('hidden');
    document.getElementById('nav-user').classList.remove('flex');
    document.getElementById('welcome-section').classList.remove('hidden');
    document.getElementById('catalog-section').classList.add('hidden');
}