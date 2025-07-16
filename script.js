// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, getDocs, where } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// --- WAŻNE: ID APLIKACJI ---
const APLIKACJA_ID = "topfund-terminal"; 
// -----------------------------------------

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
                        usernameDisplay.textContent = loggedInUser.name;
                    }
                    displayUserSummaryCards(cachedUsers, loggedInUser);
                    displayTransactions(cachedTransactions, loggedInUser);
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

    async function processTransaction(type, userId, amount) {
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

            // Użyj przefiltrowanej listy `activeUsers` do obliczeń
            const oldTotalBalance = activeUsers.reduce((sum, u) => sum + u.currentBalance, 0);
            const newTotalBalance = amount;
            const profitLoss = newTotalBalance - oldTotalBalance;

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
    
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
        let timeFilteredTransactions = transactions.filter(transaction => {
            const transactionDate = transaction.createdAt.toDate();
            return isArchiveView ? transactionDate < oneMonthAgo : transactionDate >= oneMonthAgo;
        });
    
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
                                const netAmount = detail.profitLossShare - (detail.commissionCollected || 0); // Kwota netto (bez prowizji)
                                const grossAmount = detail.profitLossShare; // Kwota brutto (z prowizjami)
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
    }

    function calculateDetailedStats(transactions, currentUser) {
        if (!currentUser) return;

        const now = new Date();
        const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        let currentMonthProfit = 0;
        let totalTrades = 0;
        let profitableTrades = 0;
        let lossTrades = 0;

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

        // Oblicz statystyki z transakcji bieżącego miesiąca
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

                    // Miesięczne zyski tylko z bieżącego miesiąca
                    if (transactionDate >= currentMonth && transactionDate <= currentMonthEnd) {
                        currentMonthProfit += userProfit;
                    }
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

        // Oblicz skuteczność
        const successRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;

        // Aktualizuj elementy DOM
        document.getElementById('monthlyProfit').textContent = `${currentMonthProfit.toFixed(2)} USD`;
        document.getElementById('monthlyChange').textContent = `${monthlyChangePercent.toFixed(1)}%`;
        document.getElementById('totalTrades').textContent = totalTrades;
        document.getElementById('profitableTrades').textContent = profitableTrades;
        document.getElementById('lossTrades').textContent = lossTrades;
        document.getElementById('successRate').textContent = `${successRate.toFixed(1)}%`;

        // Dodaj kolory do wartości
        const monthlyProfitEl = document.getElementById('monthlyProfit');
        const monthlyChangeEl = document.getElementById('monthlyChange');
        const successRateEl = document.getElementById('successRate');

        monthlyProfitEl.className = currentMonthProfit >= 0 ? 'positive-amount' : 'negative-amount';
        monthlyChangeEl.className = monthlyChangePercent >= 0 ? 'positive-amount' : 'negative-amount';
        successRateEl.className = successRate >= 50 ? 'positive-amount' : 'negative-amount';
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

    // Obsługa kliknięcia na kolorowe karty użytkowników
    userSummaryCards.addEventListener('click', (event) => {
        const userCard = event.target.closest('.user-summary-card');
        if (userCard) {
            const userId = userCard.getAttribute('data-user-id');
            const user = cachedUsers.find(u => u.id === userId);
            
            if (user) {
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

    transactionTypeSelect.addEventListener('change', () => {
        transactionUserSelect.style.display = transactionTypeSelect.value === 'trade' ? 'none' : 'block';
    });

    addTransactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = transactionTypeSelect.value;
        const userId = transactionUserSelect.value;
        const amount = parseFloat(transactionAmountInput.value);
        if (isNaN(amount) || amount < 0) {
            alert('Proszę podać prawidłową kwotę transakcji.'); return;
        }
        if ((type === 'deposit' || type === 'withdrawal') && !userId) {
            alert('Proszę wybrać użytkownika dla wpłaty/wypłaty.'); return;
        }
        try {
            await processTransaction(type, userId, amount);
            addTransactionForm.reset();
            transactionUserSelect.style.display = 'none';
            transactionTypeSelect.value = 'trade';
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
                                const netAmount = detail.profitLossShare - (detail.commissionCollected || 0); // Kwota netto (bez prowizji)
                                const grossAmount = detail.profitLossShare; // Kwota brutto (z prowizjami)
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
    });

    onSnapshot(query(collection(db, "transactions"), orderBy("createdAt", "desc")), (snapshot) => {
        cachedTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayTransactions(cachedTransactions, loggedInUser); // Wyświetl dane z uwzględnieniem filtra archiwum
    });

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
    });
});

