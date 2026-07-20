// Firebase конфигурация
const firebaseConfig = {
    apiKey: "AIzaSyDoI8OK441KwmcoXNFVbswBbgNZvoELMto",
    authDomain: "detective-game-for-dnd-session.firebaseapp.com",
    databaseURL: "https://detective-game-for-dnd-session-default-rtdb.firebaseio.com",
    projectId: "detective-game-for-dnd-session",
    storageBucket: "detective-game-for-dnd-session.firebasestorage.app",
    messagingSenderId: "371582003659",
    appId: "1:371582003659:web:c9ab6512d3ff5fa3f6ee4e"
};

// Инициализация Firebase с проверкой
let database;
let firebaseReady = false;

try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    firebaseReady = true;
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
    // Fallback к localStorage если Firebase не работает
    firebaseReady = false;
}

// Уникальный ID комнаты
const ROOM_ID = 'default-room';

// Глобальные переменные
let playerName = '';
let playerRole = '';
let players = [];
let turnOrder = [];
let currentTurnIndex = 0;
let gameStarted = false;
let cardsDealt = false;
let firstCardDrawn = false;
let playerMadeAction = false;
let lastLocalUpdate = null;

// Карты
let deck = [];
let discardPile = [];
let tableCards = [];
let playerHands = {};
let cardStates = {};
const TRAP_CARDS = Array.from({length: 13}, (_, i) => i + 20);
const FIRST_CARD = 1;

// Тест
const testQuestions = [
    {
        question: "Вопрос 1: Кто был в библиотеке?",
        options: {a: "Дворецкий", b: "Горничная", c: "Садовник", d: "Гость"},
        correct: "a"
    },
    {
        question: "Вопрос 2: Какое орудие преступления?",
        options: {a: "Нож", b: "Подсвечник", c: "Веревка", d: "Револьвер"},
        correct: "b"
    },
    {
        question: "Вопрос 3: Время преступления?",
        options: {a: "8:00", b: "10:30", c: "12:00", d: "22:00"},
        correct: "d"
    },
    {
        question: "Вопрос 4: Где был найден ключ?",
        options: {a: "В саду", b: "В столовой", c: "В спальне", d: "В кабинете"},
        correct: "a"
    },
    {
        question: "Вопрос 5: Какая была погода?",
        options: {a: "Солнечно", b: "Дождливо", c: "Снежно", d: "Туман"},
        correct: "b"
    },
    {
        question: "Вопрос 6: Кто позвонил в полицию?",
        options: {a: "Миссис Пикок", b: "Профессор Плам", c: "Мисс Скарлет", d: "Полковник Мустард"},
        correct: "c"
    },
    {
        question: "Вопрос 7: Что было украдено?",
        options: {a: "Картина", b: "Драгоценности", c: "Документы", d: "Деньги"},
        correct: "b"
    },
    {
        question: "Вопрос 8: Как преступник проник?",
        options: {a: "Через дверь", b: "Через окно", c: "Через подвал", d: "Через крышу"},
        correct: "b"
    },
    {
        question: "Вопрос 9: Кто видел подозрительное?",
        options: {a: "Повар", b: "Шофер", c: "Сосед", d: "Почтальон"},
        correct: "a"
    },
    {
        question: "Вопрос 10: Где спрятано орудие?",
        options: {a: "В камине", b: "В пруду", c: "За книжной полкой", d: "Под кроватью"},
        correct: "c"
    }
];

// Система уведомлений
let notificationTimeout = null;

