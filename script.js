// Глобальные переменные
let playerName = '';
let playerRole = ''; // 'player', 'master', 'both'
let players = [];
let turnOrder = [];
let currentTurnIndex = 0;
let gameStarted = false;
let cardsDealt = false;
let firstCardDrawn = false;
let playerMadeAction = false; // Отслеживает, сделал ли игрок действие в текущий ход

// Карты (всего 32 карты)
let deck = [];
let discardPile = [];
let tableCards = [];
let playerHands = {}; // {playerName: [cardIds]}

// Состояние карт
let cardStates = {}; // {cardId: {onTable: false, owner: null}}
const TRAP_CARDS = Array.from({length: 13}, (_, i) => i + 20); // Карты 20-32
const FIRST_CARD = 1; // Фиксированная первая карта - 01.png

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
    // Удаляем старое уведомление если есть
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
    
    // Анимация появления
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Автоматическое скрытие
    notificationTimeout = setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Инициализация
function init() {
    // Загружаем данные из localStorage
    const saved = loadGameState();
    
    // Проверяем, есть ли активная сессия и не завершена ли игра
    if (saved && saved.gameStarted && !saved.gameEnded) {
        playerName = saved.playerName;
        playerRole = saved.playerRole;
        showGamePage();
    } else if (saved && saved.playerName && !saved.gameStarted) {
        playerName = saved.playerName;
        playerRole = saved.playerRole;
        showLobbyPage();
        updateLobbyUI();
    } else {
        // Если нет сохранений или игра завершена - показываем страницу входа
        showLoginPage();
    }
}

function loadGameState() {
    const saved = localStorage.getItem('detectiveGame');
    if (saved) {
        const state = JSON.parse(saved);
        // Проверяем, не завершена ли игра
        if (state.gameEnded) {
            localStorage.removeItem('detectiveGame');
            return null;
        }
        
        // Восстанавливаем глобальные переменные
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
        
        return state;
    }
    return null;
}

function saveGameState() {
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

// Навигация по страницам
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

function showLoginPage() {
    showPage('login-page');
    document.getElementById('playerName').value = '';
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
    const name = nameInput.value.trim();
    
    if (!name) {
        showNotification('Пожалуйста, введите имя', 'error');
        return;
    }
    
    playerName = name;
    
    // Добавляем игрока в список, если его там нет
    if (!players.includes(name)) {
        players.push(name);
    }
    
    // Сбрасываем состояние игры при новом входе
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
    
    saveGameState();
    showLobbyPage();
}

// Страница лобби
function selectRole(role) {
    playerRole = role;
    
    // Обновляем UI кнопок
    document.querySelectorAll('.role-btn').forEach(btn => btn.classList.remove('selected'));
    document.getElementById(role + 'Role').classList.add('selected');
    
    document.getElementById('selectedRole').textContent = `Выбрана роль: ${role === 'player' ? 'Игрок' : role === 'master' ? 'Мастер' : 'Мастер+Игрок'}`;
    
    saveGameState();
}

function updateLobbyUI() {
    document.getElementById('playerNameDisplay').textContent = `Игрок: ${playerName}`;
    
    if (playerRole) {
        document.getElementById('selectedRole').textContent = 
            `Выбрана роль: ${playerRole === 'player' ? 'Игрок' : playerRole === 'master' ? 'Мастер' : 'Мастер+Игрок'}`;
        document.getElementById(playerRole + 'Role')?.classList.add('selected');
    }
    
    updatePlayersList();
}

function updatePlayersList() {
    const listDiv = document.getElementById('playersList');
    listDiv.innerHTML = '<h3>Игроки в лобби:</h3>' + 
        players.map(p => `<div>• ${p}</div>`).join('');
}

function shuffleTurnOrder() {
    if (players.length < 2) {
        showNotification('Недостаточно игроков для перемешивания', 'error');
        return;
    }
    
    turnOrder = [...players].sort(() => Math.random() - 0.5);
    
    const orderDiv = document.getElementById('turnOrder');
    orderDiv.innerHTML = '<h3>Порядок ходов:</h3>' + 
        turnOrder.map((p, i) => `<div>${i + 1}. ${p}</div>`).join('');
    
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
        
        // Автоматически устанавливаем очередь ходов, если она не установлена
        if (turnOrder.length === 0) {
            turnOrder = [...players];
        }
        
        // Устанавливаем первого игрока
        currentTurnIndex = 0;
        playerMadeAction = false;
        
        saveGameState();
        showGamePage();
    });
}

