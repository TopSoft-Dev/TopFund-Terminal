// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, getDocs, where } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

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

    // --- Pamięć podręczna i stan aplikacji ---
    let cachedUsers = [];
    let cachedTransactions = [];
    let isArchiveView = false;
    let loggedInUser = null; // Przechowuje dane zalogowanego użytkownika

    // Ukryj główną aplikację na początku
    mainAppElements.forEach(el => el.style.display = 'none');
    loginModal.style.display = 'block'; // Pokaż modal logowania

    // Ukryj przycisk dodawania użytkownika na początku
    showAddUserModalBtn.style.display = 'none';

    // --- Obsługa Logowania ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = loginUsernameInput.value;
        const password = loginPasswordInput.value;
        const hashedPassword = await hashPassword(password);

        try {
            const usersSnapshot = await getDocs(query(collection(db, "users"), where("name", "==", username)));
            if (usersSnapshot.empty) {
                loginErrorElement.textContent = 'Nieprawidłowa nazwa użytkownika lub hasło.';
                return;
            }

            const userDoc = usersSnapshot.docs[0];
            const userData = userDoc.data();

            if (userData.hashedPassword === hashedPassword) {
                loggedInUser = { id: userDoc.id, ...userData }; // Zapisz dane zalogowanego użytkownika
                loginModal.style.display = 'none';
                mainAppElements.forEach(el => el.style.display = ''); // Pokaż główną aplikację
                loginErrorElement.textContent = ''; // Wyczyść błąd

                // Kontrola widoczności elementów na podstawie roli użytkownika
                if (loggedInUser.name === 'Topciu') {
                    showAddUserModalBtn.style.display = 'block';
                    topciuLogoutBtn.style.display = 'block'; // Pokaż przycisk wylogowania dla Topcia
                    transactionsSection.style.display = 'block';
                    totalBalanceContainer.style.display = 'block';
                    usersSection.style.display = 'block';
                    userCard.style.display = 'none'; // Ukryj kartę użytkownika dla Topcia
                } else {
                    showAddUserModalBtn.style.display = 'none';
                    transactionsSection.style.display = 'none';
                    totalBalanceContainer.style.display = 'none';
                    usersSection.style.display = 'none';

                    // Pokaż kartę użytkownika i ustaw jego imię
                    userCard.style.display = 'block';
                    usernameDisplay.textContent = loggedInUser.name;
                }
                displayUserSummaryCards(cachedUsers, loggedInUser); // Odśwież karty po zalogowaniu
                displayTransactions(cachedTransactions, loggedInUser); // Odśwież transakcje po zalogowaniu
            } else {
                loginErrorElement.textContent = 'Nieprawidłowa nazwa użytkownika lub hasło.';
            }
        } catch (error) {
            console.error("Błąd logowania: ", error);
            loginErrorElement.textContent = 'Wystąpił błąd podczas logowania.';
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
    

    async function recalculateAllBalances(transactionIdToSkip = null) {
        document.body.style.cursor = 'wait';
        try {
            const usersSnapshot = await getDocs(collection(db, "users"));
            const transactionsSnapshot = await getDocs(query(collection(db, "transactions"), orderBy("createdAt", "asc")));
            let usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            let recalculatedUsers = {};
            usersData.forEach(user => {
                recalculatedUsers[user.id] = { ...user, currentBalance: user.startBalance };
            });

            for (const transaction of transactions) {
                if (transaction.id === transactionIdToSkip) continue;

                if (transaction.type === 'deposit' || transaction.type === 'withdrawal') {
                    const user = recalculatedUsers[transaction.userId];
                    if (user) user.currentBalance += (transaction.type === 'deposit' ? transaction.amount : -transaction.amount);
                } else if (transaction.type === 'trade') {
                    const profitLoss = transaction.amount;
                    const totalBalanceBeforeTrade = Object.values(recalculatedUsers).reduce((sum, u) => sum + u.currentBalance, 0);
                    if (totalBalanceBeforeTrade > 0) {
                        let totalCommissionCollected = 0;
                        let userUpdates = {};
                        for (const userId in recalculatedUsers) {
                            const user = recalculatedUsers[userId];
                            const userContributionRatio = user.currentBalance / totalBalanceBeforeTrade;
                            const userProfitLoss = profitLoss * userContributionRatio;
                            let userShareAfterCommission = userProfitLoss;
                            let commissionAmount = 0;
                            if (user.name !== 'Topciu' && userProfitLoss > 0) {
                                commissionAmount = userProfitLoss * (user.commission / 100);
                                userShareAfterCommission -= commissionAmount;
                                totalCommissionCollected += commissionAmount;
                            }
                            userUpdates[userId] = { newBalance: user.currentBalance + userShareAfterCommission };
                        }
                        const topciuId = Object.keys(recalculatedUsers).find(id => recalculatedUsers[id].name === 'Topciu');
                        for (const userId in userUpdates) {
                            recalculatedUsers[userId].currentBalance = userUpdates[userId].newBalance;
                        }
                        if (topciuId && totalCommissionCollected > 0) {
                            recalculatedUsers[topciuId].currentBalance += totalCommissionCollected;
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
        const newPassword = editPasswordInput.value; // Pobierz nowe hasło

        if (isNaN(newStartBalance)) {
            alert('Proszę podać prawidłowe saldo.');
            return;
        }

        let updateData = { startBalance: newStartBalance, color: newColor };

        // Jeśli Topciu jest zalogowany i podano nowe hasło, zahaszuj je i dodaj do aktualizacji
        if (loggedInUser && loggedInUser.name === 'Topciu' && newPassword) {
            updateData.hashedPassword = await hashPassword(newPassword);
        }

        try {
            await updateDoc(doc(db, "users", userId), updateData);
            await recalculateAllBalances();
            editUserModal.style.display = 'none';
        } catch (error) {
            console.error("Błąd podczas aktualizacji użytkownika: ", error);
        }
    }

    function openEditModal(user) {
        document.getElementById('editUserId').value = user.id;
        document.getElementById('editStartBalance').value = user.startBalance;
        document.getElementById('editColor').value = user.color;

        // Pokaż/ukryj pole hasła w zależności od zalogowanego użytkownika
        editPasswordInput.value = ''; // Zawsze czyść pole hasła przy otwieraniu modala
        if (loggedInUser && loggedInUser.name === 'Topciu') {
            editPasswordGroup.style.display = 'block';
        } else {
            editPasswordGroup.style.display = 'none';
        }

        editUserModal.style.display = 'block';
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
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        let topciuUser = users.find(u => u.name === 'Topciu');
        if (!topciuUser) throw new Error('Brak użytkownika "Topciu".');

        if (type === 'deposit' || type === 'withdrawal') {
            const targetUser = users.find(u => u.id === userId);
            if (!targetUser) throw new Error('Wybrany użytkownik nie istnieje.');
            const newCurrentBalance = targetUser.currentBalance + (type === 'deposit' ? amount : -amount);
            await updateDoc(doc(db, "users", targetUser.id), { currentBalance: newCurrentBalance });
            await addDoc(collection(db, "transactions"), {
                userId: targetUser.id, userName: targetUser.name, type: type, amount: amount, description: "",
                balanceAfter: newCurrentBalance, createdAt: new Date()
            });
        } else if (type === 'trade') {
            const oldTotalBalance = cachedUsers.reduce((sum, u) => sum + u.currentBalance, 0);
            const newTotalBalance = amount;
            const profitLoss = newTotalBalance - oldTotalBalance;
            if (oldTotalBalance <= 0) throw new Error('Saldo początkowe jest zerowe lub ujemne.');
            let totalCommissionCollected = 0;
            let transactionDetails = {};
            for (const user of users) {
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

        const filteredTransactions = transactions.filter(transaction => {
            const transactionDate = transaction.createdAt.toDate();
            return isArchiveView ? transactionDate < oneMonthAgo : transactionDate >= oneMonthAgo;
        });

        transactionsHistoryBody.innerHTML = '';
        if (filteredTransactions.length === 0) {
            transactionsHistoryBody.innerHTML = `<tr><td colspan="6">${isArchiveView ? 'Archiwum jest puste.' : 'Brak transakcji w tym miesiącu.'}</td></tr>`;
            return;
        }

        filteredTransactions.forEach(transaction => {
            const row = document.createElement('tr');
            let descriptionText = "";
            let amountText = '';
            let balanceAfterText = '';
            if (transaction.type === 'deposit' || transaction.type === 'withdrawal') {
                descriptionText = `${transaction.userName}`;
                amountText = `<span>${transaction.amount > 0 ? '+' : ''}${transaction.amount.toFixed(2)}</span>&nbsp;USD`;
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
                    // Only show details if loggedInUser is Topciu or if the detail belongs to the loggedInUser
                    if (currentUser && (currentUser.name === 'Topciu' || detail.name === currentUser.name)) {
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
                const detailsRow = document.createElement('tr');
                detailsRow.className = 'transaction-details-container';
                detailsRow.id = `details-${transaction.id}`;
                detailsRow.style.display = 'none';
                detailsRow.innerHTML = `<td colspan="6"><div class="details-content">${detailsHtml}</div></td>`;
                transactionsHistoryBody.appendChild(detailsRow);
            }
        });
    }

    // --- OBSŁUGA ZDARZEŃ (EVENT LISTENERS) ---

    showAddUserModalBtn.addEventListener('click', () => addUserModal.style.display = 'block');
    closeAddModalBtn.addEventListener('click', () => addUserModal.style.display = 'none');
    closeEditModalBtn.addEventListener('click', () => editUserModal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target == addUserModal) addUserModal.style.display = "none";
        if (event.target == editUserModal) editUserModal.style.display = "none";
    });

    // Obsługa przełączania widoczności hasła
    if (toggleEditPassword) {
        toggleEditPassword.addEventListener('click', () => {
            const type = editPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            editPasswordInput.setAttribute('type', type);
            toggleEditPassword.textContent = type === 'password' ? 'Pokaż' : 'Ukryj';
        });
    }

    

    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        // Sprawdź, czy zalogowany użytkownik to Topciu
        if (!loggedInUser || loggedInUser.name !== 'Topciu') {
            alert('Tylko Topciu może dodawać nowych użytkowników.');
            return;
        }

        const userName = document.getElementById('user-name').value;
        const userColor = document.getElementById('user-color').value;
        const startBalance = parseFloat(document.getElementById('user-balance').value);
        const commission = parseFloat(document.getElementById('user-commission').value);
        if (userName && !isNaN(startBalance) && !isNaN(commission)) {
            await addDoc(collection(db, "users"), { name: userName, color: userColor, startBalance: startBalance, currentBalance: startBalance, commission: commission, createdAt: new Date() });
            addUserForm.reset();
            addUserModal.style.display = 'none';
        } else {
            alert('Proszę wypełnić wszystkie pola poprawnymi danymi.');
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
            deleteUser(deleteButton.dataset.userId, deleteButton.dataset.userName);
        }
    });

    transactionsHistoryBody.addEventListener('click', (event) => {
        const detailsButton = event.target.closest('.details-toggle-btn');
        const deleteButton = event.target.closest('.delete-transaction-btn');
        if (detailsButton) {
            const transactionId = detailsButton.dataset.transactionId;
            const detailsContainer = document.getElementById(`details-${transactionId}`);
            if (detailsContainer) {
                const isHidden = detailsContainer.style.display === 'none';
                detailsContainer.style.display = isHidden ? 'table-row' : 'none';
                detailsButton.textContent = isHidden ? '–' : '+';
                detailsButton.title = isHidden ? 'Ukryj szczegóły' : 'Pokaż szczegóły';
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
        displayTransactions(cachedTransactions); // Odśwież widok z nowym filtrem
    });

    // --- GŁÓWNE NASŁUCHIWANIE NA ZMIANY W BAZIE ---
    onSnapshot(query(collection(db, "users"), orderBy("createdAt")), (snapshot) => {
        cachedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    });
});