function showNotification(message, type = 'info') {
    const oldNotification = document.querySelector('.game-notification');
    if (oldNotification) {
        oldNotification.remove();
    }
    
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }
    
    const notification = document.createElement('div');
    notification.className = `game-notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    
    notificationTimeout = setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Функции для работы с данными
function loadGameStateFirebase() {
    return new Promise((resolve, reject) => {
        if (!firebaseReady || !database) {
            reject(new Error('Firebase not ready'));
            return;
        }
        
        database.ref(`rooms/${ROOM_ID}/gameState`).once('value')
            .then((snapshot) => {
                const state = snapshot.val();
                resolve(state);
            })
            .catch((error) => {
                console.error('Firebase load error:', error);
                reject(error);
            });
    });
}

function saveGameStateFirebase() {
    if (!firebaseReady || !database) return;
    
    const state = {
        playerName,
        playerRole,
        players,
        turnOrder,
        currentTurnIndex,
        gameStarted,
        cardsDealt,
        firstCardDrawn,
        deck,
        discardPile,
        tableCards,
        playerHands,
        cardStates,
        playerMadeAction,
        gameEnded: false,
        lastUpdated: firebase.database.ServerValue.TIMESTAMP
    };
    
    lastLocalUpdate = Date.now();
    database.ref(`rooms/${ROOM_ID}/gameState`).set(state)
        .catch(error => console.error('Firebase save error:', error));
}

function saveToLocalStorage() {
    const state = {
        playerName,
        playerRole,
        players,
        turnOrder,
        currentTurnIndex,
        gameStarted,
        cardsDealt,
        firstCardDrawn,
        deck,
        discardPile,
        tableCards,
        playerHands,
        cardStates,
        playerMadeAction,
        gameEnded: false
    };
    localStorage.setItem('detectiveGame', JSON.stringify(state));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('detectiveGame');
    if (saved) {
        const state = JSON.parse(saved);
        if (!state.gameEnded) {
            return state;
        }
    }
    return null;
}

function subscribeToGameUpdates() {
    if (!firebaseReady || !database) return;
    
    database.ref(`rooms/${ROOM_ID}/gameState`).on('value', (snapshot) => {
        const state = snapshot.val();
        if (!state || state.gameEnded) return;
        
        if (state.lastUpdated && lastLocalUpdate && 
            state.lastUpdated <= lastLocalUpdate) return;
        
        if (playerName && state.gameStarted) {
            players = state.players || [];
            turnOrder = state.turnOrder || [];
            currentTurnIndex = state.currentTurnIndex || 0;
            gameStarted = state.gameStarted;
            cardsDealt = state.cardsDealt || false;
            firstCardDrawn = state.firstCardDrawn || false;
            deck = state.deck || [];
            discardPile = state.discardPile || [];
            tableCards = state.tableCards || [];
            playerHands = state.playerHands || {};
            cardStates = state.cardStates || {};
            playerMadeAction = state.playerMadeAction || false;
            
            updateGameUI();
        } else if (playerName && !state.gameStarted) {
            players = state.players || [];
            updateLobbyUI();
        }
    }, (error) => {
        console.error('Firebase subscription error:', error);
    });
}

// Инициализация
async function init() {
    console.log('Init started, Firebase ready:', firebaseReady);
    
    let saved = null;
    
    // Пробуем загрузить из Firebase
    if (firebaseReady) {
        try {
            saved = await loadGameStateFirebase();
        } catch (error) {
            console.log('Failed to load from Firebase, trying localStorage');
        }
    }
    
    // Если Firebase не сработал, пробуем localStorage
    if (!saved) {
        saved = loadFromLocalStorage();
    }
    
    // Восстанавливаем состояние
    if (saved && saved.gameStarted && !saved.gameEnded) {
        restoreState(saved);
        showGamePage();
    } else if (saved && saved.playerName && !saved.gameStarted) {
        restoreState(saved);
        showLobbyPage();
        updateLobbyUI();
    } else {
        showLoginPage();
    }
    
    // Подписываемся на обновления Firebase
    if (firebaseReady) {
        subscribeToGameUpdates();
    }
}

function restoreState(state) {
    playerName = state.playerName || '';
    playerRole = state.playerRole || '';
    players = state.players || [];
    turnOrder = state.turnOrder || [];
    currentTurnIndex = state.currentTurnIndex || 0;
    gameStarted = state.gameStarted || false;
    cardsDealt = state.cardsDealt || false;
    firstCardDrawn = state.firstCardDrawn || false;
    deck = state.deck || [];
    discardPile = state.discardPile || [];
    tableCards = state.tableCards || [];
    playerHands = state.playerHands || {};
    cardStates = state.cardStates || {};
    playerMadeAction = state.playerMadeAction || false;
}

function saveGameState() {
    if (firebaseReady) {
        saveGameStateFirebase();
    }
    saveToLocalStorage();
}

// Навигация
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.add('active');
    }
}

function showLoginPage() {
    showPage('login-page');
    const input = document.getElementById('playerName');
    if (input) input.value = '';
}

function showLobbyPage() {
    showPage('lobby-page');
    updateLobbyUI();
}

function showGamePage() {
    showPage('game-page');
    updateGameUI();
}

// Страница входа
function joinGame() {
    const nameInput = document.getElementById('playerName');
    if (!nameInput) {
        console.error('Input not found');
        return;
    }
    
    const name = nameInput.value.trim();
    
    if (!name) {
        showNotification('Пожалуйста, введите имя', 'error');
        return;
    }
    
    playerName = name;
    
    if (!players.includes(name)) {
        players.push(name);
    }
    
    if (players.length === 1) {
        gameStarted = false;
        cardsDealt = false;
        firstCardDrawn = false;
        deck = [];
        discardPile = [];
        tableCards = [];
        playerHands = {};
        cardStates = {};
        turnOrder = [];
        currentTurnIndex = 0;
        playerMadeAction = false;
    }
    
    saveGameState();
    showLobbyPage();
    showNotification(`Добро пожаловать, ${name}!`, 'success');
}

function leaveGame() {
    players = players.filter(p => p !== playerName);
    
    if (players.length === 0 && firebaseReady) {
        database.ref(`rooms/${ROOM_ID}`).remove();
    } else {
        saveGameState();
    }
    
    playerName = '';
    playerRole = '';
    
    showLoginPage();
    showNotification('Вы покинули игру', 'info');
}

// Страница лобби
function selectRole(role) {
    playerRole = role;
    
    document.querySelectorAll('.role-btn').forEach(btn => btn.classList.remove('selected'));
    const roleBtn = document.getElementById(role + 'Role');
    if (roleBtn) roleBtn.classList.add('selected');
    
    const selectedRoleEl = document.getElementById('selectedRole');
    if (selectedRoleEl) {
        selectedRoleEl.textContent = `Выбрана роль: ${role === 'player' ? 'Игрок' : role === 'master' ? 'Мастер' : 'Мастер+Игрок'}`;
    }
    
    saveGameState();
}

function updateLobbyUI() {
    const nameDisplay = document.getElementById('playerNameDisplay');
    if (nameDisplay) nameDisplay.textContent = `Игрок: ${playerName}`;
    
    if (playerRole) {
        const selectedRoleEl = document.getElementById('selectedRole');
        if (selectedRoleEl) {
            selectedRoleEl.textContent = 
                `Выбрана роль: ${playerRole === 'player' ? 'Игрок' : playerRole === 'master' ? 'Мастер' : 'Мастер+Игрок'}`;
        }
        const roleBtn = document.getElementById(playerRole + 'Role');
        if (roleBtn) roleBtn.classList.add('selected');
    }
    
    updatePlayersList();
}

function updatePlayersList() {
    const listDiv = document.getElementById('playersList');
    if (listDiv) {
        listDiv.innerHTML = '<h3>Игроки в лобби:</h3>' + 
            players.map(p => `<div>• ${p}${p === playerName ? ' (Вы)' : ''}</div>`).join('');
    }
}

function shuffleTurnOrder() {
    if (players.length < 2) {
        showNotification('Недостаточно игроков для перемешивания', 'error');
        return;
    }
    
    turnOrder = [...players].sort(() => Math.random() - 0.5);
    
    const orderDiv = document.getElementById('turnOrder');
    if (orderDiv) {
        orderDiv.innerHTML = '<h3>Порядок ходов:</h3>' + 
            turnOrder.map((p, i) => `<div>${i + 1}. ${p}</div>`).join('');
    }
    
    showNotification('Порядок ходов перемешан!', 'success');
    saveGameState();
}

function startGame() {
    if (!playerRole) {
        showNotification('Пожалуйста, выберите роль', 'error');
        return;
    }
    
    showConfirmModal('Все игроки точно собраны?', () => {
        gameStarted = true;
        initializeDeck();
        
        if (turnOrder.length === 0) {
            turnOrder = [...players];
        }
        
        currentTurnIndex = 0;
        playerMadeAction = false;
        
        saveGameState();
        showGamePage();
    });
}

function initializeDeck() {
    deck = Array.from({length: 31}, (_, i) => i + 2);
    deck.sort(() => Math.random() - 0.5);
    
    cardStates = {};
    for (let i = 1; i <= 32; i++) {
        cardStates[i] = {onTable: false, owner: null};
    }
    
    playerHands = {};
    players.forEach(p => {
        playerHands[p] = [];
    });
    
    discardPile = [];
    tableCards = [];
    cardsDealt = false;
    firstCardDrawn = false;
    playerMadeAction = false;
    
    placeFirstCard();
}

function placeFirstCard() {
    tableCards.push(FIRST_CARD);
    cardStates[FIRST_CARD].onTable = true;
    firstCardDrawn = true;
}

// Игровая страница
function updateGameUI() {
    const isMasterRole = isMaster();
    const isPlayerRole = isPlayer();
    
    const masterControls = document.getElementById('masterDeckControls');
    const masterView = document.getElementById('masterViewArea');
    const endGameBtn = document.getElementById('endGameBtn');
    const playerHand = document.getElementById('playerHandArea');
    
    if (masterControls) masterControls.style.display = isMasterRole ? 'flex' : 'none';
    if (masterView) masterView.style.display = isMasterRole ? 'block' : 'none';
    if (endGameBtn) endGameBtn.style.display = isMasterRole ? 'inline-block' : 'none';
    if (playerHand) playerHand.style.display = isPlayerRole ? 'block' : 'none';
    
    updateTurnIndicator();
    updateDeckDisplay();
    updateTableDisplay();
    updateHandDisplay();
    updateDiscardDisplay();
    updateMasterButtons();
}

function updateMasterButtons() {
    const shuffleBtn = document.querySelector('.deck-btn[onclick="shuffleDeck()"]');
    const dealBtn = document.querySelector('.deck-btn[onclick="dealCards()"]');
    
    if (shuffleBtn) {
        if (cardsDealt) {
            shuffleBtn.disabled = true;
            shuffleBtn.style.opacity = '0.5';
            shuffleBtn.style.cursor = 'not-allowed';
        } else {
            shuffleBtn.disabled = false;
            shuffleBtn.style.opacity = '1';
            shuffleBtn.style.cursor = 'pointer';
        }
    }
    
    if (dealBtn) {
        if (cardsDealt) {
            dealBtn.classList.add('shake');
            dealBtn.style.background = '#f44336';
            dealBtn.textContent = '🎴 Карты розданы';
        } else {
            dealBtn.classList.remove('shake');
            dealBtn.style.background = '#4CAF50';
            dealBtn.textContent = '🎴 Раздать';
        }
    }
}

function updateTurnIndicator() {
    const indicator = document.getElementById('currentPlayerTurn');
    if (!indicator) return;
    
    if (turnOrder.length > 0 && currentTurnIndex < turnOrder.length) {
        const currentPlayer = turnOrder[currentTurnIndex];
        indicator.textContent = `Ходит: ${currentPlayer} ${currentPlayer === playerName ? '(Вы)' : ''}`;
    } else if (turnOrder.length > 0) {
        indicator.textContent = 'Ожидание игроков...';
    }
}

function updateDeckDisplay() {
    const deckCount = document.getElementById('deckCount');
    if (deckCount) deckCount.textContent = deck.length;
    
    const deckStack = document.querySelector('.deck-stack');
    if (deckStack && firstCardDrawn) {
        deckStack.style.boxShadow = '0 0 15px rgba(76, 175, 80, 0.8)';
        deckStack.style.border = '2px solid #4CAF50';
    }
}

function updateTableDisplay() {
    const container = document.getElementById('tableCardsContainer');
    if (!container) return;
    
    container.innerHTML = tableCards.map(cardId => {
        return `<div class="card-in-grid" onclick="viewTableCard(${cardId})">
            <img src="cards/${String(cardId).padStart(2, '0')}.png" 
                 alt="Карта ${cardId}" 
                 class="card-img" 
                 style="width: 139px; height: 228px;"
                 onerror="this.src='cards/cover.png'">
        </div>`;
    }).join('');
}

function updateHandDisplay() {
    const isPlayerRole = playerRole === 'player' || playerRole === 'both';
    if (!isPlayerRole) return;
    
    const hand = playerHands[playerName] || [];
    const container = document.getElementById('handCardsContainer');
    const handCount = document.getElementById('handCount');
    
    if (handCount) handCount.textContent = hand.length;
    if (!container) return;
    
    if (hand.length === 0) {
        container.innerHTML = '<div class="empty-hand">У вас пока нет карт</div>';
    } else {
        container.innerHTML = hand.map((cardId) => {
            return `<div class="card-in-hand" onclick="viewHandCard(${cardId})">
                <img src="cards/${String(cardId).padStart(2, '0')}.png" 
                     alt="Карта ${cardId}" 
                     class="card-img" 
                     style="width: 120px; height: 197px;"
                     onerror="this.src='cards/cover.png'">
            </div>`;
        }).join('');
    }
    
    const endTurnBtn = document.getElementById('endTurnBtn');
    const statusIndicator = document.getElementById('turnStatus');
    
    if (isMyTurn()) {
        if (playerMadeAction) {
            if (endTurnBtn) endTurnBtn.style.display = 'block';
            if (statusIndicator) {
                statusIndicator.textContent = 'Вы сделали ход';
                statusIndicator.style.color = '#4CAF50';
            }
        } else {
            if (endTurnBtn) endTurnBtn.style.display = 'none';
            if (statusIndicator) {
                statusIndicator.textContent = 'Выберите карту для хода';
                statusIndicator.style.color = '#ffd700';
            }
        }
    } else {
        if (endTurnBtn) endTurnBtn.style.display = 'none';
        if (statusIndicator) {
            statusIndicator.textContent = 'Ожидайте своего хода';
            statusIndicator.style.color = '#888';
        }
    }
}

function updateDiscardDisplay() {
    const discardCountElement = document.getElementById('discardCount');
    const discardPileElement = document.getElementById('discardPile');
    
    if (discardCountElement) {
        discardCountElement.textContent = discardPile.length;
    }
    
    if (discardPileElement) {
        if (discardPile.length > 0) {
            discardPileElement.innerHTML = `
                <img src="cards/cover.png" 
                     alt="Сброс" 
                     class="card-img" 
                     style="width: 100px; height: 164px;"
                     onerror="this.src='cards/cover.png'">
                <div class="discard-count-badge">${discardPile.length}</div>
            `;
            discardPileElement.style.border = '2px solid #ffd700';
        } else {
            discardPileElement.innerHTML = '<div class="discard-placeholder">Стопка сброса</div>';
            discardPileElement.style.border = '2px dashed #ffd700';
        }
    }
}

function isMyTurn() {
    if (turnOrder.length === 0) return false;
    return turnOrder[currentTurnIndex] === playerName;
}

// Действия мастера
function shuffleDeck() {
    if (!isMaster()) return;
    if (cardsDealt) {
        showNotification('Нельзя перемешать колоду после раздачи', 'error');
        return;
    }
    
    deck.sort(() => Math.random() - 0.5);
    
    const deckElement = document.querySelector('.deck-stack');
    if (deckElement) {
        deckElement.classList.add('shuffle-animation');
        setTimeout(() => deckElement.classList.remove('shuffle-animation'), 1000);
    }
    
    saveGameState();
    updateDeckDisplay();
    showNotification('Колода перемешана!', 'success');
}

function dealCards() {
    if (!isMaster()) return;
    
    if (cardsDealt) {
        const dealBtn = document.querySelector('.deck-btn[onclick="dealCards()"]');
        if (dealBtn) {
            dealBtn.classList.add('shake');
            setTimeout(() => dealBtn.classList.remove('shake'), 1000);
        }
        showNotification('Карты уже были розданы!', 'error');
        return;
    }
    
    if (deck.length < players.length * 3) {
        showNotification('Недостаточно карт в колоде для раздачи', 'error');
        return;
    }
    
    players.forEach(player => {
        playerHands[player] = [];
        for (let i = 0; i < 3; i++) {
            const card = deck.pop();
            playerHands[player].push(card);
            cardStates[card].owner = player;
        }
    });
    
    cardsDealt = true;
    saveGameState();
    updateGameUI();
    showNotification('Карты розданы!', 'success');
}

function drawFirstCard() {
    if (!isMaster()) return;
    if (firstCardDrawn) {
        showNotification('Первая карта уже на столе!', 'info');
        return;
    }
    
    firstCardDrawn = true;
    placeFirstCard();
    
    saveGameState();
    updateGameUI();
    showNotification('Первая карта выложена на стол', 'success');
}

function masterDrawCard() {
    if (!isMaster()) return;
    if (deck.length === 0) {
        showNotification('Колода пуста', 'error');
        return;
    }
    
    const card = deck.pop();
    tableCards.push(card);
    cardStates[card].onTable = true;
    
    saveGameState();
    updateGameUI();
}

// Просмотр карт
function viewTableCard(cardId) {
    showCardModal(cardId, false);
}

function viewHandCard(cardId) {
    const isPlayerRole = playerRole === 'player' || playerRole === 'both';
    if (!isPlayerRole) return;
    
    const hand = playerHands[playerName] || [];
    if (hand.includes(cardId)) {
        showCardModal(cardId, true);
    }
}

function showCardModal(cardId, showActions = false) {
    const modal = document.getElementById('cardModal');
    const image = document.getElementById('cardModalImage');
    const actions = document.getElementById('cardModalActions');
    
    if (!modal || !image || !actions) return;
    
    image.src = `cards/${String(cardId).padStart(2, '0')}.png`;
    image.onerror = () => { image.src = 'cards/cover.png'; };
    
    actions.innerHTML = '';
    
    if (showActions) {
        if (isMyTurn()) {
            if (playerMadeAction) {
                actions.innerHTML = '<p style="color: #ff9800;">Вы уже сделали ход в этом раунде</p>';
            } else {
                actions.innerHTML = `
                    <button onclick="playCard(${cardId})" class="modal-btn confirm-btn">Выложить на стол</button>
                    <button onclick="discardCard(${cardId})" class="modal-btn cancel-btn">Сбросить</button>
                `;
            }
        } else {
            actions.innerHTML = '<p style="color: #666;">Сейчас не ваш ход</p>';
        }
    }
    
    modal.style.display = 'block';
}

function closeCardModal() {
    const modal = document.getElementById('cardModal');
    if (modal) modal.style.display = 'none';
}

function playCard(cardId) {
    closeCardModal();
    
    showConfirmModal('Вы уверены, что хотите выложить эту карту на стол?', () => {
        const hand = playerHands[playerName];
        const index = hand.indexOf(cardId);
        if (index > -1) {
            hand.splice(index, 1);
        }
        
        tableCards.push(cardId);
        cardStates[cardId].onTable = true;
        cardStates[cardId].owner = null;
        
        playerMadeAction = true;
        saveGameState();
        updateGameUI();
        showNotification('Карта выложена на стол', 'success');
    });
}

function discardCard(cardId) {
    closeCardModal();
    
    showConfirmModal('Вы уверены, что хотите сбросить эту карту?', () => {
        const hand = playerHands[playerName];
        const index = hand.indexOf(cardId);
        if (index > -1) {
            hand.splice(index, 1);
        }
        
        discardPile.push(cardId);
        cardStates[cardId].owner = null;
        
        playerMadeAction = true;
        saveGameState();
        updateGameUI();
        showNotification('Карта сброшена', 'info');
    });
}

function endTurn() {
    const isPlayerRole = playerRole === 'player' || playerRole === 'both';
    if (!isPlayerRole) return;
    
    if (!isMyTurn()) {
        showNotification('Сейчас не ваш ход', 'error');
        return;
    }
    
    if (!playerMadeAction) {
        showNotification('Сначала нужно сделать ход - выложить или сбросить карту', 'error');
        return;
    }
    
    if (deck.length > 0) {
        const hand = playerHands[playerName];
        const card = deck.pop();
        hand.push(card);
        cardStates[card].owner = playerName;
        showNotification('Вы добрали карту из колоды', 'info');
    }
    
    currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
    playerMadeAction = false;
    
    saveGameState();
    updateGameUI();
    showNotification(`Ход переходит к ${turnOrder[currentTurnIndex]}`, 'info');
}

// Просмотр мастера
function masterViewHands() {
    if (!isMaster()) return;
    
    const container = document.getElementById('masterViewContent');
    if (!container) return;
    
    container.innerHTML = '<h3>Руки игроков</h3>';
    
    players.forEach(player => {
        const hand = playerHands[player] || [];
        container.innerHTML += `
            <div style="margin-bottom: 20px;">
                <h4>${player} (${hand.length} карт)</h4>
                <div class="cards-grid">
                    ${hand.map(cardId => `
                        <div class="card-in-grid" onclick="viewMasterCard(${cardId})">
                            <img src="cards/${String(cardId).padStart(2, '0')}.png" 
                                 alt="Карта ${cardId}" 
                                 class="card-img" 
                                 style="width: 100px; height: 164px;"
                                 onerror="this.src='cards/cover.png'">
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
}

function masterViewDiscard() {
    if (!isMaster()) return;
    
    const container = document.getElementById('masterViewContent');
    if (!container) return;
    
    container.innerHTML = `<h3>Сброс (${discardPile.length} карт)</h3>
        <div class="cards-grid">
            ${discardPile.length > 0 ? discardPile.map(cardId => `
                <div class="card-in-grid" onclick="viewMasterCard(${cardId})">
                    <img src="cards/${String(cardId).padStart(2, '0')}.png" 
                         alt="Карта ${cardId}" 
                         class="card-img" 
                         style="width: 100px; height: 164px;"
                         onerror="this.src='cards/cover.png'">
                </div>
            `).join('') : '<p>Сброс пуст</p>'}
        </div>`;
}

function masterViewDeck() {
    if (!isMaster()) return;
    
    const container = document.getElementById('masterViewContent');
    if (!container) return;
    
    container.innerHTML = `<h3>Колода (${deck.length} карт)</h3>
        <div class="cards-grid">
            ${deck.map(cardId => `
                <div class="card-in-grid" onclick="viewMasterCard(${cardId})">
                    <img src="cards/${String(cardId).padStart(2, '0')}.png" 
                         alt="Карта ${cardId}" 
                         class="card-img" 
                         style="width: 100px; height: 164px;"
                         onerror="this.src='cards/cover.png'">
                </div>
            `).join('')}
        </div>`;
}

function viewMasterCard(cardId) {
    const modal = document.getElementById('cardModal');
    const image = document.getElementById('cardModalImage');
    const actions = document.getElementById('cardModalActions');
    
    if (!modal || !image || !actions) return;
    
    image.src = `cards/${String(cardId).padStart(2, '0')}.png`;
    image.onerror = () => { image.src = 'cards/cover.png'; };
    actions.innerHTML = '';
    
    modal.style.display = 'block';
}

// Завершение игры
function endGameWarning() {
    if (!isMaster()) return;
    
    showConfirmModal('Вы уверены, что хотите завершить игру?', () => {
        showConfirmModal('ТОЧНО завершить игру? Это действие нельзя отменить!', () => {
            showTest();
        });
    });
}

function showTest() {
    const modal = document.getElementById('testModal');
    const container = document.getElementById('testContainer');
    
    if (!modal || !container) return;
    
    container.innerHTML = testQuestions.map((q, i) => `
        <div style="margin-bottom: 20px;">
            <p><strong>${q.question}</strong></p>
            ${Object.entries(q.options).map(([key, value]) => `
                <label class="test-option" onclick="selectTestOption(this)">
                    <input type="radio" name="q${i}" value="${key}">
                    <span class="radio-custom"></span>
                    ${key}) ${value}
                </label>
            `).join('')}
        </div>
    `).join('');
    
    modal.style.display = 'block';
}

function selectTestOption(label) {
    const allLabels = label.parentElement.querySelectorAll('.test-option');
    allLabels.forEach(l => l.classList.remove('selected'));
    
    label.classList.add('selected');
    
    const radio = label.querySelector('input[type="radio"]');
    if (radio) {
        radio.checked = true;
    }
}

function submitTest() {
    let score = 0;
    
    testQuestions.forEach((q, i) => {
        const selected = document.querySelector(`input[name="q${i}"]:checked`);
        if (selected && selected.value === q.correct) {
            score += 2;
        }
    });
    
    let trapCardsOnTable = tableCards.filter(cardId => TRAP_CARDS.includes(cardId)).length;
    score -= trapCardsOnTable;
    
    let discardDeficit = Math.max(0, 6 - discardPile.length);
    score -= discardDeficit * 3;
    
    showResults(score);
    
    const testModal = document.getElementById('testModal');
    if (testModal) testModal.style.display = 'none';
}

function showResults(score) {
    const modal = document.getElementById('resultsModal');
    const container = document.getElementById('resultsContainer');
    
    if (!modal || !container) return;
    
    container.innerHTML = `
        <p>Игра завершена!</p>
        <p style="font-size: 2em; color: ${score >= 10 ? '#4CAF50' : score >= 5 ? '#FFA000' : '#f44336'};">
            Итоговый счет: ${score}
        </p>
        <p>Карт-ловушек на столе: ${tableCards.filter(cardId => TRAP_CARDS.includes(cardId)).length}</p>
        <p>Карт в сбросе: ${discardPile.length} ${discardPile.length < 6 ? `(не хватает ${6 - discardPile.length})` : ''}</p>
        <button onclick="finalizeGameEnd()" class="modal-btn confirm-btn" style="margin-top: 20px;">Вернуться в главное меню</button>
    `;
    
    modal.style.display = 'block';
}

function finalizeGameEnd() {
    const modal = document.getElementById('resultsModal');
    if (modal) modal.style.display = 'none';
    resetGame();
}

function closeResultsModal() {
    const modal = document.getElementById('resultsModal');
    if (modal) modal.style.display = 'none';
    resetGame();
}

function resetGame() {
    gameStarted = false;
    cardsDealt = false;
    firstCardDrawn = false;
    deck = [];
    discardPile = [];
    tableCards = [];
    playerHands = {};
    cardStates = {};
    currentTurnIndex = 0;
    turnOrder = [];
    playerName = '';
    playerRole = '';
    players = [];
    playerMadeAction = false;
    
    const state = { gameEnded: true };
    localStorage.setItem('detectiveGame', JSON.stringify(state));
    
    if (firebaseReady && database) {
        database.ref(`rooms/${ROOM_ID}/gameState`).set(state);
        database.ref(`rooms/${ROOM_ID}`).remove();
    }
    
    showLoginPage();
}

// Вспомогательные функции
function isMaster() {
    return playerRole === 'master' || playerRole === 'both';
}

function isPlayer() {
    return playerRole === 'player' || playerRole === 'both';
}

function showConfirmModal(message, onConfirm) {
    const cardModal = document.getElementById('cardModal');
    if (cardModal) cardModal.style.display = 'none';
    
    const modal = document.getElementById('confirmModal');
    const messageEl = document.getElementById('modalMessage');
    const confirmBtn = document.getElementById('modalConfirm');
    
    if (!modal || !messageEl || !confirmBtn) return;
    
    messageEl.textContent = message;
    
    confirmBtn.onclick = () => {
        modal.style.display = 'none';
        onConfirm();
    };
    
    modal.style.display = 'block';
    modal.style.zIndex = '2000';
}

function closeModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.style.display = 'none';
}

function toggleRules() {
    showInfoModal('Правила игры', `
        <h3>Правила детективной карточной игры</h3>
        <p>Здесь будут правила игры. Вы можете отредактировать этот текст.</p>
        <p>1. Каждый игрок получает по 3 карты.</p>
        <p>2. В свой ход игрок может выложить карту на стол или сбросить её.</p>
        <p>3. После действия игрок добирает карту из колоды.</p>
        <p>4. Карта 01 всегда лежит на столе лицом вверх.</p>
    `);
}

function toggleBackstory() {
    showInfoModal('Предыстория', `
        <h3>Предыстория</h3>
        <p>Здесь будет предыстория игры. Вы можете отредактировать этот текст.</p>
        <p>Таинственное убийство произошло в старом особняке...</p>
    `);
}

function showInfoModal(title, content) {
    const modal = document.getElementById('infoModal');
    const textEl = document.getElementById('infoModalText');
    
    if (!modal || !textEl) return;
    
    textEl.innerHTML = `<h2>${title}</h2>${content}`;
    modal.style.display = 'block';
}

function closeInfoModal() {
    const modal = document.getElementById('infoModal');
    if (modal) modal.style.display = 'none';
}

function toggleHand() {
    const handContent = document.getElementById('handContent');
    if (handContent) {
        handContent.classList.toggle('show');
    }
}

// Закрытие модальных окон при клике вне их
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Запуск при загрузке
window.onload = function() {
    console.log('Page loaded, starting init...');
    init().catch(error => {
        console.error('Init error:', error);
        // Если Firebase не работает, пробуем localStorage
        const saved = loadFromLocalStorage();
        if (saved && saved.playerName) {
            restoreState(saved);
            if (saved.gameStarted) {
                showGamePage();
            } else {
                showLobbyPage();
            }
        } else {
            showLoginPage();
        }
    });
};