// --- Funkcja testowa do dodania starej transakcji ---
// Można ją wywołać w konsoli przez: addTestTransaction()
window.addTestTransaction = async function() {
    console.log("Dodawanie testowej transakcji archiwalnej...");
    try {
        const oldDate = new Date();
        oldDate.setMonth(oldDate.getMonth() - 2); // Data 2 miesiące wstecz

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

    function drawMonthlyProfitsChart(transactions, currentUser) {
        if (!currentUser || currentUser.name === 'Topciu') return;
        
        const chartElement = document.getElementById('monthly-profits-chart');
        if (!chartElement) return;

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
        const padding = 40;
        const chartWidth = chartElement.width - 2 * padding;
        const chartHeight = chartElement.height - 2 * padding;
        const barWidth = chartWidth / monthsData.length * 0.6;
        const barSpacing = chartWidth / monthsData.length * 0.4;

        // Znajdź maksymalną i minimalną wartość
        const maxProfit = Math.max(...monthsData.map(m => m.profit), 0);
        const minProfit = Math.min(...monthsData.map(m => m.profit), 0);
        const range = maxProfit - minProfit || 1;

        // Oblicz pozycję linii zero
        const zeroY = padding + chartHeight - (0 - minProfit) / range * chartHeight;

        // Narysuj siatkę
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        
        // Linie poziome
        for (let i = 0; i <= 4; i++) {
            const y = padding + (chartHeight / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + chartWidth, y);
            ctx.stroke();
        }

        ctx.setLineDash([]);

        // Narysuj linie zero
        ctx.strokeStyle = textColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding, zeroY);
        ctx.lineTo(padding + chartWidth, zeroY);
        ctx.stroke();

        // Narysuj słupki
        monthsData.forEach((data, index) => {
            const x = padding + (chartWidth / monthsData.length) * index + barSpacing / 2;
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
            ctx.fillText(data.month, x + barWidth / 2, padding + chartHeight + 15);
        });

        // Dodaj etykiety osi Y
        ctx.fillStyle = textColor;
        ctx.font = '9px Roboto';
        ctx.textAlign = 'right';
        
        for (let i = 0; i <= 4; i++) {
            const value = maxProfit - (range / 4) * i;
            const y = padding + (chartHeight / 4) * i + 3;
            if (value !== 0) {
                ctx.fillText(`${value.toFixed(0)}`, padding - 5, y);
            }
        }
    }

    function drawEnlargedMonthlyProfitsChart(transactions, currentUser) {
        if (!currentUser || currentUser.name === 'Topciu') return;
        
        const chartElement = document.getElementById('enlarged-monthly-profits-chart');
        if (!chartElement) return;

        const ctx = chartElement.getContext('2d');
        const now = new Date();
        const monthsData = [];
        
        // Przygotuj dane dla ostatnich 12 miesięcy (więcej dla większego wykresu)
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

        // Ustawienia wykresu (większe marginesy dla większego wykresu)
        const padding = 60;
        const chartWidth = chartElement.width - 2 * padding;
        const chartHeight = chartElement.height - 2 * padding;
        const barWidth = chartWidth / monthsData.length * 0.7;
        const barSpacing = chartWidth / monthsData.length * 0.3;

        // Znajdź maksymalną i minimalną wartość
        const maxProfit = Math.max(...monthsData.map(m => m.profit), 0);
        const minProfit = Math.min(...monthsData.map(m => m.profit), 0);
        const range = maxProfit - minProfit || 1;

        // Oblicz pozycję linii zero
        const zeroY = padding + chartHeight - (0 - minProfit) / range * chartHeight;

        // Narysuj siatkę
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        
        // Linie poziome
        for (let i = 0; i <= 6; i++) {
            const y = padding + (chartHeight / 6) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + chartWidth, y);
            ctx.stroke();
        }

        ctx.setLineDash([]);

        // Narysuj linie zero
        ctx.strokeStyle = textColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding, zeroY);
        ctx.lineTo(padding + chartWidth, zeroY);
        ctx.stroke();

        // Narysuj słupki
        monthsData.forEach((data, index) => {
            const x = padding + (chartWidth / monthsData.length) * index + barSpacing / 2;
            const barHeight = Math.abs(data.profit) / range * chartHeight;
            const y = data.profit >= 0 ? zeroY - barHeight : zeroY;
            
            ctx.fillStyle = data.profit >= 0 ? positiveColor : negativeColor;
            ctx.fillRect(x, y, barWidth, barHeight);

            // Dodaj wartość na słupku (tylko jeśli wartość != 0)
            if (data.profit !== 0) {
                ctx.fillStyle = textColor;
                ctx.font = '14px Roboto';
                ctx.textAlign = 'center';
                const valueY = data.profit >= 0 ? y - 8 : y + barHeight + 18;
                ctx.fillText(`${data.profit.toFixed(0)}`, x + barWidth / 2, valueY);
            }

            // Dodaj etykietę miesiąca
            ctx.fillStyle = textColor;
            ctx.font = '12px Roboto';
            ctx.textAlign = 'center';
            ctx.fillText(data.month, x + barWidth / 2, padding + chartHeight + 25);
        });

        // Dodaj etykiety osi Y
        ctx.fillStyle = textColor;
        ctx.font = '12px Roboto';
        ctx.textAlign = 'right';
        
        for (let i = 0; i <= 6; i++) {
            const value = maxProfit - (range / 6) * i;
            const y = padding + (chartHeight / 6) * i + 4;
            if (value !== 0) {
                ctx.fillText(`${value.toFixed(0)}`, padding - 10, y);
            }
        }

        // Dodaj tytuł osi Y
        ctx.save();
        ctx.translate(25, padding + chartHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.font = '14px Roboto';
        ctx.fillText('Zysk (USD)', 0, 0);
        ctx.restore();

        // Dodaj tytuł osi X
        ctx.fillStyle = textColor;
        ctx.font = '14px Roboto';
        ctx.textAlign = 'center';
        ctx.fillText('Miesiąc', padding + chartWidth / 2, chartElement.height - 10);
    }