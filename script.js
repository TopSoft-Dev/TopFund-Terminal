// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, getDocs, where } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// --- WAŻNE: ID APLIKACJI ---
const APLIKACJA_ID = "topfund-terminal"; 
// -----------------------------------------

// --- KONFIG: Docelowy rok dla ekstrapolacji (do ukończenia 50 lat) ---
// Prognozuj aż do roku 2038
const EXTRAPOLATION_TARGET_YEAR = 2038;

// Pomocnicza: liczba miesięcy od teraz do 31 grudnia docelowego roku (włącznie)
function computeMonthsUntilYear(targetYear) {
  const now = new Date();
  const end = new Date(targetYear, 11, 31);
  let months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth()) + 1;
  return Math.max(months, 0);
}

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCRKyqcz7xd4ykSB7R1Tm_c_bmE8UVLiLE",
  authDomain: "topfund-1d82e.firebaseapp.com",
  projectId: "topfund-1d82e",
  storageBucket: "topfund-1d82e.firebasestorage.app",
  messagingSenderId: "1027710020899",
  appId: "1:1027710020899:web:2e70d77b312ce19242b096"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("Firebase połączony!");

// Funkcja do haszowania haseł (używamy prostego SHA-256)
async function hashPassword(password) {
    const textEncoder = new TextEncoder();
    const data = textEncoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashedPassword;
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementy DOM Logowania ---
    const loginModal = document.getElementById('loginModal');
    const loginForm = document.getElementById('loginForm');
    const loginUsernameInput = document.getElementById('loginUsername');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginErrorElement = document.getElementById('loginError');

    // --- Elementy DOM Głównej Aplikacji ---
    const mainAppElements = document.querySelectorAll('main, footer, #addUserModal, #editUserModal, #transactionDetailsModal');

    // --- Reszta Elementów DOM ---
    const addUserForm = document.getElementById('add-user-form');
    const addUserModal = document.getElementById('addUserModal');
    const editUserModal = document.getElementById('editUserModal');
    const editUserForm = document.getElementById('editUserForm');
    const showAddUserModalBtn = document.getElementById('showAddUserModalBtn');
    const closeAddModalBtn = document.getElementById('closeAddModalBtn');
    const closeEditModalBtn = document.getElementById('closeEditModalBtn');
    const addTransactionForm = document.getElementById('add-transaction-form');
    const transactionTypeSelect = document.getElementById('transaction-type');
    const transactionUserSelect = document.getElementById('transaction-user');
    const transactionAmountInput = document.getElementById('transaction-amount');
    const transactionModeContainer = document.getElementById('transaction-mode-container');
    const transactionModeSelect = document.getElementById('transaction-mode');
    const usersList = document.getElementById('users-list');
    const userSummaryCards = document.getElementById('user-summary-cards');
    const totalBalanceElement = document.getElementById('total-balance');
    const totalBalanceContainer = document.getElementById('totalBalanceContainer');
    const transactionsHistoryBody = document.querySelector('#transactions-history tbody');
    const toggleArchiveBtn = document.getElementById('toggleArchiveBtn');
    const editPasswordGroup = document.getElementById('editPasswordGroup');
    const editPasswordInput = document.getElementById('editPassword');
    const toggleEditPassword = document.getElementById('toggleEditPassword');
    const transactionsSection = document.getElementById('transactions-section'); // Nowy element
    const usersSection = document.getElementById('users-section'); // Nowy element
    const userCard = document.getElementById('user-card');
    const usernameDisplay = document.getElementById('username-display');
    const logoutButton = document.getElementById('logout-button');
    const topciuLogoutBtn = document.getElementById('topciuLogoutBtn');
    const themeToggle = document.getElementById('theme-toggle');

    const actionTypeSelect = document.getElementById('action-type');
    const createUserFields = document.getElementById('create-user-fields');
    const grantPermissionFields = document.getElementById('grant-permission-fields');
    const existingUsersList = document.getElementById('existing-users-list');

    const transactionDetailsMobileModal = document.getElementById('transactionDetailsMobileModal');
    const closeTransactionDetailsMobileModalBtn = document.getElementById('closeTransactionDetailsMobileModalBtn');
    const transactionDetailsMobileContent = document.getElementById('transactionDetailsMobileContent');

    // Elementy wykresu miesięcznych zysków
    const monthlyProfitsSection = document.getElementById('monthly-profits-section');
    const monthlyProfitsChart = document.getElementById('monthly-profits-chart');

    // Elementy modala ze statystykami
    const showDetailsBtn = document.getElementById('showDetailsBtn');
    const detailedStatsModal = document.getElementById('detailedStatsModal');
    const closeDetailedStatsModalBtn = document.getElementById('closeDetailedStatsModalBtn');

    // Elementy modala z większym wykresem
    const enlargedChartModal = document.getElementById('enlargedChartModal');
    const closeEnlargedChartModalBtn = document.getElementById('closeEnlargedChartModalBtn');
    const enlargedChartContainer = document.getElementById('enlarged-chart-container');

    // Elementy modala udostępniania
    const shareResultModal = document.getElementById('shareResultModal');
    const closeShareResultModalBtn = document.getElementById('closeShareResultModalBtn');
    const shareUsername = document.getElementById('shareUsername');
    const shareDate = document.getElementById('shareDate');
    const shareIcon = document.getElementById('shareIcon');
    const sharePercentage = document.getElementById('sharePercentage');
    const shareAmount = document.getElementById('shareAmount');
    const shareMessage = document.getElementById('shareMessage');
    const hideAmountCheckbox = document.getElementById('hideAmountCheckbox');

    // Elementy modala szczegółów trackera
    const trackerDetailsModal = document.getElementById('trackerDetailsModal');
    const closeTrackerDetailsModalBtn = document.getElementById('closeTrackerDetailsModalBtn');

    // Elementy modala wykresu procentowego
    const percentageChartModal = document.getElementById('percentageChartModal');
    const closePercentageChartModalBtn = document.getElementById('closePercentageChartModalBtn');

    // Funkcje do zarządzania scrollowaniem
    function disableBodyScroll() {
        document.body.classList.add('modal-open');
    }

    function enableBodyScroll() {
        document.body.classList.remove('modal-open');
    }

    // --- Pamięć podręczna i stan aplikacji ---
    let cachedUsers = [];
    let allUsersForPermissions = []; // Nowa zmienna do przechowywania wszystkich użytkowników
    let cachedTransactions = [];
    let isArchiveView = false;
    let loggedInUser = null; // Przechowuje dane zalogowanego użytkownika
    // Instancja wykresu ekstrapolacji i sygnatura ostatniego stanu, aby uniknąć ciągłego prze-rysowywania
    let extrapolationChart = null;
    let lastExtrapolationSignature = null;
    const deleteUserModal = document.getElementById('deleteUserModal');
    const closeDeleteUserModalBtn = document.getElementById('closeDeleteUserModalBtn');
    const deleteUserName = document.getElementById('deleteUserName');
    const revokePermissionsBtn = document.getElementById('revokePermissionsBtn');
    const deleteUserPermanentlyBtn = document.getElementById('deleteUserPermanentlyBtn');

    let userIdToDelete = null;
    let userNameToDelete = null;

    // Ukryj główną aplikację na początku
    mainAppElements.forEach(el => el.style.display = 'none');
    loginModal.style.display = 'flex'; // Pokaż modal logowania

    // Ukryj przycisk dodawania użytkownika na początku
    showAddUserModalBtn.style.display = 'none';

    // --- NOWA, ULEPSZONA OBSŁUGA LOGOWANIA ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginErrorElement.textContent = '';

        const username = loginUsernameInput.value;
        const password = loginPasswordInput.value;
        const hashedPassword = await hashPassword(password);

        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("name", "==", username));
            const usersSnapshot = await getDocs(q);

            if (usersSnapshot.empty) {
                loginErrorElement.textContent = 'Nieprawidłowa nazwa użytkownika lub hasło.';
                return;
            }

            const userDoc = usersSnapshot.docs[0];
            const userData = userDoc.data();

            if (userData.hashedPassword === hashedPassword) {
                const userPermissions = userData.permissions || [];

                // Sprawdzenie uprawnień
                if (userData.name === 'Topciu' || userPermissions.includes(APLIKACJA_ID)) {
                    // --- SUKCES LOGOWANIA ---
                    loggedInUser = { id: userDoc.id, ...userData };
                    loginModal.style.display = 'none';
                    mainAppElements.forEach(el => el.style.display = ''); // Pokaż główną aplikację
                    loginErrorElement.textContent = '';

                    // Kontrola widoczności elementów na podstawie roli użytkownika
                    if (loggedInUser.name === 'Topciu') {
                        showAddUserModalBtn.style.display = 'block';
                        topciuLogoutBtn.style.display = 'block';
                        transactionsSection.style.display = 'block';
                        totalBalanceContainer.style.display = 'block';
                        usersSection.style.display = 'block';
                        userCard.style.display = 'none';
                        showDetailsBtn.style.display = 'none';
                        const widgetsSection = document.getElementById('widgets-section');
                        console.log('Widget: Próba pokazania sekcji widgetów');
                        console.log('Widget: widgetsSection element:', widgetsSection);
                        
                        if (widgetsSection) {
                            widgetsSection.style.display = 'block'; // Pokaż sekcję widgetów
                            console.log('Widget: Sekcja widgetów pokazana');
                            console.log('Widget: Style sekcji po zmianie:', widgetsSection.style.display);
                            
                            // Sprawdź czy elementy widgetu są dostępne
                            const progressFill = document.getElementById('monthly-progress-fill');
                            const progressPercentageEl = document.getElementById('monthly-progress-percentage');
                            
                            console.log('Widget: Elementy po pokazaniu sekcji:');
                            console.log('- progressFill:', progressFill);
                            console.log('- progressPercentageEl:', progressPercentageEl);
                        } else {
                            console.log('Widget: BŁĄD - Nie znaleziono sekcji widgetów!');
                        }
                        // Upewnij się, że Topciu nie używa layoutu non-topciu
                        document.body.classList.remove('non-topciu-layout');
                        
                        // Natychmiastowe sprawdzenie elementów
                        const progressFill = document.getElementById('monthly-progress-fill');
                        const progressPercentageEl = document.getElementById('monthly-progress-percentage');
                        
                        if (progressFill && progressPercentageEl) {
                            console.log('Widget: Elementy znalezione natychmiast - aktualizuję widget');
                            updateMonthlyProgressWidget(cachedTransactions, loggedInUser);
                        } else {
                            // Jeśli elementy nie są dostępne, spróbuj ponownie po krótkim opóźnieniu
                            setTimeout(() => {
                                console.log('Widget: Sprawdzenie elementów po 100ms');
                                const progressFill = document.getElementById('monthly-progress-fill');
                                const progressPercentageEl = document.getElementById('monthly-progress-percentage');
                                
                                if (progressFill && progressPercentageEl) {
                                    console.log('Widget: Elementy znalezione po opóźnieniu - aktualizuję widget');
                                    updateMonthlyProgressWidget(cachedTransactions, loggedInUser);
                                    // Automatycznie wczytaj widget wykresu miesięcznego (Topciu)
                                    updateTopciuMonthlyWidgetChart();
                                }
                            }, 100);
                        }
                        
                        // AKTYWACJA: Uruchom inicjalizację użytkowników terminala
                        initializeTerminalUsers(); 

                    } else {
                        showAddUserModalBtn.style.display = 'none';
                        transactionsSection.style.display = 'none';
                        totalBalanceContainer.style.display = 'none';
                        usersSection.style.display = 'none';
                        userCard.style.display = 'block';
                        monthlyProfitsSection.style.display = 'block';
                        showDetailsBtn.style.display = 'none';
                        document.getElementById('widgets-section').style.display = 'none'; // Ukryj sekcję widgetów
                        usernameDisplay.textContent = loggedInUser.name;
                        // Przełącz layout 5-kolumnowy dla zwykłych użytkowników
                        document.body.classList.add('non-topciu-layout');
                        // Pokaż i narysuj widgety użytkownika od razu po zalogowaniu
                        const userWidgetsRow = document.getElementById('user-widgets-row');
                        if (userWidgetsRow) {
                            userWidgetsRow.style.display = 'grid';
                            const uw1 = document.getElementById('user-extrapolation-widget');
                            if (uw1) uw1.style.display = 'none';
                            // Zainicjalizuj przycisk rozwijania
                            try { setupUserWidgetsToggle(); } catch (e) { /* no-op */ }
                        }
                        // Jeśli mamy już jakiekolwiek dane, spróbuj narysować natychmiast
                        try { drawUserWidgets(loggedInUser); } catch (e) { /* no-op */ }
                    }
                    displayUserSummaryCards(cachedUsers, loggedInUser);
                    displayTransactions(cachedTransactions, loggedInUser);
                    updateTransactionFormUI(); // << NOWOŚĆ: Aktualizuj UI formularza po zalogowaniu
                } else {
                    loginErrorElement.textContent = 'Brak uprawnień do tej aplikacji.';
                }
            } else {
                loginErrorElement.textContent = 'Nieprawidłowa nazwa użytkownika lub hasło.';
            }
        } catch (error) {
            console.error("Błąd logowania: ", error);
            loginErrorElement.textContent = 'Wystąpił błąd podczas logowania. Spróbuj ponownie.';
        }
    });

    // --- Obsługa Wylogowania ---
    logoutButton.addEventListener('click', () => {
        loggedInUser = null;
        location.reload(); // Przeładuj stronę, aby powrócić do ekranu logowania
    });

    topciuLogoutBtn.addEventListener('click', () => {
        loggedInUser = null;
        location.reload();
    });

    // --- GŁÓWNA LOGIKA APLIKACJI ---

    function updateTransactionFormUI() {
        const isTrade = transactionTypeSelect.value === 'trade';
        const isTopciu = loggedInUser && loggedInUser.name === 'Topciu';

        transactionUserSelect.style.display = isTrade ? 'none' : 'block';
        transactionModeContainer.style.display = isTrade && isTopciu ? 'block' : 'none';
    }

    actionTypeSelect.addEventListener('change', () => {
        const isCreating = actionTypeSelect.value === 'create';
        createUserFields.style.display = isCreating ? 'block' : 'none';
        grantPermissionFields.style.display = isCreating ? 'none' : 'block';

        // Dynamically set 'required' attribute to prevent validation on hidden fields
        document.getElementById('user-name').required = isCreating;
        document.getElementById('user-password').required = isCreating;
        document.getElementById('user-balance').required = isCreating;
        document.getElementById('user-commission').required = isCreating;

        if (!isCreating) {
            populateAllUsersForPermissions(); // Populate list only when needed
        }
    });

    async function initializeTerminalUsers() {
        console.log("Aktywacja przez Topciu: Sprawdzanie konfiguracji użytkowników terminala...");
        const usersSnapshot = await getDocs(collection(db, "users"));
        
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const permissions = userData.permissions || [];

            // Sprawdź, czy użytkownik ma uprawnienia, ale brakuje mu domyślnej konfiguracji
            if (permissions.includes(APLIKACJA_ID) && userData.commission === undefined) {
                console.log(`Znaleziono nieskonfigurowanego użytkownika: ${userData.name}. Ustawianie domyślnych wartości...`);
                try {
                    await updateDoc(userDoc.ref, {
                        color: "#ff0000",
                        commission: 30,
                        startBalance: 0,
                        currentBalance: 0,
                        // Upewnijmy się, że te pola istnieją, nawet jeśli są puste
                        hashedPassword: userData.hashedPassword || "",
                        createdAt: userData.createdAt || new Date()
                    });
                    console.log(`Użytkownik ${userData.name} został pomyślnie skonfigurowany.`);
                } catch (error) {
                    console.error(`Błąd podczas konfiguracji użytkownika ${userData.name}:`, error);
                }
            }
        }
        
        // Inicjalizuj widget miesięczny dla Topcia po załadowaniu użytkowników
        if (loggedInUser && loggedInUser.name === 'Topciu') {
            setTimeout(() => {
                updateTopciuMonthlyWidgetChart();
            }, 200); // Krótkie opóźnienie dla pewności, że DOM jest gotowy
        }
    }
    

    async function recalculateAllBalances(transactionIdToSkip = null) {
        document.body.style.cursor = 'wait';
        try {
            const usersSnapshot = await getDocs(collection(db, "users"));
            const transactionsSnapshot = await getDocs(query(collection(db, "transactions"), orderBy("createdAt", "asc")));
            
            // Pobierz wszystkich użytkowników i od razu filtruj
            let allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const activeUsers = allUsers.filter(user => {
                const permissions = user.permissions || [];
                return user.name === 'Topciu' || permissions.includes('topfund-terminal');
            });
            const activeUserIds = new Set(activeUsers.map(u => u.id));

            const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            let recalculatedUsers = {};
            allUsers.forEach(user => {
                // Inicjalizuj salda dla wszystkich, ale obliczenia tylko dla aktywnych
                recalculatedUsers[user.id] = { ...user, currentBalance: user.startBalance };
            });

            for (const transaction of transactions) {
                if (transaction.id === transactionIdToSkip) continue;

                if (transaction.type === 'deposit' || transaction.type === 'withdrawal') {
                    const user = recalculatedUsers[transaction.userId];
                    if (user) user.currentBalance += (transaction.type === 'deposit' ? transaction.amount : -transaction.amount);
                } else if (transaction.type === 'trade') {
                    // Dla transakcji typu 'trade', użyj zapisanych szczegółów do zastosowania zysku/straty i prowizji
                    if (transaction.details) {
                        for (const userId in transaction.details) {
                            const detail = transaction.details[userId];
                            const userState = recalculatedUsers[userId];
                            if (userState) {
                                // Zastosuj zmianę salda z oryginalnej transakcji
                                userState.currentBalance += (detail.newBalance - detail.oldBalance);
                            }
                        }
                    }
                }
            }
            for (const userId in recalculatedUsers) {
                await updateDoc(doc(db, "users", userId), { currentBalance: recalculatedUsers[userId].currentBalance });
            }
            console.log("Sald przeliczone pomyślnie.");
        } catch (error) {
            console.error("Krytyczny błąd podczas przeliczania sald: ", error);
        } finally {
            document.body.style.cursor = 'default';
        }
    }

    async function deleteTransaction(transactionIdToDelete) {
        if (!confirm("Czy na pewno chcesz usunąć tę transakcję? Spowoduje to ponowne przeliczenie wszystkich sald. Operacja jest nieodwracalna.")) return;
        try {
            await recalculateAllBalances(transactionIdToDelete);
            await deleteDoc(doc(db, "transactions", transactionIdToDelete));
        } catch (error) {
            console.error("Błąd podczas usuwania transakcji: ", error);
        }
    }

    async function handleEditUserSubmit(e) {
        e.preventDefault();
        const userId = document.getElementById('editUserId').value;
        const newStartBalance = parseFloat(document.getElementById('editStartBalance').value);
        const newColor = document.getElementById('editColor').value;
        const newCommission = parseFloat(document.getElementById('editCommission').value);
        const newPassword = editPasswordInput.value; // Pobierz nowe hasło

        if (isNaN(newStartBalance) || isNaN(newCommission)) {
            alert('Proszę podać prawidłowe wartości liczbowe dla salda i prowizji.');
            return;
        }

        let updateData = { startBalance: newStartBalance, color: newColor, commission: newCommission };

        // Jeśli Topciu jest zalogowany i podano nowe hasło, zahaszuj je i dodaj do aktualizacji
        if (loggedInUser && loggedInUser.name === 'Topciu' && newPassword) {
            updateData.hashedPassword = await hashPassword(newPassword);
        }

        try {
            await updateDoc(doc(db, "users", userId), updateData);
            await recalculateAllBalances();
            editUserModal.style.display = 'none';
            enableBodyScroll();
        } catch (error) {
            console.error("Błąd podczas aktualizacji użytkownika: ", error);
        }
    }

    function openEditModal(user) {
        document.getElementById('editUserId').value = user.id;
        document.getElementById('editStartBalance').value = user.startBalance;
        document.getElementById('editColor').value = user.color;
        document.getElementById('editCommission').value = user.commission;

        // Pokaż/ukryj pole hasła w zależności od zalogowanego użytkownika
        editPasswordInput.value = ''; // Zawsze czyść pole hasła przy otwieraniu modala
        if (loggedInUser && loggedInUser.name === 'Topciu') {
            editPasswordGroup.style.display = 'block';
        } else {
            editPasswordGroup.style.display = 'none';
        }

        editUserModal.style.display = 'block';
        disableBodyScroll();
    }

    function openDeleteModal(userId, userName) {
        userIdToDelete = userId;
        userNameToDelete = userName;
        deleteUserName.textContent = userName;
        deleteUserModal.style.display = 'block';
        disableBodyScroll();
    }

    async function deleteUser(userId, userName) {
        if (confirm(`Czy na pewno chcesz usunąć użytkownika ${userName}? Spowoduje to przeliczenie wszystkich sald.`)) {
            try {
                await deleteDoc(doc(db, "users", userId));
                await recalculateAllBalances();
            } catch (error) {
                console.error("Błąd podczas usuwania użytkownika: ", error);
            }
        }
    }

    // --- FUNKCJE WYŚWIETLAJĄCE ---

    function displayUsers(users) {
        if (!usersList) return;
        usersList.innerHTML = '';

        // Jeśli użytkownik nie jest Topciu, nie wyświetlaj listy użytkowników
        if (loggedInUser && loggedInUser.name !== 'Topciu') {
            return;
        }

        if (users.length === 0) {
            usersList.innerHTML = '<p>Brak użytkowników.</p>';
            return;
        }
        users.forEach(user => {
            const userEntry = document.createElement('div');
            userEntry.className = 'user-entry';
            userEntry.style.borderLeft = `5px solid ${user.color}`;
            const startBalance = user.startBalance || 0;
            const commission = user.commission || 0;
            userEntry.innerHTML = `
                <div class="user-info">
                    <span class="user-name">${user.name}</span>
                    <span class="user-detail">Saldo początkowe: ${startBalance.toFixed(2)}&nbsp;USD</span>
                    <span class="user-detail">Prowizja: ${commission}%</span>
                </div>
                <div class="action-buttons">
                    <button class="circle-btn edit-btn" data-user-id="${user.id}" title="Edytuj">…</button>
                    ${user.name !== 'Topciu' ? `<button class="circle-btn delete-btn delete-user-btn" data-user-id="${user.id}" data-user-name="${user.name}" title="Usuń">&times;</button>` : ''}
                </div>
            `;
            usersList.appendChild(userEntry);
        });
    }

    function displayUserSummaryCards(users, currentUser) {
        if (!userSummaryCards) return;
        userSummaryCards.innerHTML = '';
        let totalBalance = 0;

        const usersToDisplay = (currentUser && currentUser.name !== 'Topciu')
            ? users.filter(user => user.id === currentUser.id)
            : users;

        usersToDisplay.forEach(user => {
            const userCard = document.createElement('div');
            userCard.className = 'user-summary-card';
            userCard.style.backgroundColor = user.color;
            userCard.style.cursor = 'pointer'; // Dodaj kursor wskazujący na możliwość kliknięcia
            userCard.setAttribute('data-user-id', user.id); // Dodaj ID użytkownika
            const startBalance = user.startBalance || 0;
            const currentBalance = user.currentBalance || 0;
            let percentageChange = 0;
            let percentageHtml = '';
            if (startBalance > 0) {
                percentageChange = ((currentBalance - startBalance) / startBalance) * 100;
                const percentageClass = percentageChange >= 0 ? 'positive-amount' : 'negative-amount';
                const sign = percentageChange >= 0 ? '+' : '';
                percentageHtml = `<div class="percentage-change ${percentageClass}">${sign}${percentageChange.toFixed(1)}%</div>`;
            }
            userCard.innerHTML = `
                <div class="card-main-content">
                    <h4>${user.name}</h4>
                    <p>Saldo: ${currentBalance.toFixed(2)}&nbsp;USD</p>
                </div>
                ${percentageHtml}
            `;
            userSummaryCards.appendChild(userCard);
            totalBalance += currentBalance;
        });
        // Ukryj łączne saldo, jeśli użytkownik nie jest Topciu
        if (totalBalanceContainer) {
            if (currentUser && currentUser.name !== 'Topciu') {
                totalBalanceContainer.style.display = 'none';
            } else {
                totalBalanceContainer.style.display = 'block';
                totalBalanceElement.textContent = `${totalBalance.toFixed(2)} USD`;
            }
        }
    }

    function populateTransactionUserSelect(users) {
        if (!transactionUserSelect) return;
        const selectedValue = transactionUserSelect.value;
        transactionUserSelect.innerHTML = '<option value="">Wybierz użytkownika...</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.name;
            transactionUserSelect.appendChild(option);
        });
        transactionUserSelect.value = selectedValue;
    }

    async function processTransaction(type, userId, amount, mode) { // Dodano 'mode'
        const usersSnapshot = await getDocs(collection(db, "users"));
        const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filtruj do aktywnych użytkowników dla logiki biznesowej
        const activeUsers = allUsers.filter(user => {
            const permissions = user.permissions || [];
            return user.name === 'Topciu' || permissions.includes('topfund-terminal');
        });
        const activeUserIds = new Set(activeUsers.map(u => u.id));
        let topciuUser = activeUsers.find(u => u.name === 'Topciu');

        if (type === 'deposit' || type === 'withdrawal') {
            const targetUser = allUsers.find(u => u.id === userId); // Wpłata/wypłata może dotyczyć każdego
            if (!targetUser) throw new Error('Wybrany użytkownik nie istnieje.');
            
            const newCurrentBalance = targetUser.currentBalance + (type === 'deposit' ? amount : -amount);
            await updateDoc(doc(db, "users", targetUser.id), { currentBalance: newCurrentBalance });
            await addDoc(collection(db, "transactions"), {
                userId: targetUser.id, userName: targetUser.name, type: type, amount: amount, description: "",
                balanceAfter: newCurrentBalance, createdAt: new Date()
            });

        } else if (type === 'trade') {
            if (!topciuUser) throw new Error('Brak aktywnego użytkownika "Topciu" z wymaganymi uprawnieniami.');

            const oldTotalBalance = activeUsers.reduce((sum, u) => sum + u.currentBalance, 0);
            let newTotalBalance;
            let profitLoss;

            if (mode === 'saldo') {
                newTotalBalance = amount;
                profitLoss = newTotalBalance - oldTotalBalance;
            } else { // mode === 'kwota'
                profitLoss = amount;
                newTotalBalance = oldTotalBalance + profitLoss;
            }

            if (oldTotalBalance <= 0) throw new Error('Całkowite saldo początkowe aktywnych użytkowników jest zerowe lub ujemne.');

            let totalCommissionCollected = 0;
            let transactionDetails = {};

            for (const user of activeUsers) {
                const userContributionRatio = user.currentBalance / oldTotalBalance;
                const userProfitLoss = profitLoss * userContributionRatio;
                let userShareAfterCommission = userProfitLoss;
                let commissionAmount = 0;

                if (user.name !== 'Topciu' && userProfitLoss > 0) {
                    commissionAmount = userProfitLoss * (user.commission / 100);
                    userShareAfterCommission -= commissionAmount;
                    totalCommissionCollected += commissionAmount;
                }
                const newBalance = user.currentBalance + userShareAfterCommission;
                transactionDetails[user.id] = { name: user.name, oldBalance: user.currentBalance, profitLossShare: userProfitLoss, commissionPaid: commissionAmount, newBalance: newBalance };
            }

            const topciuDetails = transactionDetails[topciuUser.id];
            if(topciuDetails) {
                topciuDetails.newBalance += totalCommissionCollected;
                topciuDetails.commissionCollected = totalCommissionCollected;
            }

            for(const userId in transactionDetails){
                await updateDoc(doc(db, "users", userId), { currentBalance: transactionDetails[userId].newBalance });
            }

            await addDoc(collection(db, "transactions"), {
                type: type, amount: profitLoss, description: `Zmiana salda z ${oldTotalBalance.toFixed(2)} na ${newTotalBalance.toFixed(2)}`,
                details: transactionDetails, totalBalanceAfter: newTotalBalance, createdAt: new Date()
            });
        }
    }

    function displayTransactions(transactions, currentUser) {
        if (!transactionsHistoryBody) return;
    
        // Poprawiona logika obliczania daty miesiąc temu
        const now = new Date();
        const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        
        // Oblicz początek bieżącego miesiąca dla lepszego filtrowania
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
        let timeFilteredTransactions = transactions.filter(transaction => {
            const transactionDate = transaction.createdAt.toDate();
            if (isArchiveView) {
                // Archiwum: transakcje z poprzednich miesięcy (przed początkiem bieżącego miesiąca)
                return transactionDate < currentMonthStart;
            } else {
                // Aktualne: transakcje z bieżącego miesiąca (od początku bieżącego miesiąca)
                return transactionDate >= currentMonthStart;
            }
        });

        // Debug: Loguj informacje o filtrowaniu (tylko w trybie deweloperskim)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log(`Filtrowanie transakcji:`, {
                isArchiveView,
                currentMonthStart: currentMonthStart.toISOString(),
                totalTransactions: transactions.length,
                filteredTransactions: timeFilteredTransactions.length,
                sampleDates: transactions.slice(0, 3).map(t => ({
                    date: t.createdAt.toDate().toISOString(),
                    type: t.type,
                    isInArchive: t.createdAt.toDate() < currentMonthStart
                }))
            });
        }
    
        // Nowa logika filtrowania dla użytkowników innych niż "Topciu"
        let finalFilteredTransactions;
        if (currentUser && currentUser.name !== 'Topciu') {
            finalFilteredTransactions = timeFilteredTransactions.filter(transaction => {
                if ((transaction.type === 'deposit' || transaction.type === 'withdrawal')) {
                    // Pokaż tylko transakcje (wpłaty/wypłaty) bieżącego użytkownika
                    return transaction.userName === currentUser.name;
                } else if (transaction.type === 'trade') {
                    // Dla transakcji typu 'trade', pokaż tylko jeśli użytkownik brał w niej udział
                    return transaction.details && Object.values(transaction.details).some(detail => detail.name === currentUser.name);
                }
                return false; // Domyślnie ukryj, jeśli nie pasuje do żadnego warunku
            });
        } else {
            // "Topciu" widzi wszystko
            finalFilteredTransactions = timeFilteredTransactions;
        }
    
        transactionsHistoryBody.innerHTML = '';
        if (finalFilteredTransactions.length === 0) {
            transactionsHistoryBody.innerHTML = `<tr><td colspan="6">${isArchiveView ? 'Archiwum jest puste.' : 'Brak transakcji w tym miesiącu.'}</td></tr>`;
            return;
        }
    
        finalFilteredTransactions.forEach(transaction => {
            const row = document.createElement('tr');
            let descriptionText = "";
            let amountText = '';
            let balanceAfterText = '';
            if (transaction.type === 'deposit' || transaction.type === 'withdrawal') {
                descriptionText = `${transaction.userName}`;
                amountText = `<span>${transaction.type === 'deposit' ? '+' : '-'}${transaction.amount.toFixed(2)}</span>&nbsp;USD`;
                balanceAfterText = `<span>${transaction.balanceAfter.toFixed(2)}</span>&nbsp;USD`;
            } else if (transaction.type === 'trade') {
                let displayAmount = transaction.amount;
                if (currentUser && currentUser.name !== 'Topciu' && transaction.details) {
                    const userDetail = Object.values(transaction.details).find(detail => detail.name === currentUser.name);
                    if (userDetail) {
                        displayAmount = userDetail.profitLossShare - (userDetail.commissionPaid || 0);
                    }
                }
                const tradeAmountClass = displayAmount > 0 ? 'positive-amount' : 'negative-amount';
                amountText = `<span class="${tradeAmountClass}">${displayAmount > 0 ? '+' : ''}${displayAmount.toFixed(2)}</span>&nbsp;USD (Zysk/Strata)`;
                descriptionText = `Zagranie`;
                if (transaction.totalBalanceAfter !== undefined) {
                    if (currentUser && currentUser.name !== 'Topciu' && transaction.details) {
                        const userDetail = Object.values(transaction.details).find(detail => detail.name === currentUser.name);
                        if (userDetail) {
                            balanceAfterText = `<span>${userDetail.newBalance.toFixed(2)}</span>&nbsp;USD`;
                        } else {
                            balanceAfterText = '-'; // Fallback if user detail not found
                        }
                    } else {
                        balanceAfterText = `<span>${transaction.totalBalanceAfter.toFixed(2)}</span>&nbsp;USD`;
                    }
                } else {
                    balanceAfterText = '-';
                }
            }
            row.innerHTML = `
                <td>${new Date(transaction.createdAt.toDate()).toLocaleString()}</td><td>${transaction.type}</td><td>${descriptionText}</td>
                <td>${amountText}</td><td>${balanceAfterText}</td>
                                        <td class="action-buttons">
                            ${transaction.type === 'trade' ? `<button class="circle-btn details-toggle-btn" data-transaction-id="${transaction.id}" title="Pokaż szczegóły">+</button>` : ''}
                            ${loggedInUser && loggedInUser.name === 'Topciu' ? `<button class="circle-btn delete-btn delete-transaction-btn" title="Usuń transakcję" data-transaction-id="${transaction.id}">&times;</button>` : ''}
                        </td>`;
            transactionsHistoryBody.appendChild(row);
            if (transaction.type === 'trade' && transaction.details) {
                let detailsHtml = '';
                for (const userId in transaction.details) {
                    const detail = transaction.details[userId];
                    // Only show details if loggedInUser is Topciu or if the detail belongs to the the loggedInUser
                    if (currentUser && (currentUser.name === 'Topciu' || detail.name === currentUser.name)) {
                        if (currentUser.name === 'Topciu') {
                            // Dla Topcia - pokazuj kwoty netto i brutto z prowizjami
                            if (detail.name === 'Topciu') {
                                // Dla wpisu Topcia
                                const netAmount = detail.profitLossShare; // Kwota netto (podstawowy zysk bez prowizji)
                                const grossAmount = detail.profitLossShare + (detail.commissionCollected || 0); // Kwota brutto (podstawowy zysk + prowizje)
                                const commission = detail.commissionCollected || 0;
                                
                                const netClass = netAmount >= 0 ? 'positive-amount' : 'negative-amount';
                                const grossClass = grossAmount >= 0 ? 'positive-amount' : 'negative-amount';
                                const commissionClass = commission >= 0 ? 'positive-amount' : 'negative-amount';
                                
                                detailsHtml += `
                                    <div class="transaction-detail-row">
                                        <span class="detail-name">${detail.name}: </span>
                                        <span class="${netClass}">${netAmount >= 0 ? '+' : ''}${netAmount.toFixed(2)}</span>&nbsp;USD&nbsp;Netto&nbsp;
                                        (<span class="${grossClass}">${grossAmount >= 0 ? '+' : ''}${grossAmount.toFixed(2)}</span>&nbsp;USD&nbsp;Brutto,&nbsp;Prowizje:&nbsp;<span class="${commissionClass}">${commission >= 0 ? '+' : ''}${commission.toFixed(2)}</span>&nbsp;USD)
                                        <span class="detail-new-balance">Saldo:&nbsp;<span class="${detail.newBalance >= 0 ? 'positive-amount' : 'negative-amount'}">${detail.newBalance.toFixed(2)}</span>&nbsp;USD</span>
                                    </div>`;
                            } else {
                                // Dla innych użytkowników widzianych przez Topcia
                                const netAmount = detail.profitLossShare - (detail.commissionPaid || 0); // Kwota netto (po odliczeniu prowizji)
                                const grossAmount = detail.profitLossShare; // Kwota brutto (przed prowizją)
                                const commission = detail.commissionPaid || 0;
                                
                                const netClass = netAmount >= 0 ? 'positive-amount' : 'negative-amount';
                                const grossClass = grossAmount >= 0 ? 'positive-amount' : 'negative-amount';
                                const commissionClass = commission >= 0 ? 'positive-amount' : 'negative-amount';
                                
                                detailsHtml += `
                                    <div class="transaction-detail-row">
                                        <span class="detail-name">${detail.name}: </span>
                                        <span class="${netClass}">${netAmount >= 0 ? '+' : ''}${netAmount.toFixed(2)}</span>&nbsp;USD&nbsp;Netto&nbsp;
                                        (<span class="${grossClass}">${grossAmount >= 0 ? '+' : ''}${grossAmount.toFixed(2)}</span>&nbsp;USD&nbsp;Brutto,&nbsp;Prowizja:&nbsp;<span class="negative-amount">-${commission.toFixed(2)}</span>&nbsp;USD)
                                        <span class="detail-new-balance">Saldo:&nbsp;<span class="${detail.newBalance >= 0 ? 'positive-amount' : 'negative-amount'}">${detail.newBalance.toFixed(2)}</span>&nbsp;USD</span>
                                    </div>`;
                            }
                        } else {
                            // Dla innych użytkowników - stary sposób wyświetlania
                            const profitLossClass = detail.profitLossShare > 0 ? 'positive-amount' : 'negative-amount';
                            let commissionText = '';
                            if (detail.commissionPaid && detail.commissionPaid > 0) {
                                commissionText = ` (Prowizja:&nbsp;<span class="negative-amount">-${detail.commissionPaid.toFixed(2)}</span>&nbsp;USD)`;
                            }
                            detailsHtml += `
                                <div class="transaction-detail-row">
                                    <span class="detail-name">${detail.name}: </span>
                                    <span class="${profitLossClass}">${detail.profitLossShare > 0 ? '+' : ''}${detail.profitLossShare.toFixed(2)}</span>&nbsp;USD${commissionText}
                                    <span class="detail-new-balance">Saldo:&nbsp;<span class="${detail.newBalance >= 0 ? 'positive-amount' : 'negative-amount'}">${detail.newBalance.toFixed(2)}</span>&nbsp;USD</span>
                                </div>`;
                        }
                    }
                }
                // Dodaj wiersz szczegółów tylko jeśli detailsHtml nie jest pusty
                if (detailsHtml) {
                    const detailsRow = document.createElement('tr');
                    detailsRow.className = 'transaction-details-container';
                    detailsRow.id = `details-${transaction.id}`;
                    detailsRow.style.display = 'none';
                    detailsRow.innerHTML = `<td colspan="6"><div class="details-content">${detailsHtml}</div></td>`;
                    transactionsHistoryBody.appendChild(detailsRow);
                }
            }
        });
        drawMonthlyProfitsChart(transactions, currentUser); // Wywołaj funkcję rysowania wykresu
        
        // Oblicz szczegółowe statystyki automatycznie tylko dla użytkowników niebędących Topcien
        if (currentUser && currentUser.name !== 'Topciu') {
            calculateDetailedStats(transactions, currentUser);
        }

        // --- ARCHIWUM: grupowanie po miesiącach z rozwijaniem ---
        if (isArchiveView) {
            transactionsHistoryBody.innerHTML = '';
            // Grupuj transakcje według miesięcy
            const monthlyGroups = {};
            finalFilteredTransactions.forEach(transaction => {
                const transactionDate = transaction.createdAt.toDate();
                const monthKey = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
                const monthLabel = transactionDate.toLocaleDateString('pl-PL', { month: '2-digit', year: 'numeric' });
                if (!monthlyGroups[monthKey]) {
                    monthlyGroups[monthKey] = {
                        label: monthLabel,
                        transactions: []
                    };
                }
                monthlyGroups[monthKey].transactions.push(transaction);
            });
            // Sortuj miesiące od najnowszego do najstarszego
            const sortedMonths = Object.keys(monthlyGroups).sort().reverse();
            // Wyświetl nagłówki miesięcy i ukryte transakcje
            sortedMonths.forEach(monthKey => {
                const monthData = monthlyGroups[monthKey];
                
                // Oblicz zysk/stratę dla tego miesiąca
                let monthProfit = 0;
                monthData.transactions.forEach(transaction => {
                    // Logika dla transakcji 'trade'
                    if (transaction.type === 'trade' && transaction.details) {
                        const userDetail = transaction.details[currentUser.id];
                        if (userDetail) {
                            let profitFromTrade = userDetail.profitLossShare;
                            if (currentUser.name === 'Topciu') {
                                profitFromTrade += (userDetail.commissionCollected || 0);
                            } else {
                                profitFromTrade -= (userDetail.commissionPaid || 0);
                            }
                            monthProfit += profitFromTrade;
                        }
                    } 
                    // Logika dla wpłat i wypłat
                    else if ((transaction.type === 'deposit' || transaction.type === 'withdrawal') && transaction.userId === currentUser.id) {
                        monthProfit += (transaction.type === 'deposit' ? transaction.amount : -transaction.amount);
                    }
                });
                
                // Przygotuj tekst z zyskiem/stratą
                const profitText = monthProfit >= 0 ? `+${monthProfit.toFixed(2)}` : `${monthProfit.toFixed(2)}`;
                const profitClass = monthProfit >= 0 ? 'positive-amount' : 'negative-amount';
                
                // Dodaj nagłówek miesiąca z przyciskiem +
                const monthHeader = document.createElement('tr');
                monthHeader.className = 'month-header';
                monthHeader.innerHTML = `
                    <td colspan="6" class="month-header-cell">
                        <div class="month-header-content">
                            <button class="toggle-month-btn" data-month="${monthKey}">+</button>
                            <span class="month-label">${monthData.label}</span>
                            <span class="month-transaction-count">(${monthData.transactions.length} transakcji <span class="${profitClass}">${profitText} USD</span>)</span>
                            <button class="download-month-btn" data-month-key="${monthKey}" title="Pobierz CSV">Pobierz .csv</button>
                        </div>
                    </td>
                `;
                transactionsHistoryBody.appendChild(monthHeader);
                // Dodaj transakcje z tego miesiąca (domyślnie ukryte)
                monthData.transactions.forEach(transaction => {
                    const row = document.createElement('tr');
                    row.className = `month-trans-row month-trans-${monthKey}`;
                    row.style.display = 'none';
                    let descriptionText = "";
                    let amountText = '';
                    let balanceAfterText = '';
                    if (transaction.type === 'deposit' || transaction.type === 'withdrawal') {
                        descriptionText = `${transaction.userName}`;
                        amountText = `<span>${transaction.type === 'deposit' ? '+' : '-'}${transaction.amount.toFixed(2)}</span>&nbsp;USD`;
                        balanceAfterText = `<span>${transaction.balanceAfter.toFixed(2)}</span>&nbsp;USD`;
                    } else if (transaction.type === 'trade') {
                        let displayAmount = transaction.amount;
                        if (currentUser && currentUser.name !== 'Topciu' && transaction.details) {
                            const userDetail = Object.values(transaction.details).find(detail => detail.name === currentUser.name);
                            if (userDetail) {
                                displayAmount = userDetail.profitLossShare - (userDetail.commissionPaid || 0);
                            }
                        }
                        const tradeAmountClass = displayAmount > 0 ? 'positive-amount' : 'negative-amount';
                        amountText = `<span class="${tradeAmountClass}">${displayAmount > 0 ? '+' : ''}${displayAmount.toFixed(2)}</span>&nbsp;USD (Zysk/Strata)`;
                        descriptionText = `Zagranie`;
                        if (transaction.totalBalanceAfter !== undefined) {
                            if (currentUser && currentUser.name !== 'Topciu' && transaction.details) {
                                const userDetail = Object.values(transaction.details).find(detail => detail.name === currentUser.name);
                                if (userDetail) {
                                    balanceAfterText = `<span>${userDetail.newBalance.toFixed(2)}</span>&nbsp;USD`;
                                } else {
                                    balanceAfterText = '-'; // Fallback if user detail not found
                                }
                            } else {
                                balanceAfterText = `<span>${transaction.totalBalanceAfter.toFixed(2)}</span>&nbsp;USD`;
                            }
                        } else {
                            balanceAfterText = '-';
                        }
                    }
                    row.innerHTML = `
                        <td>${new Date(transaction.createdAt.toDate()).toLocaleString()}</td><td>${transaction.type}</td><td>${descriptionText}</td>
                        <td>${amountText}</td><td>${balanceAfterText}</td>
                        <td class="action-buttons">
                            ${transaction.type === 'trade' ? `<button class="circle-btn details-toggle-btn" data-transaction-id="${transaction.id}" title="Pokaż szczegóły">+</button>` : ''}
                            ${loggedInUser && loggedInUser.name === 'Topciu' ? `<button class="circle-btn delete-btn delete-transaction-btn" title="Usuń transakcję" data-transaction-id="${transaction.id}">&times;</button>` : ''}
                        </td>`;
                    transactionsHistoryBody.appendChild(row);
                    // Dodaj szczegóły transakcji jeśli to trade
                    if (transaction.type === 'trade' && transaction.details) {
                        let detailsHtml = '';
                        for (const userId in transaction.details) {
                            const detail = transaction.details[userId];
                            // Only show details if loggedInUser is Topciu or if the detail belongs to the the loggedInUser
                            if (currentUser && (currentUser.name === 'Topciu' || detail.name === currentUser.name)) {
                                if (currentUser.name === 'Topciu') {
                                    // Dla Topcia - pokazuj kwoty netto i brutto z prowizjami
                                    if (detail.name === 'Topciu') {
                                        // Dla wpisu Topcia
                                        const netAmount = detail.profitLossShare; // Kwota netto (podstawowy zysk bez prowizji)
                                        const grossAmount = detail.profitLossShare + (detail.commissionCollected || 0); // Kwota brutto (podstawowy zysk + prowizje)
                                        const commission = detail.commissionCollected || 0;
                                        const netClass = netAmount >= 0 ? 'positive-amount' : 'negative-amount';
                                        const grossClass = grossAmount >= 0 ? 'positive-amount' : 'negative-amount';
                                        const commissionClass = commission >= 0 ? 'positive-amount' : 'negative-amount';
                                        detailsHtml += `
                                            <div class="transaction-detail-row">
                                                <span class="detail-name">${detail.name}: </span>
                                                <span class="${netClass}">${netAmount >= 0 ? '+' : ''}${netAmount.toFixed(2)}</span>&nbsp;USD&nbsp;Netto&nbsp;
                                                (<span class="${grossClass}">${grossAmount >= 0 ? '+' : ''}${grossAmount.toFixed(2)}</span>&nbsp;USD&nbsp;Brutto,&nbsp;Prowizje:&nbsp;<span class="${commissionClass}">${commission >= 0 ? '+' : ''}${commission.toFixed(2)}</span>&nbsp;USD)
                                                <span class="detail-new-balance">Saldo:&nbsp;<span class="${detail.newBalance >= 0 ? 'positive-amount' : 'negative-amount'}">${detail.newBalance.toFixed(2)}</span>&nbsp;USD</span>
                                            </div>`;
                                    } else {
                                        // Dla innych użytkowników widzianych przez Topcia
                                        const netAmount = detail.profitLossShare - (detail.commissionPaid || 0); // Kwota netto (po odliczeniu prowizji)
                                        const grossAmount = detail.profitLossShare; // Kwota brutto (przed prowizją)
                                        const commission = detail.commissionPaid || 0;
                                        const netClass = netAmount >= 0 ? 'positive-amount' : 'negative-amount';
                                        const grossClass = grossAmount >= 0 ? 'positive-amount' : 'negative-amount';
                                        const commissionClass = commission >= 0 ? 'positive-amount' : 'negative-amount';
                                        detailsHtml += `
                                            <div class="transaction-detail-row">
                                                <span class="detail-name">${detail.name}: </span>
                                                <span class="${netClass}">${netAmount >= 0 ? '+' : ''}${netAmount.toFixed(2)}</span>&nbsp;USD&nbsp;Netto&nbsp;
                                                (<span class="${grossClass}">${grossAmount >= 0 ? '+' : ''}${grossAmount.toFixed(2)}</span>&nbsp;USD&nbsp;Brutto,&nbsp;Prowizja:&nbsp;<span class="negative-amount">-${commission.toFixed(2)}</span>&nbsp;USD)
                                                <span class="detail-new-balance">Saldo:&nbsp;<span class="${detail.newBalance >= 0 ? 'positive-amount' : 'negative-amount'}">${detail.newBalance.toFixed(2)}</span>&nbsp;USD</span>
                                            </div>`;
                                    }
                                } else {
                                    // Dla innych użytkowników - stary sposób wyświetlania
                                    const profitLossClass = detail.profitLossShare > 0 ? 'positive-amount' : 'negative-amount';
                                    let commissionText = '';
                                    if (detail.commissionPaid && detail.commissionPaid > 0) {
                                        commissionText = ` (Prowizja:&nbsp;<span class="negative-amount">-${detail.commissionPaid.toFixed(2)}</span>&nbsp;USD)`;
                                    }
                                    detailsHtml += `
                                        <div class="transaction-detail-row">
                                            <span class="detail-name">${detail.name}: </span>
                                            <span class="${profitLossClass}">${detail.profitLossShare > 0 ? '+' : ''}${detail.profitLossShare.toFixed(2)}</span>&nbsp;USD${commissionText}
                                            <span class="detail-new-balance">Saldo:&nbsp;<span class="${detail.newBalance >= 0 ? 'positive-amount' : 'negative-amount'}">${detail.newBalance.toFixed(2)}</span>&nbsp;USD</span>
                                        </div>`;
                                }
                            }
                        }
                        // Dodaj wiersz szczegółów tylko jeśli detailsHtml nie jest pusty
                        if (detailsHtml) {
                            const detailsRow = document.createElement('tr');
                            detailsRow.className = 'transaction-details-container';
                            detailsRow.id = `details-${transaction.id}`;
                            detailsRow.style.display = 'none';
                            detailsRow.innerHTML = `<td colspan="6"><div class="details-content">${detailsHtml}</div></td>`;
                            transactionsHistoryBody.appendChild(detailsRow);
                        }
                    }
                });
            });
            // Obsługa kliknięć na przyciski rozwijania miesięcy
            transactionsHistoryBody.querySelectorAll('.toggle-month-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const monthKey = this.getAttribute('data-month');
                    const rows = transactionsHistoryBody.querySelectorAll(`.month-trans-${monthKey}`);
                    const isOpen = this.textContent === '-';
                    rows.forEach(row => {
                        row.style.display = isOpen ? 'none' : '';
                    });
                    this.textContent = isOpen ? '+' : '-';
                });
            });

            // Obsługa pobierania CSV dla miesiąca
            transactionsHistoryBody.querySelectorAll('.download-month-btn').forEach(btn => {
                btn.addEventListener('click', function(event) {
                    event.stopPropagation();
                    const monthKey = this.getAttribute('data-month-key');
                    const monthData = monthlyGroups[monthKey];
                    if (monthData && monthData.transactions) {
                        const csvContent = generateCSV(monthData.transactions, loggedInUser);
                        downloadCSV(csvContent, `historia-${monthData.label}.csv`);
                    }
                });
            });
            return; // Nie wyświetlaj już poniżej, archiwum już obsłużone
        }
        // --- KONIEC ARCHIWUM ---
    }

    function calculateDetailedStats(transactions, currentUser) {
        if (!currentUser) return;

        const now = new Date();
        const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        let currentMonthProfit = 0;
        let monthlyTrades = 0; // Transakcje tylko z bieżącego miesiąca
        let monthlyProfitableTrades = 0; // Zyskowne z bieżącego miesiąca
        let monthlyLossTrades = 0; // Stratne z bieżącego miesiąca
        let totalTrades = 0; // Wszystkie transakcje
        let profitableTrades = 0; // Wszystkie zyskowne
        let lossTrades = 0; // Wszystkie stratne
        let totalProfit = 0; // Całkowity zysk ze wszystkich transakcji

        // Oblicz saldo na początku bieżącego miesiąca
        let balanceAtMonthStart = currentUser.startBalance || 0;
        
        // Oblicz wszystkie transakcje do początku bieżącego miesiąca
        transactions.forEach(transaction => {
            if (transaction.type === 'trade' && transaction.details) {
                const userDetail = Object.values(transaction.details).find(detail => detail.name === currentUser.name);
                if (userDetail) {
                    const transactionDate = transaction.createdAt.toDate();
                    let userProfit = userDetail.profitLossShare - (userDetail.commissionPaid || 0);
                    
                    // Dla Topcia dodaj prowizje zebrane od innych użytkowników
                    if (currentUser.name === 'Topciu' && userDetail.commissionCollected) {
                        userProfit += userDetail.commissionCollected;
                    }
                    
                    if (transactionDate < currentMonth) {
                        // Transakcje przed bieżącym miesiącem wpływają na saldo początkowe
                        balanceAtMonthStart += userProfit;
                    }
                }
            }
            
            // Dodaj wpłaty i wypłaty do salda początkowego
            if ((transaction.type === 'deposit' || transaction.type === 'withdrawal') && transaction.userName === currentUser.name) {
                const transactionDate = transaction.createdAt.toDate();
                if (transactionDate < currentMonth) {
                    balanceAtMonthStart += transaction.type === 'deposit' ? transaction.amount : -transaction.amount;
                }
            }
        });

        // Oblicz statystyki z wszystkich transakcji
        transactions.forEach(transaction => {
            if (transaction.type === 'trade' && transaction.details) {
                const userDetail = Object.values(transaction.details).find(detail => detail.name === currentUser.name);
                if (userDetail) {
                    const transactionDate = transaction.createdAt.toDate();
                    let userProfit = userDetail.profitLossShare - (userDetail.commissionPaid || 0);
                    
                    // Dla Topcia dodaj prowizje zebrane od innych użytkowników
                    if (currentUser.name === 'Topciu' && userDetail.commissionCollected) {
                        userProfit += userDetail.commissionCollected;
                    }
                    
                    totalTrades++;
                    
                    if (userProfit > 0) {
                        profitableTrades++;
                    } else if (userProfit < 0) {
                        lossTrades++;
                    }
                    
                    // Dodaj do całkowitego zysku
                    totalProfit += userProfit;

                    // Miesięczne zyski i liczba transakcji tylko z bieżącego miesiąca
                    if (transactionDate >= currentMonth && transactionDate <= currentMonthEnd) {
                        currentMonthProfit += userProfit;
                        monthlyTrades++;
                        
                        // Licz zyskowne/stratne transakcje dla bieżącego miesiąca
                        if (userProfit > 0) {
                            monthlyProfitableTrades++;
                        } else if (userProfit < 0) {
                            monthlyLossTrades++;
                        }
                    }
                }
            }
            
            // Dodaj wpłaty i wypłaty do całkowitego zysku
            if ((transaction.type === 'deposit' || transaction.type === 'withdrawal') && transaction.userName === currentUser.name) {
                const transactionDate = transaction.createdAt.toDate();
                const depositAmount = transaction.type === 'deposit' ? transaction.amount : -transaction.amount;
                
                // Dodaj do całkowitego zysku (wpłaty zwiększają zysk, wypłaty zmniejszają)
                totalProfit += depositAmount;
                
                // Jeśli to transakcja z bieżącego miesiąca, dodaj do miesięcznego zysku
                if (transactionDate >= currentMonth && transactionDate <= currentMonthEnd) {
                    currentMonthProfit += depositAmount;
                }
            }
        });

        // Oblicz miesięczną zmianę procentową na podstawie salda początkowego miesiąca
        let monthlyChangePercent = 0;
        if (balanceAtMonthStart > 0) {
            monthlyChangePercent = (currentMonthProfit / balanceAtMonthStart) * 100;
        } else if (currentMonthProfit !== 0) {
            monthlyChangePercent = currentMonthProfit > 0 ? 100 : -100;
        }

        // Oblicz skuteczność (z wszystkich transakcji)
        const successRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;
        
        // Oblicz skuteczność miesięczną
        const monthlySuccessRate = monthlyTrades > 0 ? (monthlyProfitableTrades / monthlyTrades) * 100 : 0;
        
        // Oblicz całkowitą zmianę procentową od salda początkowego
        // Uwzględnij wpłaty i wypłaty w obliczeniach
        const totalChangePercent = (currentUser.startBalance || 0) > 0 ? (totalProfit / (currentUser.startBalance || 1)) * 100 : (totalProfit > 0 ? 100 : (totalProfit < 0 ? -100 : 0));

        // Aktualizuj elementy DOM
        document.getElementById('monthlyProfit').textContent = `${currentMonthProfit.toFixed(2)} USD`;
        document.getElementById('monthlyChange').textContent = `${monthlyChangePercent.toFixed(1)}%`;
        document.getElementById('monthlyProfitableLossTrades').textContent = `${monthlyProfitableTrades}/${monthlyLossTrades}`;
        document.getElementById('monthlySuccessRate').textContent = `${monthlySuccessRate.toFixed(1)}%`;
        document.getElementById('totalProfit').textContent = `${totalProfit.toFixed(2)} USD`;
        document.getElementById('totalChange').textContent = `${totalChangePercent.toFixed(1)}%`;
        document.getElementById('profitableTrades').textContent = `${profitableTrades}/${lossTrades}`;
        document.getElementById('successRate').textContent = `${successRate.toFixed(1)}%`;

        // Dodaj kolory do wartości
        const monthlyProfitEl = document.getElementById('monthlyProfit');
        const monthlyChangeEl = document.getElementById('monthlyChange');
        const successRateEl = document.getElementById('successRate');
        const monthlySuccessRateEl = document.getElementById('monthlySuccessRate');
        const totalProfitEl = document.getElementById('totalProfit');
        const totalChangeEl = document.getElementById('totalChange');

        monthlyProfitEl.className = currentMonthProfit >= 0 ? 'positive-amount' : 'negative-amount';
        monthlyChangeEl.className = monthlyChangePercent >= 0 ? 'positive-amount' : 'negative-amount';
        successRateEl.className = successRate >= 50 ? 'positive-amount' : 'negative-amount';
        monthlySuccessRateEl.className = monthlySuccessRate >= 50 ? 'positive-amount' : 'negative-amount';
        totalProfitEl.className = totalProfit >= 0 ? 'positive-amount' : 'negative-amount';
        totalChangeEl.className = totalChangePercent >= 0 ? 'positive-amount' : 'negative-amount';
    }

    // --- OBSŁUGA ZDARZEŃ (EVENT LISTENERS) ---

    showAddUserModalBtn.addEventListener('click', () => {
        addUserModal.style.display = 'block';
        disableBodyScroll();
    });
    
    closeAddModalBtn.addEventListener('click', () => {
        addUserModal.style.display = 'none';
        enableBodyScroll();
    });
    
    closeEditModalBtn.addEventListener('click', () => {
        editUserModal.style.display = 'none';
        enableBodyScroll();
    });
    
    closeTransactionDetailsMobileModalBtn.addEventListener('click', () => {
        transactionDetailsMobileModal.style.display = 'none';
        enableBodyScroll();
    });

    window.addEventListener('click', (event) => {
        if (event.target == addUserModal) {
            addUserModal.style.display = "none";
            enableBodyScroll();
        }
        if (event.target == editUserModal) {
            editUserModal.style.display = "none";
            enableBodyScroll();
        }
        if (event.target == transactionDetailsMobileModal) {
            transactionDetailsMobileModal.style.display = "none";
            enableBodyScroll();
        }
        if (event.target == detailedStatsModal) {
            detailedStatsModal.style.display = "none";
            enableBodyScroll();
        }
        if (event.target == enlargedChartModal) {
            enlargedChartModal.style.display = "none";
            enableBodyScroll();
        }
        if (event.target == shareResultModal) {
            shareResultModal.style.display = "none";
            enableBodyScroll();
        }
        if (event.target == trackerDetailsModal) {
            trackerDetailsModal.style.display = "none";
            enableBodyScroll();
        }
    });

    // Obsługa modala ze statystykami
    closeDetailedStatsModalBtn.addEventListener('click', () => {
        detailedStatsModal.style.display = 'none';
        enableBodyScroll();
    });

    // Obsługa modala z większym wykresem
    closeEnlargedChartModalBtn.addEventListener('click', () => {
        enlargedChartModal.style.display = 'none';
        enableBodyScroll();
    });

    // Obsługa kliknięcia na wykres aby otworzyć większą wersję
    monthlyProfitsChart.addEventListener('click', () => {
        if (loggedInUser && loggedInUser.name !== 'Topciu') {
            drawEnlargedMonthlyProfitsChart(cachedTransactions, loggedInUser);
            enlargedChartModal.style.display = 'flex';
            disableBodyScroll();
        }
    });

    // Zmienna globalna do przechowywania aktualnie wybranego użytkownika
    let currentSelectedUser = null;

    // Obsługa kliknięcia na kolorowe karty użytkowników
    userSummaryCards.addEventListener('click', (event) => {
        const userCard = event.target.closest('.user-summary-card');
        if (userCard) {
            const userId = userCard.getAttribute('data-user-id');
            const user = cachedUsers.find(u => u.id === userId);
            
            if (user) {
                // Zapisz aktualnie wybranego użytkownika
                currentSelectedUser = user;
                // Oblicz statystyki dla wybranego użytkownika
                calculateDetailedStats(cachedTransactions, user);
                detailedStatsModal.style.display = 'flex';
                disableBodyScroll();
            }
        }
    });

    // Obsługa przełączania widoczności hasła
    if (toggleEditPassword) {
        toggleEditPassword.addEventListener('click', () => {
            const type = editPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            editPasswordInput.setAttribute('type', type);
            toggleEditPassword.textContent = type === 'password' ? 'Pokaż' : 'Ukryj';
        });
    }

    

    function populateAllUsersForPermissions() {
        existingUsersList.innerHTML = '';
        allUsersForPermissions.forEach(user => {
            const permissions = user.permissions || [];
            // Wyklucz użytkownika "Topciu" z listy
            if (user.name !== 'Topciu' && !permissions.includes(APLIKACJA_ID)) {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.name;
                existingUsersList.appendChild(option);
            }
        });
    }

    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!loggedInUser || loggedInUser.name !== 'Topciu') {
            alert('Tylko Topciu może wykonywać te operacje.');
            return;
        }

        const action = actionTypeSelect.value;

        if (action === 'create') {
            const userName = document.getElementById('user-name').value;
            const password = document.getElementById('user-password').value;
            const userColor = document.getElementById('user-color').value;
            const startBalance = parseFloat(document.getElementById('user-balance').value);
            const commission = parseFloat(document.getElementById('user-commission').value);

            if (userName && password && !isNaN(startBalance) && !isNaN(commission)) {
                try {
                    const hashedPassword = await hashPassword(password);
                    await addDoc(collection(db, "users"), {
                        name: userName,
                        hashedPassword: hashedPassword,
                        color: userColor,
                        startBalance: startBalance,
                        currentBalance: startBalance,
                        commission: commission,
                        createdAt: new Date(),
                        permissions: ["topfund-terminal"]
                    });
                    addUserForm.reset();
                    addUserModal.style.display = 'none';
                    enableBodyScroll();
                    
                } catch (error) {
                    console.error("Błąd podczas dodawania użytkownika: ", error);
                    alert("Wystąpił błąd podczas dodawania użytkownika.");
                }
            } else {
                alert('Proszę wypełnić wszystkie pola poprawnymi danymi.');
            }
        } else if (action === 'grant') {
            const userId = existingUsersList.value;
            if (userId) {
                try {
                    const userToUpdate = allUsersForPermissions.find(u => u.id === userId);
                    if (!userToUpdate) {
                        alert("Nie znaleziono użytkownika. Odśwież stronę i spróbuj ponownie.");
                        return;
                    }
                    const userRef = doc(db, "users", userId);
                    const updateData = {
                        permissions: [...(userToUpdate.permissions || []), APLIKACJA_ID]
                    };

                    // Add default fields if they don't exist to ensure consistency
                    if (userToUpdate.commission === undefined) {
                        updateData.commission = 30; // Default commission
                    }
                    if (userToUpdate.color === undefined) {
                        updateData.color = "#ff0000"; // Default color
                    }
                    if (userToUpdate.startBalance === undefined) {
                        updateData.startBalance = 0;
                    }
                    if (userToUpdate.currentBalance === undefined) {
                        updateData.currentBalance = 0;
                    }

                    await updateDoc(userRef, updateData);
                    addUserModal.style.display = 'none';
                    enableBodyScroll();
                } catch (error) {
                    console.error("Błąd podczas nadawania uprawnień: ", error);
                    alert("Wystąpił błąd podczas nadawania uprawnień.");
                }
            } else {
                alert('Proszę wybrać użytkownika.');
            }
        }
    });

    editUserForm.addEventListener('submit', handleEditUserSubmit);

    transactionTypeSelect.addEventListener('change', updateTransactionFormUI);

    addTransactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = transactionTypeSelect.value;
        const userId = transactionUserSelect.value;
        const amount = parseFloat(transactionAmountInput.value);
        const mode = transactionModeSelect.value; // Pobierz tryb

        if (isNaN(amount)) { // Zmieniono warunek, aby zezwolić na kwoty ujemne
            alert('Proszę podać prawidłową kwotę transakcji.'); return;
        }
        if ((type === 'deposit' || type === 'withdrawal') && !userId) {
            alert('Proszę wybrać użytkownika dla wpłaty/wypłaty.'); return;
        }
        try {
            await processTransaction(type, userId, amount, mode); // Przekaż tryb do funkcji
            addTransactionForm.reset();
            updateTransactionFormUI(); // << NOWOŚĆ: Zresetuj UI formularza
        } catch (error) {
            console.error("Błąd podczas przetwarzania transakcji: ", error);
            alert(`Wystąpił błąd: ${error.message}`);
        }
    });

    usersList.addEventListener('click', (event) => {
        const editButton = event.target.closest('.edit-btn');
        const deleteButton = event.target.closest('.delete-user-btn');
        if (editButton) {
            const user = cachedUsers.find(u => u.id === editButton.dataset.userId);
            if (user) openEditModal(user);
        }
        if (deleteButton) {
            openDeleteModal(deleteButton.dataset.userId, deleteButton.dataset.userName);
        }
    });

    closeDeleteUserModalBtn.addEventListener('click', () => {
        deleteUserModal.style.display = 'none';
        enableBodyScroll();
    });

    revokePermissionsBtn.addEventListener('click', async () => {
        if (userIdToDelete) {
            try {
                const userRef = doc(db, "users", userIdToDelete);
                await updateDoc(userRef, { permissions: [] });
                deleteUserModal.style.display = 'none';
                enableBodyScroll();
            } catch (error) {
                console.error("Błąd podczas odbierania uprawnień: ", error);
                alert("Wystąpił błąd podczas odbierania uprawnień.");
            }
        }
    });

    deleteUserPermanentlyBtn.addEventListener('click', async () => {
        if (userIdToDelete) {
            try {
                await deleteDoc(doc(db, "users", userIdToDelete));
                await recalculateAllBalances();
                
                deleteUserModal.style.display = 'none';
                enableBodyScroll();
            } catch (error) {
                console.error("Błąd podczas usuwania użytkownika: ", error);
                alert("Wystąpił błąd podczas usuwania użytkownika.");
            }
        }
    });

    transactionsHistoryBody.addEventListener('click', (event) => {
        const detailsButton = event.target.closest('.details-toggle-btn');
        const deleteButton = event.target.closest('.delete-transaction-btn');

        if (detailsButton) {
            const transactionId = detailsButton.dataset.transactionId;
            const transaction = cachedTransactions.find(t => t.id === transactionId);

            // Logika dla urządzeń mobilnych -> Pokaż modal
            if (window.innerWidth <= 768 && transaction && transaction.details) {
                let detailsHtml = '';
                for (const userId in transaction.details) {
                    const detail = transaction.details[userId];
                    if (loggedInUser && (loggedInUser.name === 'Topciu' || detail.name === loggedInUser.name)) {
                        if (loggedInUser.name === 'Topciu') {
                            // Dla Topcia - pokazuj kwoty netto i brutto z prowizjami
                            if (detail.name === 'Topciu') {
                                // Dla wpisu Topcia
                                const netAmount = detail.profitLossShare; // Kwota netto (podstawowy zysk bez prowizji)
                                const grossAmount = detail.profitLossShare + (detail.commissionCollected || 0); // Kwota brutto (podstawowy zysk + prowizje)
                                const commission = detail.commissionCollected || 0;
                                
                                const netClass = netAmount >= 0 ? 'positive-amount' : 'negative-amount';
                                const grossClass = grossAmount >= 0 ? 'positive-amount' : 'negative-amount';
                                const commissionClass = commission >= 0 ? 'positive-amount' : 'negative-amount';
                                
                                detailsHtml += `
                                    <div class="mobile-detail-card">
                                        <h4>${detail.name}</h4>
                                        <p>Zysk/Strata: <span class="${netClass}">${netAmount >= 0 ? '+' : ''}${netAmount.toFixed(2)} USD Netto</span></p>
                                        <p>(<span class="${grossClass}">${grossAmount >= 0 ? '+' : ''}${grossAmount.toFixed(2)} USD Brutto</span>, Prowizje: <span class="${commissionClass}">${commission >= 0 ? '+' : ''}${commission.toFixed(2)} USD</span>)</p>
                                        <p>Saldo po operacji: <strong>${detail.newBalance.toFixed(2)} USD</strong></p>
                                    </div>
                                `;
                            } else {
                                // Dla innych użytkowników widzianych przez Topcia
                                const netAmount = detail.profitLossShare - (detail.commissionPaid || 0); // Kwota netto (po odliczeniu prowizji)
                                const grossAmount = detail.profitLossShare; // Kwota brutto (przed prowizją)
                                const commission = detail.commissionPaid || 0;
                                
                                const netClass = netAmount >= 0 ? 'positive-amount' : 'negative-amount';
                                const grossClass = grossAmount >= 0 ? 'positive-amount' : 'negative-amount';
                                
                                detailsHtml += `
                                    <div class="mobile-detail-card">
                                        <h4>${detail.name}</h4>
                                        <p>Zysk/Strata: <span class="${netClass}">${netAmount >= 0 ? '+' : ''}${netAmount.toFixed(2)} USD Netto</span></p>
                                        <p>(<span class="${grossClass}">${grossAmount >= 0 ? '+' : ''}${grossAmount.toFixed(2)} USD Brutto</span>, Prowizja: <span class="negative-amount">-${commission.toFixed(2)} USD</span>)</p>
                                        <p>Saldo po operacji: <strong>${detail.newBalance.toFixed(2)} USD</strong></p>
                                    </div>
                                `;
                            }
                        } else {
                            // Dla innych użytkowników - stary sposób wyświetlania
                            const profitLossClass = detail.profitLossShare >= 0 ? 'positive-amount' : 'negative-amount';
                            const commissionText = (detail.commissionPaid && detail.commissionPaid > 0) 
                                ? `<p>Prowizja: <span class="negative-amount">-${detail.commissionPaid.toFixed(2)} USD</span></p>` : '';

                            detailsHtml += `
                                <div class="mobile-detail-card">
                                    <h4>${detail.name}</h4>
                                    <p>Zysk/Strata: <span class="${profitLossClass}">${detail.profitLossShare >= 0 ? '+' : ''}${detail.profitLossShare.toFixed(2)} USD</span></p>
                                    ${commissionText}
                                    <p>Saldo po operacji: <strong>${detail.newBalance.toFixed(2)} USD</strong></p>
                                </div>
                            `;
                        }
                    }
                }
                transactionDetailsMobileContent.innerHTML = detailsHtml;
                transactionDetailsMobileModal.style.display = 'flex';
                disableBodyScroll();
            } else { // Logika dla desktopów -> Rozwiń wiersz
                const detailsContainer = document.getElementById(`details-${transactionId}`);
                if (detailsContainer) {
                    const isHidden = detailsContainer.style.display === 'none';
                    detailsContainer.style.display = isHidden ? 'table-row' : 'none';
                    detailsButton.textContent = isHidden ? '–' : '+';
                    detailsButton.title = isHidden ? 'Ukryj szczegóły' : 'Pokaż szczegóły';
                }
            }
        }



        if (deleteButton) {
            deleteTransaction(deleteButton.dataset.transactionId);
        }
    });

    toggleArchiveBtn.addEventListener('click', () => {
        isArchiveView = !isArchiveView;
        toggleArchiveBtn.textContent = isArchiveView ? 'Pokaż aktualne' : 'Pokaż archiwum';
        toggleArchiveBtn.classList.toggle('active');
        displayTransactions(cachedTransactions, loggedInUser); // Odśwież widok z nowym filtrem
    });

    // --- FUNKCJA DO OBSŁUGI WIDGETÓW ---
    function updateMonthlyProgressWidget(transactions, currentUser) {
        console.log('=== WIDGET DEBUG START ===');
        console.log('Widget: Funkcja wywołana');
        console.log('Widget: currentUser:', currentUser);
        
        if (!currentUser || currentUser.name !== 'Topciu') {
            console.log('Widget: Nie Topciu lub brak użytkownika');
            return;
        }
        
        // Sprawdź czy mamy dane użytkowników
        if (!cachedUsers || cachedUsers.length === 0) {
            console.log('Widget: Brak danych użytkowników, czekam...');
            return;
        }
        
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const targetPercentage = 3; // Cel: 3%
        
        // Oblicz saldo Topcia na początku miesiąca (startBalance + transakcje sprzed miesiąca)
        const topciuUser = (cachedUsers || []).find(u => u.name === 'Topciu');
        let balanceAtMonthStart = (topciuUser && topciuUser.startBalance) ? topciuUser.startBalance : 0;
        transactions.forEach(transaction => {
            const tDate = transaction.createdAt.toDate();
            if (tDate < currentMonthStart) {
                if (transaction.type === 'trade' && transaction.details) {
                    const d = Object.values(transaction.details).find(v => v.name === 'Topciu');
                    if (d) {
                        let pnl = d.profitLossShare - (d.commissionPaid || 0);
                        if (d.commissionCollected) pnl += d.commissionCollected;
                        balanceAtMonthStart += pnl;
                    }
                } else if ((transaction.type === 'deposit' || transaction.type === 'withdrawal') && transaction.userName === 'Topciu') {
                    const amount = transaction.type === 'deposit' ? (transaction.amount || 0) : -(transaction.amount || 0);
                    balanceAtMonthStart += amount;
                }
            }
        });
        
        // Oblicz zysk Topcia z bieżącego miesiąca
        let currentMonthProfit = 0;
        transactions.forEach(transaction => {
            const tDate = transaction.createdAt.toDate();
            if (tDate >= currentMonthStart) {
                if (transaction.type === 'trade' && transaction.details) {
                    const d = Object.values(transaction.details).find(v => v.name === 'Topciu');
                    if (d) {
                        let pnl = d.profitLossShare - (d.commissionPaid || 0);
                        if (d.commissionCollected) pnl += d.commissionCollected;
                        currentMonthProfit += pnl;
                    }
                } else if ((transaction.type === 'deposit' || transaction.type === 'withdrawal') && transaction.userName === 'Topciu') {
                    const amount = transaction.type === 'deposit' ? (transaction.amount || 0) : -(transaction.amount || 0);
                    currentMonthProfit += amount;
                }
            }
        });
        
        console.log('Widget: Zysk z bieżącego miesiąca:', currentMonthProfit);
        
        // Oblicz procent postępu do celu
        let progressPercentage = 0;
        if (balanceAtMonthStart > 0) {
            const actualPercentage = (currentMonthProfit / balanceAtMonthStart) * 100;
            // Oblicz procent postępu do celu (np. 0.7% z 3% = 23.3%)
            progressPercentage = Math.min((actualPercentage / targetPercentage) * 100, 100);
        } else if (currentMonthProfit > 0) {
            progressPercentage = 100; // Jeśli nie było salda początkowego, ale jest zysk
        }
        
        console.log('Widget: Procent postępu do celu:', progressPercentage);
        console.log('Widget: Rzeczywisty procent:', (currentMonthProfit / balanceAtMonthStart) * 100);
        
        // Aktualizuj widget
        const progressFill = document.getElementById('monthly-progress-fill');
        const progressPercentageEl = document.getElementById('monthly-progress-percentage');
        
        console.log('Widget: Elementy DOM:');
        console.log('- progressFill:', progressFill);
        console.log('- progressPercentageEl:', progressPercentageEl);
        
        if (progressFill && progressPercentageEl) {
            // Ogranicz postęp do maksymalnie 100% dla wizualizacji
            const visualProgress = Math.min(progressPercentage, 100);
            
            // Sprawdź czy pasek jest już zainicjalizowany
            const currentWidth = progressFill.style.width;
            const isInitialized = currentWidth && currentWidth !== '0%';
            
            if (!isInitialized) {
                // Pierwsze uruchomienie - ustaw na 0% i animuj
                progressFill.style.width = '0%';
                
                // Użyj setTimeout aby dać czas na renderowanie początkowego stanu
                setTimeout(() => {
                    // Płynnie wypełnij pasek do docelowej wartości
                    progressFill.style.width = `${visualProgress}%`;
                }, 100);
            } else {
                // Kolejne uruchomienia - animuj bezpośrednio
                progressFill.style.width = `${visualProgress}%`;
            }
            
            // Wyświetl realny miesięczny wynik Topcia (spójny z kartą), zaokrąglony do 0.1% z zaokrągleniem standardowym
            const actualPct = balanceAtMonthStart > 0 ? (currentMonthProfit / balanceAtMonthStart * 100) : (currentMonthProfit > 0 ? 100 : 0);
            const displayPct = Math.round(actualPct * 10) / 10; // 1.25 -> 1.3
            progressPercentageEl.textContent = `${displayPct.toFixed(1)}%`;
            
            // Zmień kolor paska w zależności od postępu do celu
            if (progressPercentage >= 100) {
                progressFill.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
            } else if (progressPercentage >= 50) {
                progressFill.style.background = 'linear-gradient(90deg, #f39c12, #e67e22)';
            } else {
                progressFill.style.background = 'linear-gradient(90deg, #e67e22, #f39c12)';
            }
            
            console.log('Widget: Zaktualizowano - Postęp do celu:', visualProgress + '%', 'Kolor:', progressFill.style.background);
            
            // Zapisz dane do modala szczegółów
            window.trackerData = {
                currentProgress: (currentMonthProfit / balanceAtMonthStart * 100),
                targetPercentage: targetPercentage,
                remainingPercentage: Math.max(0, targetPercentage - (currentMonthProfit / balanceAtMonthStart * 100)),
                remainingAmount: Math.max(0, (balanceAtMonthStart * targetPercentage / 100) - currentMonthProfit),
                startBalance: balanceAtMonthStart,
                currentProfit: currentMonthProfit,
                targetAmount: balanceAtMonthStart * targetPercentage / 100,
                daysLeft: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()
            };

            // Zaktualizuj widget Ekstrapolacji, który korzysta z trackerData
            updateExtrapolationWidget();
        } else {
            console.log('Widget: Nie znaleziono elementów DOM');
        }
    }

    // --- GŁÓWNE NASŁUCHIWANIE NA ZMIANY W BAZIE ---
    onSnapshot(query(collection(db, "users"), orderBy("createdAt")), (snapshot) => {
        const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allUsersForPermissions = allUsers; // Keep a reference to all users
        
        // Filtruj użytkowników, aby uwzględnić tylko tych z uprawnieniem 'topfund-terminal' lub użytkownika 'Topciu'
        cachedUsers = allUsers.filter(user => {
            const permissions = user.permissions || [];
            return user.name === 'Topciu' || permissions.includes('topfund-terminal');
        });

        displayUsers(cachedUsers);
        displayUserSummaryCards(cachedUsers, loggedInUser);
        populateTransactionUserSelect(cachedUsers);
        
        // Aktualizuj widget po załadowaniu danych użytkowników
        if (loggedInUser && loggedInUser.name === 'Topciu' && cachedTransactions && cachedTransactions.length >= 0) {
            console.log('Widget: Wywołanie po załadowaniu użytkowników');
            
            // Sprawdź czy elementy widgetu istnieją
            const progressFill = document.getElementById('monthly-progress-fill');
            const progressPercentageEl = document.getElementById('monthly-progress-percentage');
            
            console.log('Widget: Sprawdzenie elementów DOM:');
            console.log('- progressFill:', progressFill);
            console.log('- progressPercentageEl:', progressPercentageEl);
            
            if (progressFill && progressPercentageEl) {
                updateMonthlyProgressWidget(cachedTransactions, loggedInUser);
                
                
            } else {
                console.log('Widget: BŁĄD - Brak elementów DOM widgetu!');
                
                // Sprawdź czy sekcja widgetów jest widoczna
                const widgetsSection = document.getElementById('widgets-section');
                console.log('Widget: Sekcja widgetów w tym momencie:', widgetsSection);
                if (widgetsSection) {
                    console.log('Widget: Style sekcji widgetów:', widgetsSection.style.display);
                }
            }
        }
        // Pokaż rząd widgetów dla zwykłych użytkowników
        if (loggedInUser && loggedInUser.name !== 'Topciu') {
            const row = document.getElementById('user-widgets-row');
            if (row) row.style.display = 'grid';
            setupUserWidgetsToggle();
            // Upewnij się, że elementy canvas są gotowe zanim narysujemy
            setTimeout(() => drawUserWidgets(loggedInUser), 50);
        }
    });

    onSnapshot(query(collection(db, "transactions"), orderBy("createdAt", "desc")), (snapshot) => {
        cachedTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayTransactions(cachedTransactions, loggedInUser); // Wyświetl dane z uwzględnieniem filtra archiwum
        
        // Aktualizuj widget tylko jeśli mamy dane użytkowników
        if (cachedUsers && cachedUsers.length > 0) {
            console.log('Widget: Wywołanie po załadowaniu transakcji');
            updateMonthlyProgressWidget(cachedTransactions, loggedInUser); // Aktualizuj widget miesięcznego trackera
            
            // Automatycznie wczytaj widget wykresu miesięcznego dla Topcia
            if (loggedInUser && loggedInUser.name === 'Topciu') {
                updateTopciuMonthlyWidgetChart();
            }
            // Odśwież widgety użytkownika (zwykłego)
            if (loggedInUser && loggedInUser.name !== 'Topciu') {
                drawUserWidgets(loggedInUser);
            }
        }
    });
    // --- WIDGETY użytkownika (nie Topciu) ---
    function drawUserWidgets(user) {
        if (!user || user.name === 'Topciu') return;
        // Zawsze rysuj słupkowy jako pierwszy (zawsze widoczny)
        drawMonthlyProfitsChart(cachedTransactions || [], user);
        // Ekstrapolacja może być zwinięta – rysuj tylko gdy widoczna
        const row = document.getElementById('user-widgets-row');
        const extrapCard = document.getElementById('user-extrapolation-widget');
        if (row && extrapCard && extrapCard.style.display !== 'none') {
            updateUserExtrapolationWidget(user);
        }
    }

    function setupUserWidgetsToggle() {
        const btn = document.getElementById('toggleUserWidgetsBtn');
        const extrapCard = document.getElementById('user-extrapolation-widget');
        if (!btn || !extrapCard) return;
        // Domyślnie schowaj ekstrapolację
        const saved = localStorage.getItem('userWidgetsExpanded');
        const isExpanded = saved === 'true';
        extrapCard.style.display = isExpanded ? '' : 'none';
        btn.textContent = isExpanded ? '−' : '+';
        btn.onclick = () => {
            const isHidden = extrapCard.style.display === 'none';
            extrapCard.style.display = isHidden ? '' : 'none';
            btn.textContent = isHidden ? '−' : '+';
            localStorage.setItem('userWidgetsExpanded', String(isHidden));
            if (isHidden && loggedInUser && loggedInUser.name !== 'Topciu') {
                // Po rozwinięciu narysuj wykres ekstrapolacji
                updateUserExtrapolationWidget(loggedInUser);
            }
        };
    }

    function computeUserMonthlyRate(user) {
        if (!user) return 0;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        let balanceAtMonthStart = (cachedUsers || []).find(u => u.id === user.id)?.startBalance || user.startBalance || 0;
        let currentMonthProfit = 0;
        if (Array.isArray(cachedTransactions)) {
            cachedTransactions.forEach(t => {
                const tDate = t.createdAt.toDate();
                const before = tDate < monthStart;
                const current = tDate >= monthStart;
                if (t.type === 'trade' && t.details) {
                    const d = Object.values(t.details).find(v => v.name === user.name);
                    if (d) {
                        const pnl = d.profitLossShare - (d.commissionPaid || 0);
                        if (before) balanceAtMonthStart += pnl;
                        if (current) currentMonthProfit += pnl;
                    }
                } else if ((t.type === 'deposit' || t.type === 'withdrawal') && t.userName === user.name) {
                    const amount = t.type === 'deposit' ? (t.amount || 0) : -(t.amount || 0);
                    if (before) balanceAtMonthStart += amount;
                    if (current) currentMonthProfit += amount;
                }
            });
        }
        if (balanceAtMonthStart <= 0) return 0;
        return currentMonthProfit / balanceAtMonthStart;
    }

    function updateUserExtrapolationWidget(user) {
        const row = document.getElementById('user-widgets-row');
        const rateEl = document.getElementById('user-extrapolation-monthly-rate');
        const finalEl = document.getElementById('user-extrapolation-final-value');
        const canvas = document.getElementById('user-extrapolation-chart');
        if (!row || !rateEl || !finalEl || !canvas) {
            // Spróbuj ponownie po krótkim czasie – możliwe, że DOM jeszcze się renderuje
            setTimeout(() => updateUserExtrapolationWidget(user), 80);
            return;
        }

        const monthlyRate = computeUserMonthlyRate(user);
        const ratePct = Math.round(monthlyRate * 1000) / 10;
        rateEl.textContent = `${ratePct >= 0 ? '+' : ''}${ratePct.toFixed(1)}%`;
        rateEl.className = ratePct >= 0 ? 'extrapolation-green' : 'negative-amount';

        const base = getUserCurrentBalance(user);
        if (!isFinite(base)) {
            setTimeout(() => updateUserExtrapolationWidget(user), 80);
            return;
        }
        if (base <= 0) {
            finalEl.textContent = '—';
            if (canvas.chart) { canvas.chart.destroy(); canvas.chart = null; }
            // Zamiast kończyć – narysuj płaską linię, by widget był widoczny
            const labels = [''];
            const values = [0];
            if (canvas.chart) canvas.chart.destroy();
            canvas.chart = new Chart(canvas, {
                type: 'line',
                data: { labels, datasets: [{ data: values, borderColor: '#27ae60', pointRadius: 0 }]},
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
            });
            return;
        }

        // Buduj serię do roku docelowego
        const now = new Date();
        let months = computeMonthsUntilYear(EXTRAPOLATION_TARGET_YEAR);
        const labels = [];
        const values = [];
        let value = base;
        for (let i = 0; i < months; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            // Mały wykres użytkownika: dwie cyfry roku na styczniu
            labels.push(d.getMonth() === 0 ? String(d.getFullYear()).slice(2) : '');
            if (i > 0) value = value * (1 + monthlyRate);
            values.push(value);
        }
        finalEl.textContent = abbreviateNumber(values[values.length - 1]);

        if (canvas.chart) canvas.chart.destroy();
        canvas.chart = new Chart(canvas, {
            type: 'line',
            data: { labels, datasets: [{
                label: 'Prognoza wartości (USD)',
                data: values,
                borderColor: '#27ae60',
                backgroundColor: 'rgba(39, 174, 96, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.2,
                fill: true
            }]},
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { autoSkip: false, callback: (v, i) => labels[i] || undefined } },
                    y: { grid: { color: 'rgba(0,0,0,0.08)' }, ticks: { callback: v => v.toLocaleString('pl-PL') + ' USD' } }
                }
            }
        });

        // Kliknięcie karty otwiera szczegółowy wykres ekstrapolacji dostosowany do użytkownika
        const card = document.getElementById('user-extrapolation-widget');
        if (card) {
            card.onclick = () => openUserExtrapolationModal(user);
        }
    }

    // Szczegółowy wykres ekstrapolacji dla zwykłego użytkownika (z PLN)
    async function openUserExtrapolationModal(user) {
        const modal = document.getElementById('extrapolationChartModal');
        if (!modal) return;
        // zaktualizuj podsumowanie PLN/USD z perspektywy użytkownika
        const monthlyRate = computeUserMonthlyRate(user);
        const base = getUserCurrentBalance(user);
        if (base <= 0) {
            modal.style.display = 'flex';
            disableBodyScroll();
            return;
        }
        // Przygotuj serię
        const now = new Date();
        let months = computeMonthsUntilYear(EXTRAPOLATION_TARGET_YEAR);
        let value = base;
        for (let i = 0; i <= months; i++) {
            if (i > 0) value = value * (1 + monthlyRate);
        }
        // Ustaw podsumowanie
        const usdEl = document.getElementById('extrapolation-final-usd-num');
        const plnEl = document.getElementById('extrapolation-final-pln-num');
        if (usdEl) usdEl.textContent = abbreviateNumber(value);
        if (plnEl) {
            const pln = await convertUsdToPln(value);
            plnEl.textContent = abbreviateNumber(pln);
        }
        // Narysuj duży wykres
        await drawExtrapolationLargeForUser(user);
        modal.style.display = 'flex';
        disableBodyScroll();
    }

    async function drawExtrapolationLargeForUser(user) {
        const canvas = document.getElementById('extrapolation-chart-large');
        if (!canvas) return;
        // Rozmiar jak w drawExtrapolationLarge (zre-użyj kalkulatora)
        const size = computeEnlargedChartSize();
        const shrink = 0.8;
        canvas.width = Math.floor(size.width * shrink);
        canvas.height = Math.floor(size.height * shrink);

        const monthlyRate = computeUserMonthlyRate(user);
        const base = getUserCurrentBalance(user);
        if (base <= 0) return;
        const now = new Date();
        let months = computeMonthsUntilYear(EXTRAPOLATION_TARGET_YEAR);
        const labels = [];
        const values = [];
        let value = base;
        for (let i = 0; i < months; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            // Pełny widok u Topcia: dwie cyfry roku, aby oszczędzić miejsce
            labels.push(d.getMonth() === 0 ? String(d.getFullYear()).slice(2) : '');
            if (i > 0) value = value * (1 + monthlyRate);
            values.push(value);
        }
        if (canvas.chart) canvas.chart.destroy();
        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#ffffff' : '#333333';
        const gridColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';
        canvas.chart = new Chart(canvas, {
            type: 'line',
            data: { labels, datasets: [{
                label: 'Prognoza wartości (USD)',
                data: values,
                borderColor: '#27ae60',
                backgroundColor: 'rgba(39, 174, 96, 0.1)',
                borderWidth: 3,
                pointRadius: 0,
                tension: 0.2,
                fill: true
            }]},
            options: {
                responsive: false,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { display: false }, tooltip: { enabled: true, mode: 'index', intersect: false } },
                scales: {
                    x: { grid: { display: false }, title: { display: true, text: 'Rok', color: textColor }, ticks: { maxTicksLimit: 12, color: textColor, autoSkip: false, maxRotation: 0, callback: (v,i) => labels[i] || undefined } },
                    y: { grid: { color: gridColor }, ticks: { color: textColor, callback: v => v.toLocaleString('pl-PL') + ' USD' } }
                }
            }
        });
    }

    function getUserCurrentBalance(user) {
        try {
            // Wersja szybka: użyj pola z listy użytkowników jeśli jest, fallback na 0
            const u = (cachedUsers || []).find(u => u.id === user.id) || user;
            return parseFloat(u.currentBalance || u.balance || u.startBalance || 0) || 0;
        } catch { return 0; }
    }

    // usunięto poprzedni widget tekstowy miesięcznego zysku – wykres słupkowy działa jako widget

    // --- Obsługa zmiany motywu ---
    const currentTheme = localStorage.getItem('theme');

    if (currentTheme) {
        document.body.classList.add(currentTheme);
        if (currentTheme === 'dark-mode') {
            themeToggle.textContent = '☀️';
        }
    }

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        let theme = 'light-mode';
        if (document.body.classList.contains('dark-mode')) {
            theme = 'dark-mode';
            themeToggle.textContent = '☀️';
        } else {
            themeToggle.textContent = '🌙';
        }
        localStorage.setItem('theme', theme);
        
        // Odśwież wykres po zmianie motywu
        if (loggedInUser && loggedInUser.name !== 'Topciu') {
            drawMonthlyProfitsChart(cachedTransactions, loggedInUser);
            // Jeśli modal z większym wykresem jest otwarty, odśwież go też
            if (enlargedChartModal.style.display === 'flex') {
                drawEnlargedMonthlyProfitsChart(cachedTransactions, loggedInUser);
            }
        }
        
        // Odśwież widgety po zmianie motywu
        if (loggedInUser && loggedInUser.name === 'Topciu') {
            updateMonthlyProgressWidget(cachedTransactions, loggedInUser);
            updateTopciuMonthlyWidgetChart();
        }
    });

    // Obsługa modala z większym wykresem
    closeEnlargedChartModalBtn.addEventListener('click', () => {
        enlargedChartModal.style.display = 'none';
        enableBodyScroll();
    });

    // Obsługa modala udostępniania
    closeShareResultModalBtn.addEventListener('click', () => {
        shareResultModal.style.display = 'none';
        enableBodyScroll();
    });

    // Obsługa modala szczegółów trackera
    closeTrackerDetailsModalBtn.addEventListener('click', () => {
        trackerDetailsModal.style.display = 'none';
        enableBodyScroll();
    });
    
    // Obsługa modala wykresu procentowego
    closePercentageChartModalBtn.addEventListener('click', () => {
        percentageChartModal.style.display = 'none';
        enableBodyScroll();
    });

    // Obsługa modala powiększonej Ekstrapolacji
    const extrapolationChartModal = document.getElementById('extrapolationChartModal');
    const closeExtrapolationChartModalBtn = document.getElementById('closeExtrapolationChartModalBtn');
    if (closeExtrapolationChartModalBtn && extrapolationChartModal) {
        closeExtrapolationChartModalBtn.addEventListener('click', () => {
            extrapolationChartModal.style.display = 'none';
            enableBodyScroll();
        });
    }

    // Obsługa ukrycia kwoty w karcie udostępniania
    hideAmountCheckbox.addEventListener('change', function() {
        const sharePnlEl = document.getElementById('sharePnl');
        if (this.checked) {
            sharePnlEl.classList.add('hidden');
        } else {
            sharePnlEl.classList.remove('hidden');
        }
    });



    // Funkcja do otwierania modala udostępniania
    function openShareModal(transaction) {
        if (!loggedInUser) return;

        // Znajdź dane użytkownika z transakcji
        let userProfit = 0;
        let userDetail = null;
        
        if (transaction.details) {
            userDetail = Object.values(transaction.details).find(detail => detail.name === loggedInUser.name);
            if (userDetail) {
                userProfit = userDetail.profitLossShare - (userDetail.commissionPaid || 0);
                
                // Dla Topcia dodaj prowizje zebrane
                if (loggedInUser.name === 'Topciu' && userDetail.commissionCollected) {
                    userProfit += userDetail.commissionCollected;
                }
            }
        }

        // Oblicz procent zmiany (przybliżone)
        const percentageChange = userProfit > 0 ? Math.min(userProfit / 100, 50) : Math.max(userProfit / 100, -50);

        // Ustaw ikonę w zależności od wyniku
        if (userProfit > 0) {
            shareIcon.textContent = userProfit > 100 ? '🚀' : '⚡';
        } else {
            shareIcon.textContent = '📉';
        }

        // Ustaw wiadomość w zależności od wyniku
        let message = '';
        if (userProfit > 100) {
            message = 'Rakieta! 🚀';
        } else if (userProfit > 50) {
            message = 'Świetne zagranie! 💪';
        } else if (userProfit > 0) {
            message = 'Dobra robota! 👍';
        } else if (userProfit > -50) {
            message = 'Następnym razem będzie lepiej! 💪';
        } else {
            message = 'Uczymy się na błędach! 📚';
        }

        // Wypełnij dane w karcie
        shareUsername.textContent = loggedInUser.name;
        shareDate.textContent = new Date(transaction.createdAt.toDate()).toLocaleDateString('pl-PL');
        sharePercentage.textContent = `${percentageChange >= 0 ? '+' : ''}${percentageChange.toFixed(1)}%`;
        
        // Ustaw PnL z kolorowaniem
        const sharePnlEl = document.getElementById('sharePnl');
        sharePnlEl.textContent = `PnL: ${userProfit >= 0 ? '+' : ''}${userProfit.toFixed(2)} USD`;
        sharePnlEl.className = userProfit >= 0 ? 'share-pnl positive' : 'share-pnl negative';
        
        // Ustaw opis transakcji (przykładowe dane dla pojedynczej transakcji)
        const shareTransactionsEl = document.getElementById('shareTransactions');
        const isProfitable = userProfit > 0;
        const transactionCount = 1;
        const successRate = isProfitable ? 100 : 0;
        const successRateClass = successRate >= 50 ? '' : 'low';
        
        shareTransactionsEl.innerHTML = `Transakcje: <span class="transaction-count">${transactionCount}</span> | Skuteczność: <span class="success-rate ${successRateClass}">${successRate}%</span>`;
        
        shareMessage.textContent = message;

        // Zresetuj checkbox
        hideAmountCheckbox.checked = false;
        sharePnlEl.classList.remove('hidden');
    }

    // Funkcja do otwierania modala szczegółów trackera
    function openTrackerDetailsModal() {
        if (!window.trackerData) {
            console.log('Tracker: Brak danych trackera');
            return;
        }
        
        const data = window.trackerData;
        
        // Aktualizuj elementy modala
        document.getElementById('trackerCurrentProgress').textContent = `${data.currentProgress.toFixed(1)}%`;
        document.getElementById('trackerRemaining').textContent = `${data.remainingPercentage.toFixed(1)}%`;
        document.getElementById('trackerRemainingAmount').textContent = `${data.remainingAmount.toFixed(2)} USD`;
        document.getElementById('trackerCurrentProfit').textContent = `${data.currentProfit.toFixed(2)} USD`;
        document.getElementById('trackerTargetAmount').textContent = `${data.targetAmount.toFixed(2)} USD`;
        document.getElementById('trackerDaysLeft').textContent = data.daysLeft;
        
        // Dodaj kolory do wartości
        const currentProgressEl = document.getElementById('trackerCurrentProgress');
        const remainingEl = document.getElementById('trackerRemaining');
        const currentProfitEl = document.getElementById('trackerCurrentProfit');
        const remainingAmountEl = document.getElementById('trackerRemainingAmount');
        const targetAmountEl = document.getElementById('trackerTargetAmount');
        
        currentProgressEl.className = data.currentProgress >= 0 ? 'stat-value positive-amount' : 'stat-value negative-amount';
        remainingEl.className = 'stat-value';
        currentProfitEl.className = data.currentProfit >= 0 ? 'stat-value positive-amount' : 'stat-value negative-amount';
        
        // Kwoty USD na zielono
        remainingAmountEl.className = 'stat-value positive-amount';
        targetAmountEl.className = 'stat-value positive-amount';
        
        // Pokaż modal
        trackerDetailsModal.style.display = 'flex';
        disableBodyScroll();
    }

    // Funkcja do otwierania modala udostępniania statystyk
    function openShareStatsModal(type = 'monthly') {
        if (!loggedInUser || !currentSelectedUser) return;

        // Sprawdź czy elementy istnieją w DOM
        const monthlyProfitEl = document.getElementById('monthlyProfit');
        const monthlyChangeEl = document.getElementById('monthlyChange');
        const monthlyProfitableLossTradesEl = document.getElementById('monthlyProfitableLossTrades');
        const monthlySuccessRateEl = document.getElementById('monthlySuccessRate');
        const totalProfitEl = document.getElementById('totalProfit');
        const totalChangeEl = document.getElementById('totalChange');
        const profitableTradesEl = document.getElementById('profitableTrades');
        const successRateEl = document.getElementById('successRate');

        if (!monthlyProfitEl || !monthlyChangeEl || !monthlyProfitableLossTradesEl || !monthlySuccessRateEl || 
            !totalProfitEl || !totalChangeEl || !profitableTradesEl || !successRateEl) {
            alert('Najpierw otwórz szczegółowe statystyki użytkownika!');
            return;
        }

        // Pobierz dane ze szczegółowych statystyk
        const monthlyProfit = monthlyProfitEl.textContent;
        const monthlyChange = monthlyChangeEl.textContent;
        const monthlyProfitableLossTrades = monthlyProfitableLossTradesEl.textContent;
        const monthlySuccessRate = monthlySuccessRateEl.textContent;
        const totalProfit = totalProfitEl.textContent;
        const totalChange = totalChangeEl.textContent;
        const profitableTrades = profitableTradesEl.textContent;
        const totalSuccessRate = successRateEl.textContent;

        // Wybierz dane w zależności od typu statystyk
        let profitValue, changeValue, profitText, changeText, tradesText, successRateText, dateText, message;
        
        if (type === 'monthly') {
            profitValue = parseFloat(monthlyProfit);
            changeValue = parseFloat(monthlyChange);
            profitText = monthlyProfit;
            changeText = monthlyChange;
            tradesText = monthlyProfitableLossTrades;
            successRateText = monthlySuccessRate;
            dateText = new Date().toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
            
            // Ustaw wiadomość w zależności od wyniku miesięcznego
            if (profitValue > 100) {
                message = 'Fantastyczny miesiąc! 🚀';
            } else if (profitValue > 50) {
                message = 'Świetny miesiąc! 💪';
            } else if (profitValue > 0) {
                message = 'Dobry miesiąc! 👍';
            } else if (profitValue > -50) {
                message = 'Następnym razem będzie lepiej! 💪';
            } else {
                message = 'Uczymy się na błędach! 📚';
            }
        } else { // total
            profitValue = parseFloat(totalProfit);
            changeValue = parseFloat(totalChange);
            profitText = totalProfit;
            changeText = totalChange;
            tradesText = profitableTrades;
            successRateText = totalSuccessRate;
            dateText = 'all-time';
            
            // Ustaw wiadomość w zależności od wyniku całkowitego
            if (profitValue > 500) {
                message = 'Fantastyczne wyniki! 🚀';
            } else if (profitValue > 200) {
                message = 'Świetne wyniki! 💪';
            } else if (profitValue > 0) {
                message = 'Dobre wyniki! 👍';
            } else if (profitValue > -200) {
                message = 'Następnym razem będzie lepiej! 💪';
            } else {
                message = 'Uczymy się na błędach! 📚';
            }
        }

        // Ustaw ikonę w zależności od wyniku
        if (profitValue > 0) {
            shareIcon.textContent = profitValue > 100 ? '🚀' : '⚡';
        } else {
            shareIcon.textContent = '📊';
        }

        // Wypełnij dane w karcie
        shareUsername.textContent = currentSelectedUser.name;
        shareDate.textContent = dateText;
        sharePercentage.textContent = changeText;
        
        // Ustaw PnL z kolorowaniem
        const sharePnlEl = document.getElementById('sharePnl');
        const profitSign = profitValue >= 0 ? '+' : '';
        const profitClass = profitValue >= 0 ? 'positive' : 'negative';
        sharePnlEl.innerHTML = `PnL: <span class="${profitClass}">${profitSign}${profitText}</span>`;
        sharePnlEl.className = 'share-pnl';
        
        // Ustaw opis transakcji
        const shareTransactionsEl = document.getElementById('shareTransactions');
        const [profitable, loss] = tradesText.split('/').map(Number);
        const totalTrades = profitable + loss;
        const successRate = totalTrades > 0 ? (profitable / totalTrades) * 100 : 0;
        const successRateClass = successRate >= 50 ? '' : 'low';
        
        shareTransactionsEl.innerHTML = `Transakcje: <span class="transaction-count">${totalTrades}</span> | Skuteczność: <span class="success-rate ${successRateClass}">${successRate.toFixed(1)}%</span>`;
        
        shareMessage.textContent = message;

        // Zresetuj checkbox
        hideAmountCheckbox.checked = false;
        sharePnlEl.classList.remove('hidden');

        // Pokaż modal
        shareResultModal.style.display = 'flex';
        disableBodyScroll();
    }

    // Obsługa przycisku share w szczegółowych statystykach (miesięczne)
    document.getElementById('shareStatsBtn').addEventListener('click', function() {
        openShareStatsModal('monthly');
    });

    // Obsługa przycisku share w całkowitych statystykach
    document.getElementById('shareTotalStatsBtn').addEventListener('click', function() {
        openShareStatsModal('total');
    });

    // Obsługa kliknięcia na widgety
    document.addEventListener('click', function(event) {
        const widgetCard = event.target.closest('.widget-card');
        if (widgetCard && loggedInUser && loggedInUser.name === 'Topciu') {
            if (widgetCard.id === 'percentage-chart-widget') {
                // Otwórz powiększony wykres miesięczny (jak u zwykłego użytkownika)
                const modal = document.getElementById('enlargedChartModal');
                if (modal) {
                    drawEnlargedMonthlyProfitsChartForTopciu(cachedTransactions);
                    modal.style.display = 'flex';
                    disableBodyScroll();
                }
            } else if (widgetCard.id === 'extrapolation-widget') {
                // Powiększony wykres Ekstrapolacji
                const modal = document.getElementById('extrapolationChartModal');
                if (modal) {
                    drawExtrapolationLarge();
                    modal.style.display = 'flex';
                    disableBodyScroll();
                }
            } else {
                // Domyślnie: szczegóły trackera
                openTrackerDetailsModal();
            }
        }
    });
    
    // Zastąpienie: teraz Topciu ma w widżecie wykres miesięczny, więc nie pokazujemy modala dziennego

    // NOWOŚĆ: Mały wykres miesięczny dla Topcia w sekcji Widgety (używa naszego canvasu 'percentage-chart')
    function updateTopciuMonthlyWidgetChart() {
        if (!loggedInUser || loggedInUser.name !== 'Topciu') return;
        const canvas = document.getElementById('percentage-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Dopasuj rozmiar do kontenera widżetu
        const container = canvas.parentElement;
        const containerWidth = container.clientWidth || 300;
        const containerHeight = container.clientHeight || 150;
        canvas.width = containerWidth - 20; // padding wizualny
        canvas.height = containerHeight - 20;

        // Zbierz dane: ostatnie 6 miesięcy zysków Topcia
        const now = new Date();
        const monthsData = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = date.toLocaleDateString('pl-PL', { month: 'short' });
            monthsData.push({ month: monthName, profit: 0, date });
        }

        if (cachedTransactions && cachedTransactions.length > 0) {
            cachedTransactions.forEach(transaction => {
                const tDate = transaction.createdAt.toDate();
                const idx = monthsData.findIndex(m => m.date.getMonth() === tDate.getMonth() && m.date.getFullYear() === tDate.getFullYear());
                if (idx === -1) return;

                if (transaction.type === 'trade' && transaction.details) {
                    const topciuDetail = Object.values(transaction.details).find(d => d.name === 'Topciu');
                    if (topciuDetail) {
                        let pnl = topciuDetail.profitLossShare - (topciuDetail.commissionPaid || 0);
                        if (topciuDetail.commissionCollected) pnl += topciuDetail.commissionCollected; // uwzględnij prowizje zebrane
                        monthsData[idx].profit += pnl;
                    }
                } else if ((transaction.type === 'deposit' || transaction.type === 'withdrawal') && transaction.userName === 'Topciu') {
                    const amount = transaction.type === 'deposit' ? (transaction.amount || 0) : -(transaction.amount || 0);
                    monthsData[idx].profit += amount; // uwzględnij wpłaty/wypłaty
                }
            });
        }

        // Motyw
        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#ecf0f1' : '#333';
        const gridColor = isDark ? '#404040' : '#e0e0e0';
        const posColor = isDark ? '#2ecc71' : '#27ae60';
        const negColor = isDark ? '#e67e22' : '#d35400';

        // Wyczyść
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const padding = 24;
        const chartWidth = canvas.width - padding * 2;
        const chartHeight = canvas.height - padding * 2;

        const maxProfit = Math.max(...monthsData.map(m => m.profit), 0);
        const minProfit = Math.min(...monthsData.map(m => m.profit), 0);
        const range = maxProfit - minProfit || 1;
        const zeroY = padding + chartHeight - (0 - minProfit) / range * chartHeight;

        // siatka
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        for (let i = 0; i <= 2; i++) {
            const y = padding + (chartHeight / 2) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + chartWidth, y);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // oś zero
        ctx.strokeStyle = textColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding, zeroY);
        ctx.lineTo(padding + chartWidth, zeroY);
        ctx.stroke();

        // słupki
        const barWidth = chartWidth / monthsData.length * 0.6;
        const barSpacing = chartWidth / monthsData.length * 0.4;
        ctx.textAlign = 'center';
        ctx.font = '10px Roboto';
        monthsData.forEach((m, idx) => {
            const x = padding + (chartWidth / monthsData.length) * idx + barSpacing / 2;
            const barH = Math.abs(m.profit) / range * chartHeight;
            const y = m.profit >= 0 ? zeroY - barH : zeroY;
            ctx.fillStyle = m.profit >= 0 ? posColor : negColor;
            ctx.fillRect(x, y, barWidth, barH);
            ctx.fillStyle = textColor;
            ctx.fillText(m.month, x + barWidth / 2, padding + chartHeight + 12);

            // wartość nad słupkiem
            if (Math.abs(m.profit) > 0.004) {
                ctx.font = '9px Roboto';
                const valueY = m.profit >= 0 ? y - 4 : y + barH + 12;
                ctx.fillText(`${m.profit.toFixed(2)}`, x + barWidth / 2, valueY);
            }
        });

        // Uaktualnij podpis pod wartość na karcie
        // Usuwamy pokazywanie liczby pod miniaturką (widgetLabel usunięty z DOM)
    }
    
    // Funkcja do obsługi tooltipów wykresu - usunięta, bo Chart.js ma wbudowane tooltipy

    

    // Rysowanie dużego wykresu ekstrapolacji
    async function drawExtrapolationLarge() {
        const canvas = document.getElementById('extrapolation-chart-large');
        if (!canvas) return;
        // Dopasuj rozmiar do viewportu, używając tej samej funkcji co dla miesięcznego wykresu
        const size = computeEnlargedChartSize();
        const shrink = 0.80; // delikatne pomniejszenie, aby uniknąć scrolla poziomego/pionowego
        canvas.width = Math.floor(size.width * shrink);
        canvas.height = Math.floor(size.height * shrink);
        const monthlyRate = getCurrentMonthlyRate();
        const base = getCurrentTotalBalanceValue();
        if (base <= 0) return;

        // Dane do roku docelowego (tak jak w małym, ale bez limitu punktów)
        const now = new Date();
        let months = computeMonthsUntilYear(EXTRAPOLATION_TARGET_YEAR);
        const labels = [];
        const values = [];
        let value = base;
        for (let i = 0; i < months; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            labels.push(d.getMonth() === 0 ? String(d.getFullYear()).slice(2) : '');
            if (i > 0) value = value * (1 + monthlyRate);
            values.push(value);
        }

        // Uzupełnij podsumowanie (USD + PLN)
        const finalUsdNumEl = document.getElementById('extrapolation-final-usd-num');
        const finalPlnNumEl = document.getElementById('extrapolation-final-pln-num');
        if (finalUsdNumEl) finalUsdNumEl.textContent = abbreviateNumber(value);
        if (finalPlnNumEl) {
            const pln = await convertUsdToPln(value);
            finalPlnNumEl.textContent = abbreviateNumber(pln);
        }

        if (canvas.chart) canvas.chart.destroy();
        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#ffffff' : '#333333';
        const gridColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';
        canvas.chart = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Prognoza wartości (USD)',
                    data: values,
                    borderColor: '#27ae60',
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    borderWidth: 3,
                    pointRadius: 0,
                    tension: 0.2,
                    fill: true
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                layout: { padding: { top: 4, right: 4, bottom: 4, left: 4 } },
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false,
                        backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.9)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#27ae60',
                        borderWidth: 1,
                        callbacks: {
                            label: function(ctx) {
                                const num = ctx.parsed.y.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                return ` ${num} USD`;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false }, title: { display: true, text: 'Rok', color: textColor }, ticks: { maxTicksLimit: 12, color: textColor, autoSkip: false, maxRotation: 0, callback: (v,i) => labels[i] || undefined } },
                    y: { grid: { color: gridColor }, ticks: { color: textColor, callback: (v) => v.toLocaleString('pl-PL') + ' USD' } }
                }
            }
        });
    }

    // --- WIDGET: EKSTRAPOLACJA ---
    function parseCurrencyToNumber(text) {
        if (!text) return 0;
        // Usuń wszystko poza cyframi, kropką, przecinkiem i znakiem minus
        const cleaned = text.replace(/[^0-9,.-]/g, '').replace(/\s/g, '');
        // Zamień przecinek na kropkę, jeśli występuje
        const normalized = cleaned.replace(',', '.');
        const value = parseFloat(normalized);
        return isNaN(value) ? 0 : value;
    }

    function getCurrentTotalBalanceValue() {
        try {
            if (!totalBalanceElement) return 0;
            return parseCurrencyToNumber(totalBalanceElement.textContent);
        } catch (e) {
            return 0;
        }
    }

    function getCurrentMonthlyRate() {
        // Najpierw spróbuj policzyć precyzyjnie dla Topcia z transakcji,
        // aby zgadzało się z kartą użytkownika
        const topciuRate = computeTopciuMonthlyRateFromTransactions();
        if (topciuRate !== null) return topciuRate;
        // Fallback: trackerData (fund-level)
        if (window.trackerData && typeof window.trackerData.currentProgress === 'number') {
            return window.trackerData.currentProgress / 100; // jako ułamek
        }
        return 0;
    }

    // Wylicz miesięczny rate dla Topcia w oparciu o cachedTransactions (zgodnie z calculateDetailedStats)
    function computeTopciuMonthlyRateFromTransactions() {
        try {
            if (!loggedInUser || loggedInUser.name !== 'Topciu') return null;
            if (!Array.isArray(cachedTransactions)) return null;
            const now = new Date();
            const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            // saldo początkowe Topcia
            const topciuStart = (cachedUsers || []).find(u => u.name === 'Topciu')?.startBalance || 0;
            let balanceAtMonthStart = topciuStart;
            let currentMonthProfit = 0;

            cachedTransactions.forEach(t => {
                const tDate = t.createdAt.toDate();
                const isBeforeMonth = tDate < currentMonthStart;
                const isCurrentMonth = tDate >= currentMonthStart;
                if (t.type === 'trade' && t.details) {
                    const d = Object.values(t.details).find(v => v.name === 'Topciu');
                    if (d) {
                        let pnl = d.profitLossShare - (d.commissionPaid || 0);
                        if (d.commissionCollected) pnl += d.commissionCollected;
                        if (isBeforeMonth) balanceAtMonthStart += pnl;
                        if (isCurrentMonth) currentMonthProfit += pnl;
                    }
                } else if ((t.type === 'deposit' || t.type === 'withdrawal') && t.userName === 'Topciu') {
                    const amount = t.type === 'deposit' ? (t.amount || 0) : -(t.amount || 0);
                    if (isBeforeMonth) balanceAtMonthStart += amount;
                    if (isCurrentMonth) currentMonthProfit += amount;
                }
            });

            if (balanceAtMonthStart <= 0) return 0;
            return currentMonthProfit / balanceAtMonthStart;
        } catch {
            return null;
        }
    }

    // Skrócone formatowanie dużych liczb: 1.2k, 250k, 3.4M, 1.1B
    function abbreviateNumber(num) {
        if (!isFinite(num)) return '—';
        const abs = Math.abs(num);
        const sign = num < 0 ? '-' : '';
        if (abs >= 1_000_000_000) return sign + (abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
        if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (abs >= 1_000) return sign + (abs / 1_000).toFixed(0) + 'k';
        return sign + abs.toFixed(0);
    }

    function updateExtrapolationWidget() {
        const widgetCard = document.getElementById('extrapolation-widget');
        const rateEl = document.getElementById('extrapolation-monthly-rate');
        const finalEl = document.getElementById('extrapolation-final-value');
        const canvas = document.getElementById('extrapolation-chart');
        if (!widgetCard || !rateEl || !finalEl || !canvas) return;

        const monthlyRate = getCurrentMonthlyRate();
        // Zaokrąglij do jednego miejsca, ale bez zaniżania – użyj Math.round
        const ratePct = Math.round(monthlyRate * 1000) / 10; // np. 1.24% -> 1.2%, 1.25% -> 1.3%
        rateEl.textContent = `${ratePct >= 0 ? '+' : ''}${ratePct.toFixed(1)}%`;
        // Koloruj wynik: zielony dla dodatnich, pomarańczowy dla ujemnych
        rateEl.className = ratePct >= 0 ? 'extrapolation-green' : 'negative-amount';

        const base = getCurrentTotalBalanceValue();
        // Zabezpieczenie: jeżeli nic się nie zmieniło, nie renderuj ponownie
        const signature = `${base}|${monthlyRate.toFixed(6)}`;
        if (signature === lastExtrapolationSignature && extrapolationChart) {
            return;
        }
        lastExtrapolationSignature = signature;
        if (base <= 0) {
            finalEl.textContent = '—';
            if (extrapolationChart) { extrapolationChart.destroy(); extrapolationChart = null; }
            return;
        }

        // Wylicz liczbę miesięcy do grudnia roku docelowego włącznie
        const now = new Date();
        let months = computeMonthsUntilYear(EXTRAPOLATION_TARGET_YEAR);

        const labels = [];
        const values = [];
        let value = base;
        for (let i = 0; i < months; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            labels.push(d.getMonth() === 0 ? String(d.getFullYear()).slice(2) : '');
            if (i > 0) {
                value = value * (1 + monthlyRate);
            }
            values.push(value);
        }

        // Aktualizuj tekst prognozy (ostatnia wartość) – format z separatorami tysięcy
        const finalValue = values[values.length - 1];
        const finalNum = abbreviateNumber(finalValue);
        finalEl.textContent = finalNum;

        // Rysuj wykres
        if (extrapolationChart) {
            extrapolationChart.destroy();
            extrapolationChart = null;
        }
        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#ecf0f1' : '#333333';
        const gridColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';
        const config = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Prognoza wartości (USD)',
                    data: values,
                    borderColor: '#27ae60',
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(ctx) {
                                const num = ctx.parsed.y.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                return ` ${num} USD`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { maxTicksLimit: 8, color: textColor, autoSkip: false, maxRotation: 0, callback: (v,i) => labels[i] || undefined }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: {
                            color: textColor,
                            callback: function(value) { return value.toLocaleString('pl-PL') + ' USD'; }
                        }
                    }
                }
            }
        };
        extrapolationChart = new Chart(canvas, config);
    }

    // Prosty przelicznik USD->PLN z publicznego API
    async function convertUsdToPln(amountUsd) {
        try {
            const res = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=PLN');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const rate = data && data.rates && data.rates.PLN ? data.rates.PLN : 4.0;
            return amountUsd * rate;
        } catch (e) {
            console.warn('Błąd pobierania kursu USD/PLN, używam domyślnego 4.0', e);
            return amountUsd * 4.0;
        }
    }
    
    // Funkcja do obsługi przycisków okresu
    function setupPeriodButtons() {
        const periodButtons = document.querySelectorAll('.period-btn');
        
        periodButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Usuń aktywną klasę ze wszystkich przycisków
                periodButtons.forEach(btn => btn.classList.remove('active'));
                
                // Dodaj aktywną klasę do klikniętego przycisku
                this.classList.add('active');
                
                // Pobierz okres z data-period
                const period = parseInt(this.getAttribute('data-period'));
                
                // Generuj nowe dane i odśwież wykres
                const chartData = generatePercentageChartData(period);
                drawPercentageChart(chartData, 'percentage-chart-large', true);
                updatePercentageChartStats(chartData);
            });
        });
    }
});

