document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    
    // Initialize state
    let state = {
        user: null,
        timer: { seconds: 0, running: false, interval: null },
        studyTime: { totalSeconds: 0, sessions: [] },
        today: {
            targets: [],
            todos: [],
            captures: [],
            activities: [],
            setupCompleted: false
        }
    };

    // DOM Elements with null checks
    const screens = {
        auth: document.getElementById('auth-screen'),
        setup: document.getElementById('setup-screen'),
        dashboard: document.getElementById('dashboard-screen'),
        results: document.getElementById('results-screen')
    };

    // Verify all screens exist
    for (const [name, element] of Object.entries(screens)) {
        if (!element) {
            console.error(`Screen element not found: ${name}`);
            alert(`Error: Could not find ${name} screen. Please refresh the page.`);
            return;
        }
    }

    // Show screen function with null check
    function showScreen(screenName) {
        console.log(`Showing screen: ${screenName}`);
        
        // Hide all screens
        Object.values(screens).forEach(screen => {
            if (screen && screen.classList) {
                screen.classList.remove('active');
            }
        });
        
        // Show requested screen
        const targetScreen = screens[screenName];
        if (targetScreen && targetScreen.classList) {
            targetScreen.classList.add('active');
        } else {
            console.error(`Screen not found: ${screenName}`);
            // Fallback to auth screen
            if (screens.auth && screens.auth.classList) {
                screens.auth.classList.add('active');
            }
        }
        
        // Update date on dashboard
        if (screenName === 'dashboard' && document.getElementById('currentDate')) {
            const now = new Date();
            document.getElementById('currentDate').textContent = 
                now.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
        }
    }

    // Initialize Firebase
    function initFirebase() {
        console.log('Initializing Firebase...');
        
        // Check if Firebase is loaded
        if (typeof firebase === 'undefined') {
            console.error('Firebase SDK not loaded');
            showMessage('Firebase not loaded. Please check your internet connection.', 'error');
            return false;
        }
        
        // Check if Firebase is initialized
        if (!firebase.apps || firebase.apps.length === 0) {
            console.error('Firebase not initialized. Check firebase-config.js');
            showMessage('Firebase configuration error. Please check console.', 'error');
            return false;
        }
        
        console.log('Firebase initialized successfully');
        return true;
    }

    // Show message utility
    function showMessage(message, type = 'info') {
        console.log(`${type}: ${message}`);
        
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());
        
        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">×</button>
        `;
        
        // Style the message
        Object.assign(messageDiv.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 20px',
            background: type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3',
            color: 'white',
            borderRadius: '5px',
            zIndex: '1000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minWidth: '300px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        });
        
        // Add to document
        document.body.appendChild(messageDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentElement) {
                messageDiv.remove();
            }
        }, 5000);
    }

    // Authentication Functions
    async function handleLogin() {
        const email = document.getElementById('loginEmail')?.value;
        const password = document.getElementById('loginPassword')?.value;

        if (!email || !password) {
            showMessage('Please enter email and password', 'error');
            return;
        }

        try {
            showMessage('Logging in...', 'info');
            
            if (!window.firebaseAuth) {
                throw new Error('Firebase authentication not available');
            }
            
            const userCredential = await window.firebaseAuth.signInWithEmailAndPassword(email, password);
            console.log('Login successful:', userCredential.user.email);
            state.user = userCredential.user;
            showMessage('Login successful!', 'success');
            
            // Check user data and show appropriate screen
            setTimeout(() => checkUserData(), 1000);
        } catch (error) {
            console.error('Login error:', error);
            showMessage('Login failed: ' + error.message, 'error');
        }
    }

    async function handleRegister() {
        const name = document.getElementById('registerName')?.value;
        const email = document.getElementById('registerEmail')?.value;
        const password = document.getElementById('registerPassword')?.value;

        if (!name || !email || !password) {
            showMessage('Please fill all fields', 'error');
            return;
        }

        if (password.length < 6) {
            showMessage('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            showMessage('Creating account...', 'info');
            
            if (!window.firebaseAuth || !window.firebaseDb) {
                throw new Error('Firebase not available');
            }
            
            const userCredential = await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
            
            // Update profile with name
            await userCredential.user.updateProfile({ displayName: name });
            
            // Create user document in Firestore
            await window.firebaseDb.collection('users').doc(userCredential.user.uid).set({
                name: name,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                totalStudyHours: 0,
                totalDays: 0
            });

            state.user = userCredential.user;
            showMessage('Account created successfully!', 'success');
            
            // Show setup screen
            setTimeout(() => showScreen('setup'), 1000);
        } catch (error) {
            console.error('Registration error:', error);
            showMessage('Registration failed: ' + error.message, 'error');
        }
    }

    async function handleGoogleLogin() {
        try {
            showMessage('Signing in with Google...', 'info');
            
            if (!window.firebaseAuth || !window.firebaseDb) {
                throw new Error('Firebase not available');
            }
            
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await window.firebaseAuth.signInWithPopup(provider);
            
            // Check if user exists in Firestore
            const userDoc = await window.firebaseDb.collection('users').doc(result.user.uid).get();
            
            if (!userDoc.exists) {
                // Create new user document
                await window.firebaseDb.collection('users').doc(result.user.uid).set({
                    name: result.user.displayName,
                    email: result.user.email,
                    photoURL: result.user.photoURL,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    totalStudyHours: 0,
                    totalDays: 0
                });
            }
            
            state.user = result.user;
            showMessage('Google login successful!', 'success');
            
            // Check user data and show appropriate screen
            setTimeout(() => checkUserData(), 1000);
        } catch (error) {
            console.error('Google login error:', error);
            showMessage('Google login failed: ' + error.message, 'error');
        }
    }

    async function handleLogout() {
        try {
            if (!window.firebaseAuth) {
                throw new Error('Firebase authentication not available');
            }
            
            await window.firebaseAuth.signOut();
            state.user = null;
            
            // Clear local data
            localStorage.removeItem('studyData_local');
            
            showScreen('auth');
            showMessage('Logged out successfully', 'success');
        } catch (error) {
            console.error('Logout error:', error);
            showMessage('Logout failed: ' + error.message, 'error');
        }
    }

    // Check user data
    async function checkUserData() {
        if (!state.user) {
            showScreen('auth');
            return;
        }

        const todayKey = new Date().toDateString();
        console.log('Checking user data for:', todayKey);
        
        // Try to load from localStorage first (fallback)
        const savedData = localStorage.getItem('studyData_local');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                if (data.today && data.today.setupCompleted && data.lastSavedDate === todayKey) {
                    console.log('Loading from localStorage');
                    state.today = data.today;
                    state.studyTime = data.studyTime || state.studyTime;
                    loadSavedData();
                    showScreen('dashboard');
                    return;
                }
            } catch (e) {
                console.error('Error loading localStorage data:', e);
            }
        }

        // Try to load from Firebase if available
        if (window.firebaseDb && state.user.uid) {
            try {
                const docRef = window.firebaseDb.collection('users').doc(state.user.uid)
                    .collection('days').doc(todayKey);
                const doc = await docRef.get();
                
                if (doc.exists) {
                    const data = doc.data();
                    if (data.setupCompleted) {
                        console.log('Loading from Firebase');
                        state.today = data.today || state.today;
                        state.studyTime = data.studyTime || state.studyTime;
                        loadSavedData();
                        showScreen('dashboard');
                        return;
                    }
                }
            } catch (error) {
                console.error('Error loading Firebase data:', error);
                // Continue to fallback
            }
        }

        // If no saved data found, show setup
        console.log('No saved data found, showing setup');
        showScreen('setup');
    }

    // Load saved data into UI
    function loadSavedData() {
        console.log('Loading saved data...');
        
        // Load targets
        if (state.today.targets && state.today.targets.length > 0) {
            renderTargets();
        }
        
        // Load todos
        if (state.today.todos && state.today.todos.length > 0) {
            renderTodos();
        }
        
        // Load captures
        if (state.today.captures && state.today.captures.length > 0) {
            renderCaptures();
        }
        
        // Load activities
        if (state.today.activities && state.today.activities.length > 0) {
            renderActivities();
        }
        
        // Update timer and study time displays
        updateTimerDisplay();
        updateTotalStudyTime();
    }

    // Timer Functions
    function startTimer() {
        if (state.timer.running) return;
        
        console.log('Starting timer...');
        state.timer.running = true;
        state.timer.startTime = new Date();
        
        state.timer.interval = setInterval(() => {
            state.timer.seconds++;
            state.studyTime.totalSeconds++;
            updateTimerDisplay();
            updateTotalStudyTime();
            
            // Auto-save every 30 seconds
            if (state.timer.seconds % 30 === 0) {
                saveData();
            }
        }, 1000);
        
        // Update button states
        const startBtn = document.getElementById('startTimerBtn');
        const pauseBtn = document.getElementById('pauseTimerBtn');
        if (startBtn) startBtn.disabled = true;
        if (pauseBtn) pauseBtn.disabled = false;
        
        addActivity('Timer started', 'play');
    }

    function pauseTimer() {
        if (!state.timer.running) return;
        
        console.log('Pausing timer...');
        clearInterval(state.timer.interval);
        state.timer.running = false;
        
        // Record session
        if (state.timer.startTime) {
            const session = {
                start: state.timer.startTime,
                end: new Date(),
                duration: state.timer.seconds
            };
            state.studyTime.sessions.push(session);
        }
        
        // Update button states
        const startBtn = document.getElementById('startTimerBtn');
        const pauseBtn = document.getElementById('pauseTimerBtn');
        if (startBtn) startBtn.disabled = false;
        if (pauseBtn) pauseBtn.disabled = true;
        
        addActivity('Timer paused', 'pause');
        saveData();
    }

    function resetTimer() {
        console.log('Resetting timer...');
        pauseTimer();
        state.timer.seconds = 0;
        updateTimerDisplay();
        addActivity('Timer reset', 'redo');
    }

    function updateTimerDisplay() {
        const display = document.getElementById('timerDisplay');
        if (!display) return;
        
        const hours = Math.floor(state.timer.seconds / 3600);
        const minutes = Math.floor((state.timer.seconds % 3600) / 60);
        const seconds = state.timer.seconds % 60;
        
        display.textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function updateTotalStudyTime() {
        const display = document.getElementById('totalHours');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        if (!display || !progressBar || !progressText) return;
        
        const hours = Math.floor(state.studyTime.totalSeconds / 3600);
        const minutes = Math.floor((state.studyTime.totalSeconds % 3600) / 60);
        
        display.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        // Update progress (8-hour goal)
        const progress = Math.min((state.studyTime.totalSeconds / (8 * 3600)) * 100, 100);
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}% of daily goal`;
    }

    // Setup Functions
    function addTarget() {
        const input = document.getElementById('targetInput');
        if (!input) return;
        
        const text = input.value.trim();
        if (!text) {
            showMessage('Please enter a target', 'error');
            return;
        }
        
        const target = {
            id: Date.now(),
            text: text,
            completed: false,
            createdAt: new Date()
        };
        
        state.today.targets.push(target);
        input.value = '';
        renderTargets();
        addActivity(`Added target: "${text}"`, 'bullseye');
        saveData();
    }

    function renderTargets() {
        const container = document.getElementById('targetsList');
        if (!container) return;
        
        container.innerHTML = '';
        
        state.today.targets.forEach(target => {
            const div = document.createElement('div');
            div.className = 'target-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = target.completed;
            checkbox.addEventListener('change', () => {
                target.completed = checkbox.checked;
                saveData();
                addActivity(
                    target.completed ? `Completed target: "${target.text}"` : `Unchecked target: "${target.text}"`, 
                    target.completed ? 'check-circle' : 'times-circle'
                );
            });
            
            const span = document.createElement('span');
            span.textContent = target.text;
            if (target.completed) {
                span.style.textDecoration = 'line-through';
                span.style.opacity = '0.6';
            }
            
            div.appendChild(checkbox);
            div.appendChild(span);
            container.appendChild(div);
        });
    }

    function completeSetup() {
        console.log('Completing setup...');
        state.today.setupCompleted = true;
        
        // Save to Firebase if available
        if (window.firebaseDb && state.user) {
            const todayKey = new Date().toDateString();
            window.firebaseDb.collection('users').doc(state.user.uid)
                .collection('days').doc(todayKey).set({
                    today: state.today,
                    studyTime: state.studyTime,
                    setupCompleted: true,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).catch(error => {
                    console.error('Error saving to Firebase:', error);
                });
        }
        
        // Save locally
        saveData();
        
        // Show dashboard
        showScreen('dashboard');
        addActivity('Study session started', 'play-circle');
        
        // Set first session topic
        const firstSlot = document.querySelector('.time-slot input');
        const nextTopic = document.getElementById('nextSessionTopic');
        if (firstSlot && firstSlot.value.trim() && nextTopic) {
            nextTopic.textContent = firstSlot.value.trim();
        }
    }

    // Todo Functions
    function addTodo() {
        const input = document.getElementById('todoInput');
        if (!input) return;
        
        const text = input.value.trim();
        if (!text) {
            showMessage('Please enter a task', 'error');
            return;
        }
        
        const todo = {
            id: Date.now(),
            text: text,
            completed: false,
            createdAt: new Date()
        };
        
        state.today.todos.push(todo);
        input.value = '';
        renderTodos();
        addActivity(`Added task: "${text}"`, 'tasks');
        saveData();
    }

    function renderTodos() {
        const container = document.getElementById('todoList');
        if (!container) return;
        
        container.innerHTML = '';
        
        state.today.todos.forEach(todo => {
            const div = document.createElement('div');
            div.className = `todo-item ${todo.completed ? 'completed' : ''}`;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = todo.completed;
            checkbox.addEventListener('change', () => {
                todo.completed = checkbox.checked;
                div.className = `todo-item ${todo.completed ? 'completed' : ''}`;
                saveData();
                addActivity(
                    todo.completed ? `Completed task: "${todo.text}"` : `Unchecked task: "${todo.text}"`, 
                    todo.completed ? 'check' : 'times'
                );
            });
            
            const span = document.createElement('span');
            span.className = 'task-text';
            span.textContent = todo.text;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-task';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                state.today.todos = state.today.todos.filter(t => t.id !== todo.id);
                renderTodos();
                addActivity(`Deleted task: "${todo.text}"`, 'trash');
                saveData();
            });
            
            div.appendChild(checkbox);
            div.appendChild(span);
            div.appendChild(deleteBtn);
            container.appendChild(div);
        });
    }

    // Camera Functions
    let cameraStream = null;

    async function toggleCamera() {
        const button = document.getElementById('toggleCameraBtn');
        const feed = document.getElementById('cameraFeed');
        const captureBtn = document.getElementById('captureBtn');
        
        if (!button || !feed || !captureBtn) return;
        
        if (!cameraStream) {
            try {
                console.log('Enabling camera...');
                cameraStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'user' } 
                });
                feed.srcObject = cameraStream;
                feed.classList.add('active');
                button.innerHTML = '<i class="fas fa-video-slash"></i> DISABLE CAMERA';
                captureBtn.disabled = false;
                addActivity('Camera enabled', 'camera');
            } catch (error) {
                console.error('Camera error:', error);
                showMessage('Camera error: ' + error.message, 'error');
            }
        } else {
            console.log('Disabling camera...');
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
            feed.srcObject = null;
            feed.classList.remove('active');
            button.innerHTML = '<i class="fas fa-video"></i> ENABLE CAMERA';
            captureBtn.disabled = true;
            addActivity('Camera disabled', 'video-slash');
        }
    }

    function captureImage() {
        if (!cameraStream) return;
        
        const canvas = document.getElementById('cameraCanvas');
        const feed = document.getElementById('cameraFeed');
        const container = document.getElementById('capturesGrid');
        
        if (!canvas || !feed || !container) return;
        
        const context = canvas.getContext('2d');
        canvas.width = feed.videoWidth;
        canvas.height = feed.videoHeight;
        context.drawImage(feed, 0, 0);
        
        const imageData = canvas.toDataURL('image/png');
        const capture = {
            id: Date.now(),
            data: imageData,
            timestamp: new Date()
        };
        
        state.today.captures.push(capture);
        
        // Add to grid
        const img = document.createElement('img');
        img.src = imageData;
        img.alt = 'Capture';
        img.title = 'Captured at ' + capture.timestamp.toLocaleTimeString();
        
        container.appendChild(img);
        addActivity('Image captured', 'camera');
        saveData();
    }

    function renderCaptures() {
        const container = document.getElementById('capturesGrid');
        if (!container) return;
        
        container.innerHTML = '';
        
        state.today.captures.forEach(capture => {
            const img = document.createElement('img');
            img.src = capture.data;
            img.alt = 'Capture';
            img.title = 'Captured at ' + new Date(capture.timestamp).toLocaleTimeString();
            container.appendChild(img);
        });
    }

    // Activity Functions
    function addActivity(text, icon) {
        const activity = {
            id: Date.now(),
            text: text,
            icon: icon,
            timestamp: new Date()
        };
        
        state.today.activities.unshift(activity);
        
        // Keep only last 10 activities
        if (state.today.activities.length > 10) {
            state.today.activities = state.today.activities.slice(0, 10);
        }
        
        renderActivities();
    }

    function renderActivities() {
        const container = document.getElementById('activityList');
        if (!container) return;
        
        container.innerHTML = '';
        
        state.today.activities.forEach(activity => {
            const div = document.createElement('div');
            div.className = 'activity-item';
            
            div.innerHTML = `
                <i class="fas fa-${activity.icon}"></i>
                <span>${activity.text}</span>
                <span class="activity-time">
                    ${new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            `;
            
            container.appendChild(div);
        });
    }

    // Save Data Function
    function saveData() {
        console.log('Saving data...');
        
        const todayKey = new Date().toDateString();
        const dataToSave = {
            today: state.today,
            studyTime: state.studyTime,
            lastSavedDate: todayKey,
            lastSaved: new Date().toISOString()
        };
        
        // Save to localStorage (always)
        localStorage.setItem('studyData_local', JSON.stringify(dataToSave));
        
        // Save to Firebase if available and user is logged in
        if (window.firebaseDb && state.user && navigator.onLine) {
            window.firebaseDb.collection('users').doc(state.user.uid)
                .collection('days').doc(todayKey).set(dataToSave, { merge: true })
                .catch(error => console.error('Firebase save error:', error));
        }
    }

    // End Day Functions
    async function endDay() {
        console.log('Ending day...');
        pauseTimer();
        
        // Calculate statistics
        const completedTargets = state.today.targets.filter(t => t.completed).length;
        const totalTargets = state.today.targets.length;
        const completedTodos = state.today.todos.filter(t => t.completed).length;
        const totalTodos = state.today.todos.length;
        
        // Calculate max sitting hours
        let maxSittingSeconds = 0;
        state.studyTime.sessions.forEach(session => {
            if (session.duration > maxSittingSeconds) {
                maxSittingSeconds = session.duration;
            }
        });
        
        // Calculate productivity score
        const targetScore = totalTargets > 0 ? (completedTargets / totalTargets) * 40 : 0;
        const timeScore = Math.min((state.studyTime.totalSeconds / (4 * 3600)) * 40, 40);
        const taskScore = totalTodos > 0 ? (completedTodos / totalTodos) * 20 : 0;
        const productivityScore = Math.round(targetScore + timeScore + taskScore);
        
        // Update report display
        const reportDate = document.getElementById('reportDate');
        const reportUserName = document.getElementById('reportUserName');
        const targetsCompleted = document.getElementById('targetsCompleted');
        const totalStudyHours = document.getElementById('totalStudyHours');
        const maxSittingHours = document.getElementById('maxSittingHours');
        const tasksCompleted = document.getElementById('tasksCompleted');
        const productivityScoreEl = document.getElementById('productivityScore');
        const sessionsCompleted = document.getElementById('sessionsCompleted');
        const targetsBar = document.getElementById('targetsBar');
        const tasksBar = document.getElementById('tasksBar');
        const summaryText = document.getElementById('summaryText');
        
        if (reportDate) reportDate.textContent = new Date().toLocaleDateString();
        if (reportUserName) reportUserName.textContent = state.user?.displayName || 'Student';
        if (targetsCompleted) targetsCompleted.textContent = `${completedTargets}/${totalTargets}`;
        if (totalStudyHours) totalStudyHours.textContent = document.getElementById('totalHours')?.textContent || '00:00';
        
        const maxHours = Math.floor(maxSittingSeconds / 3600);
        const maxMinutes = Math.floor((maxSittingSeconds % 3600) / 60);
        if (maxSittingHours) maxSittingHours.textContent = 
            `${maxHours.toString().padStart(2, '0')}:${maxMinutes.toString().padStart(2, '0')}`;
        
        if (tasksCompleted) tasksCompleted.textContent = `${completedTodos}/${totalTodos}`;
        if (productivityScoreEl) productivityScoreEl.textContent = `${productivityScore}%`;
        if (sessionsCompleted) sessionsCompleted.textContent = state.studyTime.sessions.length;
        
        const targetsProgress = totalTargets > 0 ? (completedTargets / totalTargets) * 100 : 0;
        const tasksProgress = totalTodos > 0 ? (completedTodos / totalTodos) * 100 : 0;
        
        if (targetsBar) targetsBar.style.width = `${targetsProgress}%`;
        if (tasksBar) tasksBar.style.width = `${tasksProgress}%`;
        
        let summary = '';
        if (productivityScore >= 80) {
            summary = 'Excellent work today! Your focus and productivity were outstanding.';
        } else if (productivityScore >= 60) {
            summary = 'Great job! You made significant progress toward your goals.';
        } else if (productivityScore >= 40) {
            summary = 'Good effort. Consistency is key to success!';
        } else {
            summary = 'Every day is a new opportunity. Keep pushing forward!';
        }
        
        if (summaryText) summaryText.textContent = summary;
        
        // Save final data to Firebase if available
        if (window.firebaseDb && state.user) {
            const todayKey = new Date().toDateString();
            const finalData = {
                today: state.today,
                studyTime: state.studyTime,
                completedTargets,
                totalTargets,
                completedTodos,
                totalTodos,
                totalStudySeconds: state.studyTime.totalSeconds,
                maxSittingSeconds,
                productivityScore,
                sessionsCount: state.studyTime.sessions.length,
                dayEnded: true,
                endTime: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            try {
                await window.firebaseDb.collection('users').doc(state.user.uid)
                    .collection('days').doc(todayKey).set(finalData, { merge: true });
                console.log('Final data saved to Firebase');
            } catch (error) {
                console.error('Error saving final data:', error);
            }
        }
        
        // Show results screen
        showScreen('results');
        addActivity('Ended study day', 'flag-checkered');
    }

    // Fixed: Start New Day Function
    function startNewDay() {
        console.log('Starting new day...');
        
        // Reset timer
        state.timer = { seconds: 0, running: false, interval: null };
        
        // Reset study time and sessions
        state.studyTime = { totalSeconds: 0, sessions: [] };
        
        // Keep targets and todos (as requested)
        // Only reset captures and activities
        state.today.captures = [];
        state.today.activities = [];
        state.today.setupCompleted = false;
        
        // Clear UI elements
        const timerDisplay = document.getElementById('timerDisplay');
        const totalHours = document.getElementById('totalHours');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const capturesGrid = document.getElementById('capturesGrid');
        const activityList = document.getElementById('activityList');
        
        if (timerDisplay) timerDisplay.textContent = '00:00:00';
        if (totalHours) totalHours.textContent = '00:00';
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '0% of daily goal';
        if (capturesGrid) capturesGrid.innerHTML = '';
        if (activityList) activityList.innerHTML = '';
        
        // Enable timer buttons
        const startBtn = document.getElementById('startTimerBtn');
        const pauseBtn = document.getElementById('pauseTimerBtn');
        if (startBtn) startBtn.disabled = false;
        if (pauseBtn) pauseBtn.disabled = true;
        
        // Save reset state
        saveData();
        
        // Show setup screen
        showScreen('setup');
        addActivity('Started new day', 'sun');
    }

    // Save Report as Image
    function saveReportAsImage() {
        const reportCard = document.getElementById('reportCard');
        if (!reportCard) {
            showMessage('Report card not found', 'error');
            return;
        }
        
        if (typeof html2canvas === 'undefined') {
            showMessage('html2canvas library not loaded', 'error');
            return;
        }
        
        showMessage('Saving report as image...', 'info');
        
        html2canvas(reportCard, {
            backgroundColor: '#f8f9ff',
            scale: 2,
            useCORS: true
        }).then(canvas => {
            const link = document.createElement('a');
            const fileName = `Study-Report-${new Date().toISOString().split('T')[0]}.png`;
            link.download = fileName;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            addActivity('Report saved as image', 'download');
            showMessage('Report saved as ' + fileName, 'success');
        }).catch(error => {
            console.error('Error saving report:', error);
            showMessage('Error saving report: ' + error.message, 'error');
        });
    }

    // Setup Event Listeners
    function setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Auth Tab Switching
        const loginTabBtn = document.getElementById('loginTabBtn');
        const registerTabBtn = document.getElementById('registerTabBtn');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (loginTabBtn && registerTabBtn && loginForm && registerForm) {
            loginTabBtn.addEventListener('click', () => {
                loginTabBtn.classList.add('active');
                registerTabBtn.classList.remove('active');
                loginForm.classList.add('active');
                registerForm.classList.remove('active');
            });
            
            registerTabBtn.addEventListener('click', () => {
                registerTabBtn.classList.add('active');
                loginTabBtn.classList.remove('active');
                registerForm.classList.add('active');
                loginForm.classList.remove('active');
            });
        }
        
        // Auth Buttons
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        const googleLoginBtn = document.getElementById('googleLoginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (loginBtn) loginBtn.addEventListener('click', handleLogin);
        if (registerBtn) registerBtn.addEventListener('click', handleRegister);
        if (googleLoginBtn) googleLoginBtn.addEventListener('click', handleGoogleLogin);
        if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
        
        // Setup
        const addTargetBtn = document.getElementById('addTargetBtn');
        const targetInput = document.getElementById('targetInput');
        const startStudyBtn = document.getElementById('startStudyBtn');
        
        if (addTargetBtn) addTargetBtn.addEventListener('click', addTarget);
        if (targetInput) {
            targetInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addTarget();
            });
        }
        if (startStudyBtn) startStudyBtn.addEventListener('click', completeSetup);
        
        // Timer
        const startTimerBtn = document.getElementById('startTimerBtn');
        const pauseTimerBtn = document.getElementById('pauseTimerBtn');
        const resetTimerBtn = document.getElementById('resetTimerBtn');
        
        if (startTimerBtn) startTimerBtn.addEventListener('click', startTimer);
        if (pauseTimerBtn) pauseTimerBtn.addEventListener('click', pauseTimer);
        if (resetTimerBtn) resetTimerBtn.addEventListener('click', resetTimer);
        
        // Camera
        const toggleCameraBtn = document.getElementById('toggleCameraBtn');
        const captureBtn = document.getElementById('captureBtn');
        
        if (toggleCameraBtn) toggleCameraBtn.addEventListener('click', toggleCamera);
        if (captureBtn) captureBtn.addEventListener('click', captureImage);
        
        // Todos
        const addTodoBtn = document.getElementById('addTodoBtn');
        const todoInput = document.getElementById('todoInput');
        
        if (addTodoBtn) addTodoBtn.addEventListener('click', addTodo);
        if (todoInput) {
            todoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addTodo();
            });
        }
        
        // End Day
        const endDayBtn = document.getElementById('endDayBtn');
        if (endDayBtn) endDayBtn.addEventListener('click', endDay);
        
        // Results
        const saveReportBtn = document.getElementById('saveReportBtn');
        const newDayBtn = document.getElementById('newDayBtn');
        const backDashboardBtn = document.getElementById('backDashboardBtn');
        
        if (saveReportBtn) saveReportBtn.addEventListener('click', saveReportAsImage);
        if (newDayBtn) newDayBtn.addEventListener('click', startNewDay);
        if (backDashboardBtn) backDashboardBtn.addEventListener('click', () => showScreen('dashboard'));
        
        // Music (optional)
        const playMusicBtn = document.getElementById('playMusicBtn');
        const pauseMusicBtn = document.getElementById('pauseMusicBtn');
        const volumeSlider = document.getElementById('volumeSlider');
        const backgroundMusic = document.getElementById('backgroundMusic');
        
        if (playMusicBtn && backgroundMusic) {
            playMusicBtn.addEventListener('click', () => {
                const select = document.getElementById('musicSelect');
                if (select && select.value) {
                    backgroundMusic.src = select.value;
                    backgroundMusic.play().catch(e => console.log('Music play error:', e));
                }
            });
        }
        
        if (pauseMusicBtn && backgroundMusic) {
            pauseMusicBtn.addEventListener('click', () => {
                backgroundMusic.pause();
            });
        }
        
        if (volumeSlider && backgroundMusic) {
            volumeSlider.addEventListener('input', (e) => {
                backgroundMusic.volume = e.target.value / 100;
            });
        }
        
        // Auto-save
        setInterval(saveData, 30000); // Every 30 seconds
        window.addEventListener('beforeunload', saveData);
        
        console.log('Event listeners setup complete');
    }

    // Firebase Auth State Listener
    function setupFirebaseAuthListener() {
        if (!window.firebaseAuth) {
            console.log('Firebase auth not available, using local mode');
            // Start in auth screen
            setTimeout(() => showScreen('auth'), 500);
            return;
        }
        
        window.firebaseAuth.onAuthStateChanged((user) => {
            if (user) {
                console.log('User is signed in:', user.email);
                state.user = user;
                checkUserData();
            } else {
                console.log('No user signed in');
                state.user = null;
                showScreen('auth');
            }
        });
    }

    // Initialize everything
    function initApp() {
        console.log('Initializing application...');
        
        // Initialize Firebase
        const firebaseReady = initFirebase();
        
        // Setup Firebase auth listener
        if (firebaseReady) {
            setupFirebaseAuthListener();
        } else {
            // Fallback to local mode
            console.log('Using local mode (no Firebase)');
            showScreen('auth');
        }
        
        // Setup event listeners
        setupEventListeners();
        
        // Set current date
        const currentDateEl = document.getElementById('currentDate');
        if (currentDateEl) {
            const now = new Date();
            currentDateEl.textContent = now.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
        
        // Update next session countdown
        function updateNextSession() {
            const now = new Date();
            const nextHour = new Date();
            nextHour.setHours(now.getHours() + 1, 0, 0, 0);
            
            const diff = nextHour - now;
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            const countdownEl = document.getElementById('nextSessionCountdown');
            if (countdownEl) {
                countdownEl.textContent = 
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }
        
        // Update every second
        setInterval(updateNextSession, 1000);
        updateNextSession();
        
        console.log('Application initialized successfully');
    }

    // Start the app
    initApp();
});