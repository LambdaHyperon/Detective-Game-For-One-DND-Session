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

// Инициализация Firebase
let database;
let firebaseReady = false;

try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    firebaseReady = true;
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
    firebaseReady = false;
}

const ROOM_ID = 'default-room';

// ===== ДАННЫЕ КОНКРЕТНОГО ИГРОКА (не сохраняются в Firebase) =====
let myPlayerId = '';
let myPlayerName = '';
let myPlayerRole = '';

// ===== ОБЩИЕ ДАННЫЕ ИГРЫ (синхронизируются через Firebase) =====
let players = [];         // [{id, name, role}]
let turnOrder = [];       // [playerId]
let currentTurnIndex = 0;
let gameStarted = false;
let cardsDealt = false;
let firstCardDrawn = false;
let playerMadeAction = false;
let deck = [];
let discardPile = [];
let tableCards = [];
let playerHands = {};     // {playerId: [cardIds]}
let cardStates = {};

const TRAP_CARDS = Array.from({length: 13}, (_, i) => i + 20);
const FIRST_CARD = 1;
let lastLocalUpdate = null;

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

// ===== УВЕДОМЛЕНИЯ =====
let notificationTimeout = null;

function showNotification(message, type = 'info') {
    const oldNotification = document.querySelector('.game-notification');
    if (oldNotification) oldNotification.remove();
    if (notificationTimeout) clearTimeout(notificationTimeout);
    
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

// ===== FIREBASE ФУНКЦИИ =====
function generatePlayerId() {
    return 'p_' + Math.random().toString(36).substr(2, 9);
}

function saveGameToFirebase() {
    if (!firebaseReady || !database) {
        console.log('Firebase not ready, skipping save');
        return;
    }
    
    const gameData = {
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
    
    database.ref(`rooms/${ROOM_ID}/game`).set(gameData)
        .then(() => console.log('Game saved successfully'))
        .catch(error => console.error('Error saving game:', error));
}

function saveMyPlayerToFirebase() {
    if (!firebaseReady || !database || !myPlayerId) return;
    
    const playerData = {
        id: myPlayerId,
        name: myPlayerName,
        role: myPlayerRole,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    };
    
    database.ref(`rooms/${ROOM_ID}/players/${myPlayerId}`).set(playerData);
    database.ref(`rooms/${ROOM_ID}/players/${myPlayerId}`).onDisconnect().remove();
}

// ===== ПОДПИСКИ НА ОБНОВЛЕНИЯ =====
function subscribeToPlayersList() {
    if (!firebaseReady || !database) return;
    
    database.ref(`rooms/${ROOM_ID}/players`).on('value', (snapshot) => {
        const playersData = snapshot.val() || {};
        const firebasePlayers = Object.values(playersData);
        
        players = firebasePlayers.map(p => ({
            id: p.id,
            name: p.name,
            role: p.role || ''
        }));
        
        console.log('Players updated:', players);
        
        if (!gameStarted) {
            updateLobbyUI();
        }
    });
}

function subscribeToGameUpdates() {
    if (!firebaseReady || !database) return;
    
    database.ref(`rooms/${ROOM_ID}/game`).on('value', (snapshot) => {
        const state = snapshot.val();
        if (!state || state.gameEnded) return;
        
        if (state.lastUpdated && lastLocalUpdate && state.lastUpdated <= lastLocalUpdate) return;
        
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
        
        if (gameStarted) {
            updateGameUI();
        }
    });
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
async function init() {
    console.log('Init started');
    
    showLoginPage();
    
    if (firebaseReady) {
        subscribeToPlayersList();
        
        try {
            const gameSnapshot = await database.ref(`rooms/${ROOM_ID}/game`).once('value');
            const gameState = gameSnapshot.val();
            
            if (gameState && gameState.gameEnded) {
                await database.ref(`rooms/${ROOM_ID}`).remove();
            } else if (gameState && gameState.gameStarted) {
                subscribeToGameUpdates();
            }
        } catch (error) {
            console.log('No active game');
        }
    }
}

// ===== НАВИГАЦИЯ =====
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');
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

// ===== ВХОД В ИГРУ =====
async function joinGame() {
    const nameInput = document.getElementById('playerName');
    if (!nameInput) return;
    
    const name = nameInput.value.trim();
    if (!name) {
        showNotification('Пожалуйста, введите имя', 'error');
        return;
    }
    
    myPlayerId = generatePlayerId();
    myPlayerName = name;
    myPlayerRole = '';
    
    console.log('Joining as:', name, 'ID:', myPlayerId);
    
    if (firebaseReady) {
        try {
            // Проверяем состояние игры
            const gameSnapshot = await database.ref(`rooms/${ROOM_ID}/game`).once('value');
            const gameState = gameSnapshot.val();
            
            console.log('Game state:', gameState);
            
            // Если игра завершена - удаляем всё
            if (gameState && gameState.gameEnded) {
                console.log('Game ended, removing room');
                await database.ref(`rooms/${ROOM_ID}`).remove();
            }
            
            // Если игра уже идет
            if (gameState && gameState.gameStarted && !gameState.gameEnded) {
                // Проверяем, есть ли уже такой игрок
                const playersSnapshot = await database.ref(`rooms/${ROOM_ID}/players`).once('value');
                const playersData = playersSnapshot.val() || {};
                const existingPlayer = Object.values(playersData).find(p => p.name === name);
                
                if (existingPlayer) {
                    console.log('Reconnecting as existing player:', existingPlayer);
                    // Переподключаемся
                    myPlayerId = existingPlayer.id;
                    myPlayerName = existingPlayer.name;
                    myPlayerRole = existingPlayer.role || '';
                    
                    await database.ref(`rooms/${ROOM_ID}/players/${myPlayerId}`).update({
                        lastSeen: firebase.database.ServerValue.TIMESTAMP
                    });
                    await database.ref(`rooms/${ROOM_ID}/players/${myPlayerId}`).onDisconnect().remove();
                    
                    // Загружаем состояние
                    players = gameState.players || [];
                    turnOrder = gameState.turnOrder || [];
                    currentTurnIndex = gameState.currentTurnIndex || 0;
                    gameStarted = true;
                    cardsDealt = gameState.cardsDealt || false;
                    firstCardDrawn = gameState.firstCardDrawn || false;
                    deck = gameState.deck || [];
                    discardPile = gameState.discardPile || [];
                    tableCards = gameState.tableCards || [];
                    playerHands = gameState.playerHands || {};
                    cardStates = gameState.cardStates || {};
                    playerMadeAction = gameState.playerMadeAction || false;
                    
                    subscribeToGameUpdates();
                    showGamePage();
                    showNotification(`С возвращением, ${name}!`, 'success');
                    return;
                } else {
                    showNotification('Игра уже началась, вы не можете присоединиться', 'error');
                    return;
                }
            }
            
            // Получаем текущий список игроков
            const playersSnapshot = await database.ref(`rooms/${ROOM_ID}/players`).once('value');
            const playersData = playersSnapshot.val() || {};
            
            // Проверяем, нет ли уже игрока с таким именем
            const existingPlayer = Object.values(playersData).find(p => p.name === name);
            if (existingPlayer) {
                console.log('Player with this name already exists, reconnecting');
                myPlayerId = existingPlayer.id;
                myPlayerName = existingPlayer.name;
                myPlayerRole = existingPlayer.role || '';
            } else {
                // Новый игрок
                console.log('New player');
                // Сохраняем игрока в Firebase
                await database.ref(`rooms/${ROOM_ID}/players/${myPlayerId}`).set({
                    id: myPlayerId,
                    name: name,
                    role: '',
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
                await database.ref(`rooms/${ROOM_ID}/players/${myPlayerId}`).onDisconnect().remove();
            }
            
            // Загружаем или создаем игру
            if (gameState && !gameState.gameEnded) {
                console.log('Joining existing lobby');
                players = gameState.players || [];
                
                // Обновляем или добавляем игрока в список
                const existingIndex = players.findIndex(p => p.id === myPlayerId);
                if (existingIndex >= 0) {
                    players[existingIndex] = {
                        id: myPlayerId,
                        name: name,
                        role: players[existingIndex].role || ''
                    };
                } else {
                    players.push({
                        id: myPlayerId,
                        name: name,
                        role: ''
                    });
                }
                
                // Восстанавливаем состояние
                turnOrder = gameState.turnOrder || [];
                currentTurnIndex = gameState.currentTurnIndex || 0;
                gameStarted = gameState.gameStarted || false;
                cardsDealt = gameState.cardsDealt || false;
                firstCardDrawn = gameState.firstCardDrawn || false;
                deck = gameState.deck || [];
                discardPile = gameState.discardPile || [];
                tableCards = gameState.tableCards || [];
                playerHands = gameState.playerHands || {};
                cardStates = gameState.cardStates || {};
                playerMadeAction = gameState.playerMadeAction || false;
            } else {
                console.log('Creating new lobby');
                // Создаем новую игру
                players = [{
                    id: myPlayerId,
                    name: name,
                    role: ''
                }];
                
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
            
            // Сохраняем игру
            saveGameToFirebase();
            subscribeToGameUpdates();
            subscribeToPlayersList();
            
            showLobbyPage();
            showNotification(`Добро пожаловать, ${name}!`, 'success');
            
        } catch (error) {
            console.error('Join error:', error);
            console.error('Error details:', error.message, error.stack);
            showNotification('Ошибка подключения: ' + error.message, 'error');
        }
    } else {
        // Оффлайн режим
        console.log('Offline mode');
        myPlayerName = name;
        players = [{id: myPlayerId, name: name, role: ''}];
        gameStarted = false;
        showLobbyPage();
        showNotification(`Добро пожаловать, ${name}! (оффлайн)`, 'info');
    }
}

// ===== ВЫХОД ИЗ ИГРЫ =====
function leaveGame() {
    if (firebaseReady && myPlayerId) {
        database.ref(`rooms/${ROOM_ID}/players/${myPlayerId}`).remove();
        
        players = players.filter(p => p.id !== myPlayerId);
        if (players.length === 0) {
            database.ref(`rooms/${ROOM_ID}`).remove();
        } else {
            saveGameToFirebase();
        }
    }
    
    myPlayerId = '';
    myPlayerName = '';
    myPlayerRole = '';
    players = [];
    
    showLoginPage();
    showNotification('Вы покинули игру', 'info');
}

// ===== ЛОББИ =====
function selectRole(role) {
    myPlayerRole = role;
    
    players = players.map(p => {
        if (p.id === myPlayerId) {
            return {...p, role: role};
        }
        return p;
    });
    
    document.querySelectorAll('.role-btn').forEach(btn => btn.classList.remove('selected'));
    const roleBtn = document.getElementById(role + 'Role');
    if (roleBtn) roleBtn.classList.add('selected');
    
    const selectedRoleEl = document.getElementById('selectedRole');
    if (selectedRoleEl) {
        selectedRoleEl.textContent = `Выбрана роль: ${role === 'player' ? 'Игрок' : role === 'master' ? 'Мастер' : 'Мастер+Игрок'}`;
    }
    
    saveGameToFirebase();
    saveMyPlayerToFirebase();
}

function updateLobbyUI() {
    const nameDisplay = document.getElementById('playerNameDisplay');
    if (nameDisplay) nameDisplay.textContent = `Игрок: ${myPlayerName}`;
    
    if (myPlayerRole) {
        const selectedRoleEl = document.getElementById('selectedRole');
        if (selectedRoleEl) {
            selectedRoleEl.textContent = `Выбрана роль: ${myPlayerRole === 'player' ? 'Игрок' : myPlayerRole === 'master' ? 'Мастер' : 'Мастер+Игрок'}`;
        }
        const roleBtn = document.getElementById(myPlayerRole + 'Role');
        if (roleBtn) roleBtn.classList.add('selected');
    }
    
    updatePlayersList();
}

function updatePlayersList() {
    const listDiv = document.getElementById('playersList');
    if (listDiv) {
        listDiv.innerHTML = '<h3>Игроки в лобби (' + players.length + '):</h3>' + 
            players.map(p => {
                const roleText = p.role === 'player' ? 'Игрок' : p.role === 'master' ? 'Мастер' : p.role === 'both' ? 'Мастер+Игрок' : 'Не выбрана';
                return `<div>• ${p.name}${p.id === myPlayerId ? ' (Вы)' : ''} - ${roleText}</div>`;
            }).join('');
    }
}

function shuffleTurnOrder() {
    const gamePlayers = players.filter(p => p.role !== 'master');
    
    if (gamePlayers.length < 2) {
        showNotification('Недостаточно игроков для перемешивания (минимум 2 не-мастера)', 'error');
        return;
    }
    
    turnOrder = [...gamePlayers].sort(() => Math.random() - 0.5).map(p => p.id);
    
    const orderDiv = document.getElementById('turnOrder');
    if (orderDiv) {
        orderDiv.innerHTML = '<h3>Порядок ходов:</h3>' + 
            turnOrder.map((pid, i) => {
                const player = players.find(p => p.id === pid);
                return `<div>${i + 1}. ${player ? player.name : 'Неизвестный'}</div>`;
            }).join('');
    }
    
    showNotification('Порядок ходов перемешан!', 'success');
    saveGameToFirebase();
}

function startGame() {
    if (!myPlayerRole) {
        showNotification('Пожалуйста, выберите роль', 'error');
        return;
    }
    
    showConfirmModal('Все игроки точно собраны?', () => {
        gameStarted = true;
        initializeDeck();
        
        const gamePlayers = players.filter(p => p.role !== 'master');
        if (turnOrder.length === 0) {
            turnOrder = gamePlayers.map(p => p.id);
        } else {
            turnOrder = turnOrder.filter(pid => {
                const player = players.find(p => p.id === pid);
                return player && player.role !== 'master';
            });
            if (turnOrder.length === 0) {
                turnOrder = gamePlayers.map(p => p.id);
            }
        }
        
        currentTurnIndex = 0;
        playerMadeAction = false;
        
        saveGameToFirebase();
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
        playerHands[p.id] = [];
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

// ===== ИГРОВОЙ UI =====
function updateGameUI() {
    const isMasterRole = myPlayerRole === 'master' || myPlayerRole === 'both';
    const isPlayerRole = myPlayerRole === 'player' || myPlayerRole === 'both';
    
    const masterControls = document.getElementById('masterDeckControls');
    const masterView = document.getElementById('masterViewArea');
    const endGameBtn = document.getElementById('endGameBtn');
    const playerHand = document.getElementById('playerHandArea');
    
    if (masterControls) masterControls.style.display = isMasterRole ? 'flex' : 'none';
    if (masterView) masterView.style.display = isMasterRole ? 'block' : 'none';
    if (endGameBtn) endGameBtn.style.display = isMasterRole ? 'inline-block' : 'none';
    
    if (playerHand) {
        if (myPlayerRole === 'player' || myPlayerRole === 'both') {
            playerHand.style.display = 'block';
        } else {
            playerHand.style.display = 'none';
        }
    }
    
    updateTurnIndicator();
    updateDeckDisplay();
    updateTableDisplay();
    
    if (myPlayerRole === 'player' || myPlayerRole === 'both') {
        updateHandDisplay();
    }
    
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
        const currentPlayerId = turnOrder[currentTurnIndex];
        const currentPlayer = players.find(p => p.id === currentPlayerId);
        if (currentPlayer) {
            indicator.textContent = `Ходит: ${currentPlayer.name} ${currentPlayerId === myPlayerId ? '(Вы)' : ''}`;
        }
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
    const hand = playerHands[myPlayerId] || [];
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
    
    if (discardCountElement) discardCountElement.textContent = discardPile.length;
    
    if (discardPileElement) {
        if (discardPile.length > 0) {
            discardPileElement.innerHTML = `
                <img src="cards/cover.png" alt="Сброс" class="card-img" 
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
    return turnOrder[currentTurnIndex] === myPlayerId;
}

function isPlayerMaster(playerId) {
    const player = players.find(p => p.id === playerId);
    return player && player.role === 'master';
}

// ===== ДЕЙСТВИЯ МАСТЕРА =====
function shuffleDeck() {
    if (myPlayerRole !== 'master' && myPlayerRole !== 'both') return;
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
    
    saveGameToFirebase();
    updateDeckDisplay();
    showNotification('Колода перемешана!', 'success');
}

function dealCards() {
    if (myPlayerRole !== 'master' && myPlayerRole !== 'both') return;
    
    if (cardsDealt) {
        showNotification('Карты уже были розданы!', 'error');
        return;
    }
    
    const gamePlayers = players.filter(p => p.role !== 'master');
    
    if (deck.length < gamePlayers.length * 3) {
        showNotification('Недостаточно карт в колоде', 'error');
        return;
    }
    
    players.forEach(player => {
        playerHands[player.id] = [];
    });
    
    gamePlayers.forEach(player => {
        for (let i = 0; i < 3; i++) {
            const card = deck.pop();
            playerHands[player.id].push(card);
            cardStates[card].owner = player.id;
        }
    });
    
    cardsDealt = true;
    saveGameToFirebase();
    updateGameUI();
    showNotification('Карты розданы!', 'success');
}

function drawFirstCard() {
    if (myPlayerRole !== 'master' && myPlayerRole !== 'both') return;
    if (firstCardDrawn) {
        showNotification('Первая карта уже на столе!', 'info');
        return;
    }
    
    firstCardDrawn = true;
    placeFirstCard();
    
    saveGameToFirebase();
    updateGameUI();
}

function masterDrawCard() {
    if (myPlayerRole !== 'master' && myPlayerRole !== 'both') return;
    if (deck.length === 0) return;
    
    const card = deck.pop();
    tableCards.push(card);
    cardStates[card].onTable = true;
    
    saveGameToFirebase();
    updateGameUI();
}

// ===== ПРОСМОТР КАРТ =====
function viewTableCard(cardId) {
    showCardModal(cardId, false);
}

function viewHandCard(cardId) {
    if (myPlayerRole !== 'player' && myPlayerRole !== 'both') return;
    
    const hand = playerHands[myPlayerId] || [];
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
        const hand = playerHands[myPlayerId] || [];
        const index = hand.indexOf(cardId);
        if (index > -1) hand.splice(index, 1);
        
        tableCards.push(cardId);
        cardStates[cardId].onTable = true;
        cardStates[cardId].owner = null;
        
        playerMadeAction = true;
        saveGameToFirebase();
        updateGameUI();
        showNotification('Карта выложена на стол', 'success');
    });
}

function discardCard(cardId) {
    closeCardModal();
    
    showConfirmModal('Вы уверены, что хотите сбросить эту карту?', () => {
        const hand = playerHands[myPlayerId] || [];
        const index = hand.indexOf(cardId);
        if (index > -1) hand.splice(index, 1);
        
        discardPile.push(cardId);
        cardStates[cardId].owner = null;
        
        playerMadeAction = true;
        saveGameToFirebase();
        updateGameUI();
        showNotification('Карта сброшена', 'info');
    });
}

function endTurn() {
    if (myPlayerRole !== 'player' && myPlayerRole !== 'both') return;
    
    if (!isMyTurn()) {
        showNotification('Сейчас не ваш ход', 'error');
        return;
    }
    
    if (!playerMadeAction) {
        showNotification('Сначала нужно сделать ход', 'error');
        return;
    }
    
    if (deck.length > 0) {
        const hand = playerHands[myPlayerId] || [];
        hand.push(deck.pop());
        showNotification('Вы добрали карту', 'info');
    }
    
    do {
        currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
    } while (turnOrder.length > 0 && isPlayerMaster(turnOrder[currentTurnIndex]));
    
    playerMadeAction = false;
    
    saveGameToFirebase();
    updateGameUI();
    
    const nextPlayer = players.find(p => p.id === turnOrder[currentTurnIndex]);
    showNotification(`Ход переходит к ${nextPlayer ? nextPlayer.name : '...'}`, 'info');
}

// ===== ПРОСМОТР МАСТЕРА =====
function masterViewHands() {
    if (myPlayerRole !== 'master' && myPlayerRole !== 'both') return;
    
    const container = document.getElementById('masterViewContent');
    if (!container) return;
    
    container.innerHTML = '<h3>Руки игроков</h3>';
    
    players.forEach(player => {
        const hand = playerHands[player.id] || [];
        container.innerHTML += `
            <div style="margin-bottom: 20px;">
                <h4>${player.name} (${hand.length} карт)${player.role === 'master' ? ' [Мастер]' : ''}</h4>
                <div class="cards-grid">
                    ${hand.length > 0 ? hand.map(cardId => `
                        <div class="card-in-grid" onclick="viewMasterCard(${cardId})">
                            <img src="cards/${String(cardId).padStart(2, '0')}.png" 
                                 alt="Карта ${cardId}" class="card-img" 
                                 style="width: 100px; height: 164px;"
                                 onerror="this.src='cards/cover.png'">
                        </div>
                    `).join('') : '<p style="color: #888;">Нет карт</p>'}
                </div>
            </div>
        `;
    });
}

function masterViewDiscard() {
    if (myPlayerRole !== 'master' && myPlayerRole !== 'both') return;
    
    const container = document.getElementById('masterViewContent');
    if (!container) return;
    
    container.innerHTML = `<h3>Сброс (${discardPile.length} карт)</h3>
        <div class="cards-grid">
            ${discardPile.length > 0 ? discardPile.map(cardId => `
                <div class="card-in-grid" onclick="viewMasterCard(${cardId})">
                    <img src="cards/${String(cardId).padStart(2, '0')}.png" 
                         alt="Карта ${cardId}" class="card-img" 
                         style="width: 100px; height: 164px;"
                         onerror="this.src='cards/cover.png'">
                </div>
            `).join('') : '<p>Сброс пуст</p>'}
        </div>`;
}

function masterViewDeck() {
    if (myPlayerRole !== 'master' && myPlayerRole !== 'both') return;
    
    const container = document.getElementById('masterViewContent');
    if (!container) return;
    
    container.innerHTML = `<h3>Колода (${deck.length} карт)</h3>
        <div class="cards-grid">
            ${deck.map(cardId => `
                <div class="card-in-grid" onclick="viewMasterCard(${cardId})">
                    <img src="cards/${String(cardId).padStart(2, '0')}.png" 
                         alt="Карта ${cardId}" class="card-img" 
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

// ===== ЗАВЕРШЕНИЕ ИГРЫ =====
function endGameWarning() {
    if (myPlayerRole !== 'master' && myPlayerRole !== 'both') return;
    
    showConfirmModal('Вы уверены, что хотите завершить игру?', () => {
        showConfirmModal('ТОЧНО завершить игру?', () => {
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
    label.parentElement.querySelectorAll('.test-option').forEach(l => l.classList.remove('selected'));
    label.classList.add('selected');
    const radio = label.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
}

function submitTest() {
    let score = 0;
    testQuestions.forEach((q, i) => {
        const selected = document.querySelector(`input[name="q${i}"]:checked`);
        if (selected && selected.value === q.correct) score += 2;
    });
    
    score -= tableCards.filter(cardId => TRAP_CARDS.includes(cardId)).length;
    score -= Math.max(0, 6 - discardPile.length) * 3;
    
    showResults(score);
    document.getElementById('testModal').style.display = 'none';
}

function showResults(score) {
    const modal = document.getElementById('resultsModal');
    const container = document.getElementById('resultsContainer');
    if (!modal || !container) return;
    
    container.innerHTML = `
        <p>Игра завершена!</p>
        <p style="font-size: 2em; color: ${score >= 10 ? '#4CAF50' : score >= 5 ? '#FFA000' : '#f44336'};">
            Итоговый счет: ${score}</p>
        <p>Карт-ловушек на столе: ${tableCards.filter(cardId => TRAP_CARDS.includes(cardId)).length}</p>
        <p>Карт в сбросе: ${discardPile.length} ${discardPile.length < 6 ? `(не хватает ${6 - discardPile.length})` : ''}</p>
        <button onclick="finalizeGameEnd()" class="modal-btn confirm-btn" style="margin-top: 20px;">Вернуться в главное меню</button>
    `;
    modal.style.display = 'block';
}

function finalizeGameEnd() {
    document.getElementById('resultsModal').style.display = 'none';
    resetGame();
}

function closeResultsModal() {
    document.getElementById('resultsModal').style.display = 'none';
    resetGame();
}

function resetGame() {
    if (firebaseReady) {
        database.ref(`rooms/${ROOM_ID}`).remove();
    }
    
    localStorage.removeItem('detectiveGame');
    
    myPlayerId = '';
    myPlayerName = '';
    myPlayerRole = '';
    players = [];
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
    lastLocalUpdate = null;
    
    showLoginPage();
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
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
    if (handContent) handContent.classList.toggle('show');
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

window.onload = function() {
    console.log('Page loaded');
    init();
};
