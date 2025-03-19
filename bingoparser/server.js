require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { fetchCoinData, analyzeCoinData } = require('./utils/analyzer');

const app = express();
const PORT = process.env.PORT || 8000;

// Security middleware
app.use(helmet());

// Rate limiting
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Слишком много попыток входа. Попробуйте позже.'
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30 // 30 requests per minute
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Validation middleware
const validateUser = [
    body('username').trim().isLength({ min: 3 }).escape(),
    body('password').isLength({ min: 6 })
];

const validateApiKeys = [
    body('apiKey').trim().notEmpty(),
    body('apiSecret').trim().notEmpty()
];

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/');
    }
}

function requireAdmin(req, res, next) {
    if (req.session.user && req.session.user.isAdmin) {
        next();
    } else {
        res.status(403).redirect('/dashboard');
    }
}

// Database operations
async function loadUsers() {
    try {
        const usersPath = path.join(__dirname, 'users.json');
        const data = await fs.readFile(usersPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading users:', error);
        throw new Error('Ошибка загрузки пользователей');
    }
}

async function saveUsers(users) {
    try {
        const usersPath = path.join(__dirname, 'users.json');
        await fs.writeFile(usersPath, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error saving users:', error);
        throw new Error('Ошибка сохранения пользователей');
    }
}

async function saveConfig(config) {
    try {
        const configPath = path.join(__dirname, 'config.json');
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error saving config:', error);
        throw new Error('Ошибка сохранения конфигурации');
    }
}

// Routes
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/dashboard');
    } else {
        res.render('login', { error: null });
    }
});

app.post('/login', loginLimiter, validateUser, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('login', { error: 'Неверные данные для входа' });
        }

        const { username, password } = req.body;
        const users = await loadUsers();
        const user = users.find(u => u.username === username);
        
        if (!user) {
            return res.render('login', { error: 'Неверное имя пользователя или пароль' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (passwordMatch) {
            req.session.user = {
                username: user.username,
                isAdmin: user.isAdmin
            };
            return res.redirect('/dashboard');
        }

        res.render('login', { error: 'Неверное имя пользователя или пароль' });
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', { error: 'Произошла ошибка при входе' });
    }
});

app.get('/dashboard', requireAuth, apiLimiter, async (req, res) => {
    try {
        const coinData = await fetchCoinData();
        const analyzedData = analyzeCoinData(coinData);
        res.render('dashboard', { 
            user: req.session.user,
            coins: analyzedData,
            error: null
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.render('dashboard', { 
            user: req.session.user,
            coins: [],
            error: 'Ошибка загрузки данных'
        });
    }
});

app.get('/admin', requireAdmin, (req, res) => {
    res.render('admin', { 
        user: req.session.user,
        error: null,
        success: null
    });
});

app.post('/admin/create-user', requireAdmin, validateUser, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('admin', { 
                user: req.session.user,
                error: 'Неверные данные пользователя',
                success: null
            });
        }

        const { username, password, isAdmin } = req.body;
        const users = await loadUsers();
        
        if (users.find(u => u.username === username)) {
            return res.render('admin', {
                user: req.session.user,
                error: 'Пользователь уже существует',
                success: null
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        users.push({
            username,
            password: hashedPassword,
            isAdmin: isAdmin === 'on'
        });

        await saveUsers(users);
        res.render('admin', {
            user: req.session.user,
            error: null,
            success: 'Пользователь успешно создан'
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.render('admin', {
            user: req.session.user,
            error: 'Ошибка создания пользователя',
            success: null
        });
    }
});

app.post('/admin/update-api-keys', requireAdmin, validateApiKeys, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('admin', {
                user: req.session.user,
                error: 'Неверные API ключи',
                success: null
            });
        }

        const { apiKey, apiSecret } = req.body;
        const config = { bingx: { apiKey, apiSecret } };
        await saveConfig(config);
        
        res.render('admin', {
            user: req.session.user,
            error: null,
            success: 'API ключи успешно обновлены'
        });
    } catch (error) {
        console.error('Update API keys error:', error);
        res.render('admin', {
            user: req.session.user,
            error: 'Ошибка обновления API ключей',
            success: null
        });
    }
});

app.get('/refresh-data', requireAuth, apiLimiter, async (req, res) => {
    try {
        const coinData = await fetchCoinData();
        const analyzedData = analyzeCoinData(coinData);
        res.json(analyzedData);
    } catch (error) {
        console.error('Refresh data error:', error);
        res.status(500).json({ error: 'Ошибка обновления данных' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).render('error', {
        error: 'Произошла внутренняя ошибка сервера'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});