// --- FUNKCJE DO GENEROWANIA I POBIERANIA CSV ---
 function generateCSV(transactions, currentUser) {
    const isTopciu = currentUser && currentUser.name === 'Topciu';
    const headers = ['Data', 'Godzina', 'Typ', 'Użytkownik', 'Kwota', 'Saldo po'];

    const formatPL = (num) => {
        if (num === null || num === undefined || isNaN(num)) return '';
        return Number(num).toFixed(2);
    };

    let csvRows = [headers.join(',')];

    transactions.forEach(tx => {
        const d = tx.createdAt.toDate();
        const date = d.toLocaleDateString('pl-PL');
        const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
        const type = tx.type;

        if (isTopciu) {
            // CSV dla Topcia: rozbicie na każdego użytkownika + Topciu
            if (type === 'trade' && tx.details) {
                Object.values(tx.details).forEach(detail => {
                    const name = detail.name || '';
                    let amount = (detail.profitLossShare || 0) - (detail.commissionPaid || 0);
                    if (name === 'Topciu' && detail.commissionCollected) {
                        amount += detail.commissionCollected;
                    }
                    const balance = detail.newBalance != null ? formatPL(detail.newBalance) : '';
                    csvRows.push([date, time, 'trade', name, formatPL(amount), balance].join(','));
                });
            } else if (type === 'deposit' || type === 'withdrawal') {
                const targetName = tx.userName || '';
                const signedAmount = type === 'deposit' ? tx.amount : -tx.amount;
                const balance = tx.balanceAfter != null ? formatPL(tx.balanceAfter) : '';
                csvRows.push([date, time, type, targetName, formatPL(signedAmount), balance].join(','));
            } else {
                const balance = tx.balanceAfter != null ? formatPL(tx.balanceAfter) : '';
                csvRows.push([date, time, type, '', tx.amount != null ? formatPL(tx.amount) : '', balance].join(','));
            }
        } else {
            // Zwykły użytkownik – jak dotychczas, ale w tym samym formacie kolumn
            if (type === 'trade' && tx.details) {
                const ud = tx.details[currentUser.id];
                if (ud) {
                    const userProfit = (ud.profitLossShare - (ud.commissionPaid || 0));
                    csvRows.push([date, time, 'trade', currentUser.name, formatPL(userProfit), formatPL(ud.newBalance)].join(','));
                }
            } else if ((type === 'deposit' || type === 'withdrawal') && tx.userId === currentUser.id) {
                const signedAmount = type === 'deposit' ? tx.amount : -tx.amount;
                csvRows.push([date, time, type, currentUser.name, formatPL(signedAmount), formatPL(tx.balanceAfter)].join(','));
            }
        }
    });

    return csvRows.join('\n');
 }