function initializeDeck() {
    // Создаем колоду из 32 карт, но убираем карту 01
    deck = Array.from({length: 31}, (_, i) => i + 2); // Карты с 02 по 32
    // Перемешиваем колоду
    deck.sort(() => Math.random() - 0.5);
    
    // Инициализируем состояния карт
    cardStates = {};
    for (let i = 1; i <= 32; i++) {
        cardStates[i] = {onTable: false, owner: null};
    }
    
    // Очищаем руки игроков
    playerHands = {};
    players.forEach(p => {
        playerHands[p] = [];
    });
    
    discardPile = [];
    tableCards = [];
    cardsDealt = false;
    firstCardDrawn = false;
    playerMadeAction = false;
    
    // Автоматически кладем карту 01 на стол
    placeFirstCard();
}

function placeFirstCard() {
    tableCards.push(FIRST_CARD);
    cardStates[FIRST_CARD].onTable = true;
    firstCardDrawn = true;
}

// Игровая страница
function updateGameUI() {
    // Показываем/скрываем элементы в зависимости от роли
    const isMasterRole = isMaster();
    const isPlayerRole = isPlayer();
    
    document.getElementById('masterDeckControls').style.display = isMasterRole ? 'flex' : 'none';
    document.getElementById('masterViewArea').style.display = isMasterRole ? 'block' : 'none';
    document.getElementById('endGameBtn').style.display = isMasterRole ? 'inline-block' : 'none';
    document.getElementById('playerHandArea').style.display = isPlayerRole ? 'block' : 'none';
    
    // Обновляем индикатор хода
    updateTurnIndicator();
    
    // Обновляем колоду
    updateDeckDisplay();
    
    // Обновляем стол
    updateTableDisplay();
    
    // Обновляем руку игрока
    updateHandDisplay();
    
    // Обновляем сброс
    updateDiscardDisplay();
    
    // Обновляем состояние кнопок мастера
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
    if (turnOrder.length > 0 && currentTurnIndex < turnOrder.length) {
        const currentPlayer = turnOrder[currentTurnIndex];
        document.getElementById('currentPlayerTurn').textContent = 
            `Ходит: ${currentPlayer} ${currentPlayer === playerName ? '(Вы)' : ''}`;
    } else if (turnOrder.length > 0) {
        document.getElementById('currentPlayerTurn').textContent = 'Ожидание игроков...';
    }
}

function updateDeckDisplay() {
    document.getElementById('deckCount').textContent = deck.length;
    
    // Подсветка первой карты
    const firstCardElement = document.querySelector('.deck-stack');
    if (firstCardElement && firstCardDrawn) {
        firstCardElement.style.boxShadow = '0 0 15px rgba(76, 175, 80, 0.8)';
        firstCardElement.style.border = '2px solid #4CAF50';
    }
}

function updateTableDisplay() {
    const container = document.getElementById('tableCardsContainer');
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
    document.getElementById('handCount').textContent = hand.length;
    
    if (hand.length === 0) {
        container.innerHTML = '<div class="empty-hand">У вас пока нет карт</div>';
    } else {
        container.innerHTML = hand.map((cardId, index) => {
            return `<div class="card-in-hand" onclick="viewHandCard(${cardId})">
                <img src="cards/${String(cardId).padStart(2, '0')}.png" 
                     alt="Карта ${cardId}" 
                     class="card-img" 
                     style="width: 120px; height: 197px;"
                     onerror="this.src='cards/cover.png'">
            </div>`;
        }).join('');
    }
    
    // Обновляем кнопку завершения хода
    const endTurnBtn = document.getElementById('endTurnBtn');
    const statusIndicator = document.getElementById('turnStatus');
    
    if (isMyTurn()) {
        if (playerMadeAction) {
            endTurnBtn.style.display = 'block';
            statusIndicator.textContent = 'Вы сделали ход';
            statusIndicator.style.color = '#4CAF50';
        } else {
            endTurnBtn.style.display = 'none';
            statusIndicator.textContent = 'Выберите карту для хода';
            statusIndicator.style.color = '#ffd700';
        }
    } else {
        endTurnBtn.style.display = 'none';
        statusIndicator.textContent = 'Ожидайте своего хода';
        statusIndicator.style.color = '#888';
    }
}

