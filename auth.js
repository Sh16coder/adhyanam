// DOM Elements
const authPage = document.getElementById('auth-page');
const setupPage = document.getElementById('setup-page');
const dashboardPage = document.getElementById('dashboard-page');
const resultsPage = document.getElementById('results-page');

const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const googleLoginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');

// Tab Switching
loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
});

registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.style.display = 'block';
    loginForm.style.display = 'none';
});

// Email/Password Login
loginBtn.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log('User logged in:', userCredential.user);
        showSetupPage();
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
});

// Email/Password Registration
registerBtn.addEventListener('click', async () => {
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
    }
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        // Save user name
        await userCredential.user.updateProfile({
            displayName: name
        });
        
        // Create user document in Firestore
        await db.collection('users').doc(userCredential.user.uid).set({
            name: name,
            email: email,
            createdAt: new Date(),
            totalStudyHours: 0,
            totalDays: 0
        });
        
        console.log('User registered:', userCredential.user);
        showSetupPage();
    } catch (error) {
        alert('Registration failed: ' + error.message);
    }
});

// Google Sign-In
googleLoginBtn.addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    
    try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        // Check if user exists in Firestore
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            // Create new user document
            await db.collection('users').doc(user.uid).set({
                name: user.displayName,
                email: user.email,
                createdAt: new Date(),
                totalStudyHours: 0,
                totalDays: 0
            });
        }
        
        console.log('Google user logged in:', user);
        showSetupPage();
    } catch (error) {
        alert('Google sign-in failed: ' + error.message);
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    try {
        await auth.signOut();
        showAuthPage();
    } catch (error) {
        console.error('Logout failed:', error);
    }
});

// Auth State Listener
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('User is signed in:', user);
        // Check if user has completed setup for today
        checkUserSetup(user);
    } else {
        console.log('User is signed out');
        showAuthPage();
    }
});

// Page Navigation Functions
function showAuthPage() {
    authPage.classList.add('active');
    setupPage.classList.remove('active');
    dashboardPage.classList.remove('active');
    resultsPage.classList.remove('active');
}

function showSetupPage() {
    authPage.classList.remove('active');
    setupPage.classList.add('active');
    dashboardPage.classList.remove('active');
    resultsPage.classList.remove('active');
}

function showDashboardPage() {
    authPage.classList.remove('active');
    setupPage.classList.remove('active');
    dashboardPage.classList.add('active');
    resultsPage.classList.remove('active');
}

function showResultsPage() {
    authPage.classList.remove('active');
    setupPage.classList.remove('active');
    dashboardPage.classList.remove('active');
    resultsPage.classList.add('active');
}

// Check if user needs to do setup
async function checkUserSetup(user) {
    const today = new Date().toDateString();
    const userDoc = await db.collection('users').doc(user.uid).collection('days').doc(today).get();
    
    if (userDoc.exists && userDoc.data().setupCompleted) {
        showDashboardPage();
        loadUserData(user, today);
    } else {
        showSetupPage();
    }
}

// Load user data for dashboard
async function loadUserData(user, date) {
    // Implementation in main.js
    console.log('Loading user data for:', date);
}

// Export functions for use in main.js
window.authModule = {
    auth,
    db,
    showDashboardPage,
    showResultsPage,
    getCurrentUser: () => auth.currentUser
};