function downloadCSV(csvContent, fileName) {
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Funkcja testowa do dodania starej transakcji ---
// Można ją wywołać w konsoli przez: addTestTransaction()
window.addTestTransaction = async function() {
    console.log("Dodawanie testowej transakcji archiwalnej...");
    try {
        // Poprawiona logika obliczania daty 2 miesiące wstecz
        const now = new Date();
        const oldDate = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());

        await addDoc(collection(db, "transactions"), {
            type: 'trade',
            amount: 123.45,
            description: 'Testowa transakcja archiwalna',
            details: {
                'testUser1': { name: 'Topciu', oldBalance: 1000, profitLossShare: 123.45, commissionPaid: 0, newBalance: 1123.45 }
            },
            totalBalanceAfter: 1123.45,
            createdAt: oldDate
        });
        console.log('Testowa transakcja archiwalna została pomyślnie dodana!');
        alert('Testowa transakcja archiwalna została pomyślnie dodana!');
    } catch (error) {
        console.error("Błąd podczas dodawania transakcji archiwalnej: ", error);
        alert("Wystąpił błąd: " + error.message);
    }
}

// Funkcja pomocnicza do sprawdzania transakcji w archiwum
window.checkArchiveTransactions = function() {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    console.log('=== INFORMACJE O ARCHIWUM ===');
    console.log('Data początkowa bieżącego miesiąca:', currentMonthStart.toISOString());
    console.log('Liczba wszystkich transakcji:', cachedTransactions.length);
    
    const archiveTransactions = cachedTransactions.filter(transaction => {
        const transactionDate = transaction.createdAt.toDate();
        return transactionDate < currentMonthStart;
    });
    
    console.log('Liczba transakcji w archiwum:', archiveTransactions.length);
    
    if (archiveTransactions.length > 0) {
        console.log('Przykładowe transakcje w archiwum:');
        archiveTransactions.slice(0, 5).forEach((transaction, index) => {
            const transactionDate = transaction.createdAt.toDate();
            console.log(`${index + 1}. ${transactionDate.toISOString()} - ${transaction.type} - ${transaction.amount || 'N/A'}`);
        });
    } else {
        console.log('Brak transakcji w archiwum.');
    }
    
    const currentTransactions = cachedTransactions.filter(transaction => {
        const transactionDate = transaction.createdAt.toDate();
        return transactionDate >= currentMonthStart;
    });
    
    console.log('Liczba transakcji w bieżącym miesiącu:', currentTransactions.length);
    console.log('================================');
}

    function drawMonthlyProfitsChart(transactions, currentUser) {
        if (!currentUser || currentUser.name === 'Topciu') return;
        
        const chartElement = document.getElementById('monthly-profits-chart');
        if (!chartElement) return;

        // --- NOWOŚĆ: Dynamiczne dopasowanie rozmiaru canvasu ---
        const containerWidth = chartElement.parentElement.clientWidth;
        chartElement.width = containerWidth;
        chartElement.height = containerWidth / 2;
        // ----------------------------------------------------

        const ctx = chartElement.getContext('2d');
        const now = new Date();
        const monthsData = [];
        
        // Przygotuj dane dla ostatnich 6 miesięcy
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = date.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' });
            monthsData.push({
                month: monthName,
                profit: 0,
                date: date
            });
        }

        // Oblicz zyski dla każdego miesiąca
        transactions.forEach(transaction => {
            if (transaction.type === 'trade' && transaction.details) {
                const transactionDate = transaction.createdAt.toDate();
                const monthIndex = monthsData.findIndex(m => 
                    m.date.getMonth() === transactionDate.getMonth() && 
                    m.date.getFullYear() === transactionDate.getFullYear()
                );
                
                if (monthIndex !== -1) {
                    const userDetail = Object.values(transaction.details).find(detail => detail.name === currentUser.name);
                    if (userDetail) {
                        const userProfit = userDetail.profitLossShare - (userDetail.commissionPaid || 0);
                        monthsData[monthIndex].profit += userProfit;
                    }
                }
            }
        });

        // Sprawdź czy tryb ciemny jest aktywny
        const isDarkMode = document.body.classList.contains('dark-mode');
        const textColor = isDarkMode ? '#ecf0f1' : '#333';
        const gridColor = isDarkMode ? '#404040' : '#e0e0e0';
        const positiveColor = isDarkMode ? '#2ecc71' : '#27ae60';
        const negativeColor = isDarkMode ? '#e67e22' : '#d35400';

        // Wyczyść canvas
        ctx.clearRect(0, 0, chartElement.width, chartElement.height);

        // Ustawienia wykresu
        const basePadding = 40;
        const chartHeight = chartElement.height - 2 * basePadding;

        // Znajdź maksymalną i minimalną wartość
        const maxProfit = Math.max(...monthsData.map(m => m.profit), 0);
        const minProfit = Math.min(...monthsData.map(m => m.profit), 0);
        const range = maxProfit - minProfit || 1;

        // Oblicz pozycję linii zero
        const zeroY = basePadding + chartHeight - (0 - minProfit) / range * chartHeight;

        // Oblicz maksymalną szerokość tekstu dla etykiet osi Y
        ctx.font = '9px Roboto';
        const yLabels = [];
        for (let i = 0; i <= 4; i++) {
            const value = maxProfit - (range / 4) * i;
            if (value !== 0) {
                yLabels.push(`${value.toFixed(0)}`);
            }
        }
        
        // Znajdź najszerszą etykietę
        let maxLabelWidth = 0;
        yLabels.forEach(label => {
            const metrics = ctx.measureText(label);
            maxLabelWidth = Math.max(maxLabelWidth, metrics.width);
        });
        
        // Dostosuj margines lewy, żeby etykiety nie wychodziły poza kartę
        const minLeftMargin = maxLabelWidth + 15; // 15px dodatkowego marginesu
        const leftPadding = Math.max(basePadding, minLeftMargin);
        const rightPadding = basePadding;
        
        // Przelicz szerokość wykresu z dostosowanym marginesem
        const chartWidth = chartElement.width - leftPadding - rightPadding;
        const barWidth = chartWidth / monthsData.length * 0.6;
        const barSpacing = chartWidth / monthsData.length * 0.4;

        // Narysuj siatkę
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        
        // Linie poziome
        for (let i = 0; i <= 4; i++) {
            const y = basePadding + (chartHeight / 4) * i;
            ctx.beginPath();
            ctx.moveTo(leftPadding, y);
            ctx.lineTo(leftPadding + chartWidth, y);
            ctx.stroke();
        }

        ctx.setLineDash([]);

        // Narysuj linie zero
        ctx.strokeStyle = textColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(leftPadding, zeroY);
        ctx.lineTo(leftPadding + chartWidth, zeroY);
        ctx.stroke();

        // Narysuj słupki
        monthsData.forEach((data, index) => {
            const x = leftPadding + (chartWidth / monthsData.length) * index + barSpacing / 2;
            const barHeight = Math.abs(data.profit) / range * chartHeight;
            const y = data.profit >= 0 ? zeroY - barHeight : zeroY;
            
            ctx.fillStyle = data.profit >= 0 ? positiveColor : negativeColor;
            ctx.fillRect(x, y, barWidth, barHeight);

            // Dodaj wartość na słupku (tylko jeśli wartość != 0)
            if (data.profit !== 0) {
                ctx.fillStyle = textColor;
                ctx.font = '10px Roboto';
                ctx.textAlign = 'center';
                const valueY = data.profit >= 0 ? y - 5 : y + barHeight + 12;
                ctx.fillText(`${data.profit.toFixed(0)}`, x + barWidth / 2, valueY);
            }

            // Dodaj etykietę miesiąca
            ctx.fillStyle = textColor;
            ctx.font = '9px Roboto';
            ctx.textAlign = 'center';
            ctx.fillText(data.month, x + barWidth / 2, basePadding + chartHeight + 15);
        });

        // Dodaj etykiety osi Y
        ctx.fillStyle = textColor;
        ctx.font = '9px Roboto';
        ctx.textAlign = 'right';
        
        for (let i = 0; i <= 4; i++) {
            const value = maxProfit - (range / 4) * i;
            const y = basePadding + (chartHeight / 4) * i + 3;
            if (value !== 0) {
                ctx.fillText(`${value.toFixed(0)}`, leftPadding - 5, y);
            }
        }
    }

    // Obliczenie rozmiaru płótna tak, aby mieściło się bez scrolla w modalu
    function computeEnlargedChartSize() {
        const viewportW = window.innerWidth || 1200;
        const viewportH = window.innerHeight || 800;
        // Rezerwy na ramkę modala, nagłówek (tytuł + X), paddingi i podpisy osi
        const horizontalReserve = 25;
        const verticalReserve = 250;
        const usableW = Math.max(480, Math.floor(viewportW * 0.96) - horizontalReserve);
        const usableH = Math.max(300, Math.floor(viewportH * 0.96) - verticalReserve);
        const aspect = 16 / 9;
        const widthCandidate = Math.min(usableW, Math.floor(usableH * aspect));
        const heightCandidate = Math.floor(widthCandidate / aspect);
        return { width: widthCandidate, height: heightCandidate };
    }

    function drawEnlargedMonthlyProfitsChart(transactions, currentUser) {
        if (!currentUser || currentUser.name === 'Topciu') return;
        
        const chartElement = document.getElementById('enlarged-monthly-profits-chart');
        if (!chartElement) return;

        // Ustaw rozmiar canvas dynamicznie, aby uniknąć scrolla
        const size = computeEnlargedChartSize();
        chartElement.width = size.width;
        chartElement.height = size.height;

        const ctx = chartElement.getContext('2d');
        const now = new Date();
        const monthsData = [];
        
        // Przygotuj dane dla ostatnich 12 miesięcy
        for (let i = 11; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = date.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' });
            monthsData.push({
                month: monthName,
                profit: 0,
                date: date
            });
        }

        // Oblicz zyski dla każdego miesiąca
        transactions.forEach(transaction => {
            if (transaction.type === 'trade' && transaction.details) {
                const transactionDate = transaction.createdAt.toDate();
                const monthIndex = monthsData.findIndex(m => 
                    m.date.getMonth() === transactionDate.getMonth() && 
                    m.date.getFullYear() === transactionDate.getFullYear()
                );
                
                if (monthIndex !== -1) {
                    const userDetail = Object.values(transaction.details).find(detail => detail.name === currentUser.name);
                    if (userDetail) {
                        const userProfit = userDetail.profitLossShare - (userDetail.commissionPaid || 0);
                        monthsData[monthIndex].profit += userProfit;
                    }
                }
            }
        });

        // Sprawdź czy tryb ciemny jest aktywny
        const isDarkMode = document.body.classList.contains('dark-mode');
        const textColor = isDarkMode ? '#ecf0f1' : '#333';
        const gridColor = isDarkMode ? '#404040' : '#e0e0e0';
        const positiveColor = isDarkMode ? '#2ecc71' : '#27ae60';
        const negativeColor = isDarkMode ? '#e67e22' : '#d35400';

        // Wyczyść canvas
        ctx.clearRect(0, 0, chartElement.width, chartElement.height);

        // Ustawienia wykresu
        const topMargin = 42;
        const bottomMargin = 58; // ciaśniej, aby stopka się mieściła
        const rightMargin = 28;
        let isMobile = (window.innerWidth || 0) <= 768;
        
        // Dynamiczny lewy margines zależny od szerokości etykiet osi Y (by nie marnować miejsca)
        ctx.font = isMobile ? '11px Roboto' : '12px Roboto';
        const tempMax = Math.max(...monthsData.map(m => m.profit), 0);
        const tempMin = Math.min(...monthsData.map(m => m.profit), 0);
        const tempRange = tempMax - tempMin || 1;
        let maxLabelWidthPx = 0;
        for (let i = 0; i <= 6; i++) {
            const value = tempMax - (tempRange / 6) * i;
            if (value !== 0) {
                const w = ctx.measureText(`${value.toFixed(0)}`).width;
                maxLabelWidthPx = Math.max(maxLabelWidthPx, w);
            }
        }
        const baseLeft = isMobile ? 54 : 96;
        const paddingForLabels = isMobile ? 10 : 16;
        const leftMargin = Math.max(baseLeft, Math.ceil(maxLabelWidthPx + paddingForLabels));
        
        const chartWidth = chartElement.width - leftMargin - rightMargin;
        const chartHeight = chartElement.height - topMargin - bottomMargin;

        // Znajdź maksymalną i minimalną wartość
        const maxProfit = Math.max(...monthsData.map(m => m.profit), 0);
        const minProfit = Math.min(...monthsData.map(m => m.profit), 0);
        const range = maxProfit - minProfit || 1;

        // Oblicz pozycję linii zero
        const zeroY = topMargin + chartHeight - (0 - minProfit) / range * chartHeight;

        // Narysuj siatkę
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        
        // Linie poziome
        for (let i = 0; i <= 6; i++) {
            const y = topMargin + (chartHeight / 6) * i;
            ctx.beginPath();
            ctx.moveTo(leftMargin, y);
            ctx.lineTo(leftMargin + chartWidth, y);
            ctx.stroke();
        }

        ctx.setLineDash([]);

        // Narysuj linie zero
        ctx.strokeStyle = textColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(leftMargin, zeroY);
        ctx.lineTo(leftMargin + chartWidth, zeroY);
        ctx.stroke();

        // Narysuj słupki
        const segmentWidth = chartWidth / monthsData.length;
        const barWidth = Math.floor(segmentWidth * 0.7);
        const innerOffset = (segmentWidth - barWidth) / 2; // centrowanie w segmencie
        // Ustal odstęp etykiet osi X, aby nie nachodziły na siebie na wąskich ekranach
        const minPxPerLabel = 60; // minimalna szerokość na jedną etykietę
        const pxPerLabel = segmentWidth;
        const labelStep = Math.max(1, Math.ceil(minPxPerLabel / pxPerLabel));
        isMobile = (window.innerWidth || 0) <= 768;

        monthsData.forEach((data, index) => {
            const x = leftMargin + index * segmentWidth + innerOffset;
            const barHeight = Math.abs(data.profit) / range * chartHeight;
            const y = data.profit >= 0 ? zeroY - barHeight : zeroY;
            
            ctx.fillStyle = data.profit >= 0 ? positiveColor : negativeColor;
            ctx.fillRect(x, y, barWidth, barHeight);

            // Dodaj wartość na słupku (tylko jeśli wartość != 0)
            if (Math.abs(data.profit) > 0.004) {
                ctx.fillStyle = textColor;
                ctx.font = '13px Roboto';
                ctx.textAlign = 'center';
                const valueY = data.profit >= 0 ? y - 8 : y + barHeight + 14;
                ctx.fillText(`${data.profit.toFixed(2)}`, x + barWidth / 2, valueY);
            }

            // Dodaj etykietę miesiąca (co labelStep), zawsze dodaj dla ostatniego miesiąca
            if (index % labelStep === 0 || index === monthsData.length - 1) {
            ctx.fillStyle = textColor;
                ctx.font = (isMobile ? '10px Roboto' : '11px Roboto');
            ctx.textAlign = 'center';
                ctx.fillText(data.month, Math.round(x + barWidth / 2), topMargin + chartHeight + (isMobile ? 16 : 18));
            }
        });

        // Dodaj etykiety osi Y
        ctx.fillStyle = textColor;
        ctx.font = isMobile ? '10px Roboto' : '11px Roboto';
        ctx.textAlign = 'right';
        
        for (let i = 0; i <= 6; i++) {
            const value = maxProfit - (range / 6) * i;
            const y = topMargin + (chartHeight / 6) * i + 2;
            if (value !== 0) {
                ctx.fillText(`${value.toFixed(0)}`, leftMargin - 10, y);
            }
        }

        // Dodaj tytuł osi Y
        ctx.save();
        ctx.translate(isMobile ? 14 : 20, topMargin + chartHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.font = isMobile ? '11px Roboto' : '13px Roboto';
        ctx.fillText('Zysk (USD)', 0, 0);
        ctx.restore();

        // Dodaj tytuł osi X
        ctx.fillStyle = textColor;
        ctx.font = '13px Roboto';
        ctx.textAlign = 'center';
        ctx.fillText('Miesiąc', leftMargin + chartWidth / 2, chartElement.height - 10);
    }

    // Wersja powiększonego wykresu dla Topcia: używa tych samych zasad co zwykły, ale liczy zysk Topcia
    function drawEnlargedMonthlyProfitsChartForTopciu(transactions) {
        const chartElement = document.getElementById('enlarged-monthly-profits-chart');
        if (!chartElement) return;

        const size = computeEnlargedChartSize();
        chartElement.width = size.width;
        chartElement.height = size.height;
        const ctx = chartElement.getContext('2d');

        const now = new Date();
        const monthsData = [];
        for (let i = 11; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = date.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' });
            monthsData.push({ month: monthName, profit: 0, date });
        }

        if (transactions && transactions.length > 0) {
            transactions.forEach(transaction => {
                const tDate = transaction.createdAt.toDate();
                const idx = monthsData.findIndex(m => m.date.getMonth() === tDate.getMonth() && m.date.getFullYear() === tDate.getFullYear());
                if (idx === -1) return;

                if (transaction.type === 'trade' && transaction.details) {
                    const d = Object.values(transaction.details).find(v => v.name === 'Topciu');
                    if (d) {
                        let pnl = d.profitLossShare - (d.commissionPaid || 0);
                        if (d.commissionCollected) pnl += d.commissionCollected; // prowizje zebrane przez Topcia
                        monthsData[idx].profit += pnl;
                    }
                } else if ((transaction.type === 'deposit' || transaction.type === 'withdrawal') && transaction.userName === 'Topciu') {
                    const amount = transaction.type === 'deposit' ? (transaction.amount || 0) : -(transaction.amount || 0);
                    monthsData[idx].profit += amount;
                }
            });
        }

        const isDarkMode = document.body.classList.contains('dark-mode');
        const textColor = isDarkMode ? '#ecf0f1' : '#333';
        const gridColor = isDarkMode ? '#404040' : '#e0e0e0';
        const positiveColor = isDarkMode ? '#2ecc71' : '#27ae60';
        const negativeColor = isDarkMode ? '#e67e22' : '#d35400';

        ctx.clearRect(0, 0, chartElement.width, chartElement.height);

        // Użyj identycznych ustawień jak u pozostałych użytkowników
        const topMargin = 42;
        const bottomMargin = 58;
        const rightMargin = 28;
        let isMobile = (window.innerWidth || 0) <= 768;

        // Dynamiczny lewy margines zależny od szerokości etykiet osi Y
        ctx.font = isMobile ? '11px Roboto' : '12px Roboto';
        const tempMax2 = Math.max(...monthsData.map(m => m.profit), 0);
        const tempMin2 = Math.min(...monthsData.map(m => m.profit), 0);
        const tempRange2 = tempMax2 - tempMin2 || 1;
        let maxLabelWidthPx2 = 0;
        for (let i = 0; i <= 6; i++) {
            const value = tempMax2 - (tempRange2 / 6) * i;
            if (value !== 0) {
                const w = ctx.measureText(`${value.toFixed(0)}`).width;
                maxLabelWidthPx2 = Math.max(maxLabelWidthPx2, w);
            }
        }
        const baseLeft2 = isMobile ? 54 : 96;
        const paddingForLabels2 = isMobile ? 10 : 16;
        const leftMargin = Math.max(baseLeft2, Math.ceil(maxLabelWidthPx2 + paddingForLabels2));

        const chartWidth = chartElement.width - leftMargin - rightMargin;
        const chartHeight = chartElement.height - topMargin - bottomMargin;

        const maxProfit = Math.max(...monthsData.map(m => m.profit), 0);
        const minProfit = Math.min(...monthsData.map(m => m.profit), 0);
        const range = maxProfit - minProfit || 1;
        const zeroY = topMargin + chartHeight - (0 - minProfit) / range * chartHeight;

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        for (let i = 0; i <= 6; i++) {
            const y = topMargin + (chartHeight / 6) * i;
            ctx.beginPath();
            ctx.moveTo(leftMargin, y);
            ctx.lineTo(leftMargin + chartWidth, y);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        ctx.strokeStyle = textColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(leftMargin, zeroY);
        ctx.lineTo(leftMargin + chartWidth, zeroY);
        ctx.stroke();

        const segmentWidth2 = chartWidth / monthsData.length;
        const barWidth = Math.floor(segmentWidth2 * 0.7);
        const innerOffset2 = (segmentWidth2 - barWidth) / 2;
        // Rzadziej rysuj etykiety X na wąskim ekranie
        const minPxPerLabel2 = 60;
        const pxPerLabel2 = segmentWidth2;
        const labelStep2 = Math.max(1, Math.ceil(minPxPerLabel2 / pxPerLabel2));

        monthsData.forEach((m, index) => {
            const x = leftMargin + index * segmentWidth2 + innerOffset2;
            const barHeight = Math.abs(m.profit) / range * chartHeight;
            const y = m.profit >= 0 ? zeroY - barHeight : zeroY;
            ctx.fillStyle = m.profit >= 0 ? positiveColor : negativeColor;
            ctx.fillRect(x, y, barWidth, barHeight);

            if (Math.abs(m.profit) > 0.004) {
                ctx.fillStyle = textColor;
                ctx.font = '13px Roboto';
                ctx.textAlign = 'center';
                const valueY = m.profit >= 0 ? y - 8 : y + barHeight + 14;
                ctx.fillText(`${m.profit.toFixed(2)}`, x + barWidth / 2, valueY);
            }

            if (index % labelStep2 === 0 || index === monthsData.length - 1) {
                ctx.fillStyle = textColor;
                ctx.font = isMobile ? '10px Roboto' : '12px Roboto';
                ctx.textAlign = 'center';
                ctx.fillText(m.month, Math.round(x + barWidth / 2), topMargin + chartHeight + (isMobile ? 18 : 25));
            }
        });

        ctx.fillStyle = textColor;
        ctx.font = isMobile ? '10px Roboto' : '11px Roboto';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 6; i++) {
            const value = maxProfit - (range / 6) * i;
            const y = topMargin + (chartHeight / 6) * i + 2;
            if (value !== 0) {
                ctx.fillText(`${value.toFixed(0)}`, leftMargin - 10, y);
            }
        }

        ctx.save();
        ctx.translate(isMobile ? 14 : 20, topMargin + chartHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.font = isMobile ? '11px Roboto' : '13px Roboto';
        ctx.fillText('Zysk (USD)', 0, 0);
        ctx.restore();

        ctx.fillStyle = textColor;
        ctx.font = '13px Roboto';
        ctx.textAlign = 'center';
        ctx.fillText('Miesiąc', leftMargin + chartWidth / 2, chartElement.height - 10);
    }