function updateDiscardDisplay() {
    const discardCountElement = document.getElementById('discardCount');
    const discardPileElement = document.getElementById('discardPile');
    
    // Обновляем счетчик
    if (discardCountElement) {
        discardCountElement.textContent = discardPile.length;
    }
    
    // Обновляем отображение стопки сброса
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

// Проверка хода
function isMyTurn() {
    if (turnOrder.length === 0) return false;
    return turnOrder[currentTurnIndex] === playerName;
}

// Действия мастера с колодой
function shuffleDeck() {
    if (!isMaster()) return;
    if (cardsDealt) {
        showNotification('Нельзя перемешать колоду после раздачи', 'error');
        return;
    }
    
    deck.sort(() => Math.random() - 0.5);
    
    // Добавляем анимацию перемешивания
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
        // Трясем кнопку если карты уже розданы
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
    
    // Раздаем по 3 карты каждому игроку
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
    
    // Проверяем, действительно ли карта в руке игрока
    const hand = playerHands[playerName] || [];
    if (hand.includes(cardId)) {
        showCardModal(cardId, true);
    }
}

function showCardModal(cardId, showActions = false) {
    const modal = document.getElementById('cardModal');
    const image = document.getElementById('cardModalImage');
    const actions = document.getElementById('cardModalActions');
    
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
    document.getElementById('cardModal').style.display = 'none';
}

// Действия с картами
function playCard(cardId) {
    // Закрываем модальное окно с картой
    closeCardModal();
    
    // Показываем подтверждение
    showConfirmModal('Вы уверены, что хотите выложить эту карту на стол?', () => {
        // Убираем карту из руки игрока
        const hand = playerHands[playerName];
        const index = hand.indexOf(cardId);
        if (index > -1) {
            hand.splice(index, 1);
        }
        
        // Добавляем на стол
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
    // Закрываем модальное окно с картой
    closeCardModal();
    
    // Показываем подтверждение
    showConfirmModal('Вы уверены, что хотите сбросить эту карту?', () => {
        // Убираем карту из руки игрока
        const hand = playerHands[playerName];
        const index = hand.indexOf(cardId);
        if (index > -1) {
            hand.splice(index, 1);
        }
        
        // Добавляем в сброс
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
    
    // Добираем карту, если есть
    if (deck.length > 0) {
        const hand = playerHands[playerName];
        const card = deck.pop();
        hand.push(card);
        cardStates[card].owner = playerName;
        showNotification('Вы добрали карту из колоды', 'info');
    }
    
    // Передаем ход следующему игроку
    currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
    playerMadeAction = false; // Сбрасываем для следующего игрока
    
    saveGameState();
    updateGameUI();
    showNotification(`Ход переходит к ${turnOrder[currentTurnIndex]}`, 'info');
}

// Просмотр мастера
function masterViewHands() {
    if (!isMaster()) return;
    
    const container = document.getElementById('masterViewContent');
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
    // Показываем карту в модальном окне для мастера
    const modal = document.getElementById('cardModal');
    const image = document.getElementById('cardModalImage');
    const actions = document.getElementById('cardModalActions');
    
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
    // Убираем выделение со всех опций в этой группе
    const allLabels = label.parentElement.querySelectorAll('.test-option');
    allLabels.forEach(l => l.classList.remove('selected'));
    
    // Выделяем выбранную опцию
    label.classList.add('selected');
    
    // Отмечаем radio
    const radio = label.querySelector('input[type="radio"]');
    if (radio) {
        radio.checked = true;
    }
}

function submitTest() {
    // Подсчитываем очки
    let score = 0;
    
    testQuestions.forEach((q, i) => {
        const selected = document.querySelector(`input[name="q${i}"]:checked`);
        if (selected && selected.value === q.correct) {
            score += 2;
        }
    });
    
    // Подсчитываем карты-ловушки на столе
    let trapCardsOnTable = tableCards.filter(cardId => TRAP_CARDS.includes(cardId)).length;
    score -= trapCardsOnTable;
    
    // Подсчитываем недостающие карты в сбросе
    let discardDeficit = Math.max(0, 6 - discardPile.length);
    score -= discardDeficit * 3;
    
    // Показываем результаты
    showResults(score);
    
    document.getElementById('testModal').style.display = 'none';
}

function showResults(score) {
    const modal = document.getElementById('resultsModal');
    const container = document.getElementById('resultsContainer');
    
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
    document.getElementById('resultsModal').style.display = 'none';
    resetGame();
}

function closeResultsModal() {
    document.getElementById('resultsModal').style.display = 'none';
    resetGame();
}

function resetGame() {
    // Полностью сбрасываем игру
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
    
    // Помечаем игру как завершенную и очищаем localStorage
    const state = { gameEnded: true };
    localStorage.setItem('detectiveGame', JSON.stringify(state));
    localStorage.removeItem('detectiveGame');
    
    // Показываем страницу входа
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
    // Закрываем другие модальные окна
    document.getElementById('cardModal').style.display = 'none';
    
    const modal = document.getElementById('confirmModal');
    document.getElementById('modalMessage').textContent = message;
    
    const confirmBtn = document.getElementById('modalConfirm');
    confirmBtn.onclick = () => {
        modal.style.display = 'none';
        onConfirm();
    };
    
    modal.style.display = 'block';
    modal.style.zIndex = '2000'; // Поверх карточки
}

function closeModal() {
    document.getElementById('confirmModal').style.display = 'none';
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
    document.getElementById('infoModalText').innerHTML = `<h2>${title}</h2>${content}`;
    modal.style.display = 'block';
}

function closeInfoModal() {
    document.getElementById('infoModal').style.display = 'none';
}

function toggleHand() {
    const handContent = document.getElementById('handContent');
    handContent.classList.toggle('show');
}

// Закрытие модальных окон при клике вне их
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Инициализация при загрузке
window.onload = init;