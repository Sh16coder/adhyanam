document.addEventListener('DOMContentLoaded', function() {
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

    // DOM Elements
    const screens = {
        auth: document.getElementById('auth-screen'),
        setup: document.getElementById('setup-screen'),
        dashboard: document.getElementById('dashboard'),
        results: document.getElementById('results-screen')
    };

    // Initialize Firebase immediately
    initFirebase();

    function initFirebase() {
        // Check if Firebase is available
        if (typeof firebase === 'undefined') {
            console.error('Firebase not loaded. Check if scripts are loaded in correct order.');
            showMessage('Firebase not loaded. Please refresh the page.', 'error');
            return;
        }
        
        // Check if already initialized
        if (!firebase.apps.length) {
            console.error('Firebase not initialized. Check firebase-config.js');
            showMessage('Firebase configuration missing.', 'error');
            return;
        }
        
        console.log('Firebase initialized successfully');
        
        // Set up auth state listener
        window.firebaseAuth.onAuthStateChanged((user) => {
            if (user) {
                console.log('User logged in:', user.email);
                state.user = user;
                checkUserData();
            } else {
                console.log('No user logged in');
                state.user = null;
                showScreen('auth');
            }
        });
    }

    // Show message utility
    function showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">×</button>
        `;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
            color: white;
            border-radius: 5px;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: space-between;
            min-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(messageDiv);
        setTimeout(() => {
            if (messageDiv.parentElement) {
                messageDiv.remove();
            }
        }, 5000);
    }

    // Add this CSS for messages
    const style = document.createElement('style');
    style.textContent = `
        .message button {
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            margin-left: 10px;
        }
    `;
    document.head.appendChild(style);

    // Authentication Functions
    async function handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            showMessage('Please enter email and password', 'error');
            return;
        }

        try {
            showMessage('Logging in...', 'info');
            const userCredential = await window.firebaseAuth.signInWithEmailAndPassword(email, password);
            console.log('Login successful:', userCredential.user.email);
            state.user = userCredential.user;
            showMessage('Login successful!', 'success');
        } catch (error) {
            console.error('Login error:', error);
            showMessage('Login failed: ' + error.message, 'error');
        }
    }

    async function handleRegister() {
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

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
        } catch (error) {
            console.error('Registration error:', error);
            showMessage('Registration failed: ' + error.message, 'error');
        }
    }

    async function handleGoogleLogin() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            showMessage('Signing in with Google...', 'info');
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
        } catch (error) {
            console.error('Google login error:', error);
            showMessage('Google login failed: ' + error.message, 'error');
        }
    }

    async function handleLogout() {
        try {
            await window.firebaseAuth.signOut();
            state.user = null;
            showScreen('auth');
            showMessage('Logged out successfully', 'success');
        } catch (error) {
            console.error('Logout error:', error);
            showMessage('Logout failed: ' + error.message, 'error');
        }
    }

    async function checkUserData() {
        if (!state.user) return;

        const todayKey = new Date().toDateString();
        
        // Try to load from localStorage first
        const savedData = localStorage.getItem(`studyData_${state.user.uid}_${todayKey}`);
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                if (data.today && data.today.setupCompleted) {
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

        // Try to load from Firebase
        try {
            const docRef = window.firebaseDb.collection('users').doc(state.user.uid)
                .collection('days').doc(todayKey);
            const doc = await docRef.get();
            
            if (doc.exists) {
                const data = doc.data();
                if (data.setupCompleted) {
                    state.today = data.today || state.today;
                    state.studyTime = data.studyTime || state.studyTime;
                    loadSavedData();
                    showScreen('dashboard');
                    return;
                }
            }
        } catch (error) {
            console.error('Error loading Firebase data:', error);
        }

        // If no saved data found, show setup
        showScreen('setup');
    }

    function loadSavedData() {
        // Load targets
        renderTargets();
        
        // Load todos
        renderTodos();
        
        // Load captures
        renderCaptures();
        
        // Load activities
        renderActivities();
        
        // Update timer and study time displays
        updateTimerDisplay();
        updateTotalStudyTime();
    }

    // Screen Management
    function showScreen(screenName) {
        Object.values(screens).forEach(screen => {
            screen.classList.remove('active');
        });
        screens[screenName].classList.add('active');
        
        // Update date on dashboard
        if (screenName === 'dashboard') {
            const now = new Date();
            document.getElementById('current-date').textContent = 
                now.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
        }
    }

    // Timer Functions
    function startTimer() {
        if (state.timer.running) return;
        
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
        
        document.getElementById('start-timer').disabled = true;
        document.getElementById('pause-timer').disabled = false;
        addActivity('Timer started', 'play');
    }

    function pauseTimer() {
        if (!state.timer.running) return;
        
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
        
        document.getElementById('start-timer').disabled = false;
        document.getElementById('pause-timer').disabled = true;
        addActivity('Timer paused', 'pause');
        saveData();
    }

    function resetTimer() {
        pauseTimer();
        state.timer.seconds = 0;
        updateTimerDisplay();
        addActivity('Timer reset', 'redo');
    }

    function updateTimerDisplay() {
        const hours = Math.floor(state.timer.seconds / 3600);
        const minutes = Math.floor((state.timer.seconds % 3600) / 60);
        const seconds = state.timer.seconds % 60;
        
        document.getElementById('timer-display').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function updateTotalStudyTime() {
        const hours = Math.floor(state.studyTime.totalSeconds / 3600);
        const minutes = Math.floor((state.studyTime.totalSeconds % 3600) / 60);
        
        document.getElementById('total-hours').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        // Update progress
        const progress = Math.min((state.studyTime.totalSeconds / (8 * 3600)) * 100, 100);
        document.getElementById('progress-bar').style.width = `${progress}%`;
        document.getElementById('progress-text').textContent = `${Math.round(progress)}% of daily goal`;
    }

    // Setup Functions
    function addTarget() {
        const input = document.getElementById('target-input');
        const text = input.value.trim();
        if (!text) return;
        
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
        const container = document.getElementById('targets-list');
        if (!container) return;
        
        container.innerHTML = '';
        state.today.targets.forEach(target => {
            const div = document.createElement('div');
            div.className = 'target-item';
            div.innerHTML = `
                <input type="checkbox" ${target.completed ? 'checked' : ''}>
                <span style="${target.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                    ${target.text}
                </span>
            `;
            
            const checkbox = div.querySelector('input');
            checkbox.addEventListener('change', () => {
                target.completed = checkbox.checked;
                saveData();
                addActivity(target.completed ? `Completed target: "${target.text}"` : `Unchecked target: "${target.text}"`, 
                           target.completed ? 'check-circle' : 'times-circle');
            });
            
            container.appendChild(div);
        });
    }

    function completeSetup() {
        state.today.setupCompleted = true;
        
        // Save to Firebase
        if (state.user) {
            const todayKey = new Date().toDateString();
            window.firebaseDb.collection('users').doc(state.user.uid)
                .collection('days').doc(todayKey).set({
                    today: state.today,
                    studyTime: state.studyTime,
                    setupCompleted: true,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).catch(error => {
                    console.error('Error saving setup:', error);
                });
        }
        
        // Save locally
        saveData();
        
        // Show dashboard
        showScreen('dashboard');
        addActivity('Study session started', 'play-circle');
        
        // Set first session topic
        const firstSlot = document.querySelector('.time-slot input');
        if (firstSlot && firstSlot.value.trim()) {
            document.getElementById('next-session-topic').textContent = firstSlot.value.trim();
        }
    }

    // Todo Functions
    function addTodo() {
        const input = document.getElementById('todo-input');
        const text = input.value.trim();
        if (!text) return;
        
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
        const container = document.getElementById('todo-list');
        if (!container) return;
        
        container.innerHTML = '';
        state.today.todos.forEach(todo => {
            const div = document.createElement('div');
            div.className = `todo-item ${todo.completed ? 'completed' : ''}`;
            div.innerHTML = `
                <input type="checkbox" ${todo.completed ? 'checked' : ''}>
                <span class="task-text">${todo.text}</span>
                <button class="delete-task"><i class="fas fa-trash"></i></button>
            `;
            
            const checkbox = div.querySelector('input');
            checkbox.addEventListener('change', () => {
                todo.completed = checkbox.checked;
                div.className = `todo-item ${todo.completed ? 'completed' : ''}`;
                saveData();
                addActivity(todo.completed ? `Completed task: "${todo.text}"` : `Unchecked task: "${todo.text}"`, 
                           todo.completed ? 'check' : 'times');
            });
            
            const deleteBtn = div.querySelector('.delete-task');
            deleteBtn.addEventListener('click', () => {
                state.today.todos = state.today.todos.filter(t => t.id !== todo.id);
                renderTodos();
                addActivity(`Deleted task: "${todo.text}"`, 'trash');
                saveData();
            });
            
            container.appendChild(div);
        });
    }

    // Camera Functions
    let cameraStream = null;

    async function toggleCamera() {
        const button = document.getElementById('toggle-camera');
        const feed = document.getElementById('camera-feed');
        const captureBtn = document.getElementById('capture-btn');
        
        if (!cameraStream) {
            try {
                cameraStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'user' } 
                });
                feed.srcObject = cameraStream;
                feed.classList.add('active');
                button.innerHTML = '<i class="fas fa-video-slash"></i> DISABLE CAMERA';
                captureBtn.disabled = false;
                addActivity('Camera enabled', 'camera');
            } catch (error) {
                showMessage('Camera error: ' + error.message, 'error');
            }
        } else {
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
        
        const canvas = document.getElementById('camera-canvas');
        const feed = document.getElementById('camera-feed');
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
        
        const container = document.getElementById('captures-grid');
        if (container) {
            container.appendChild(img);
        }
        
        addActivity('Image captured', 'camera');
        saveData();
    }

    function renderCaptures() {
        const container = document.getElementById('captures-grid');
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
        if (state.today.activities.length > 10) {
            state.today.activities = state.today.activities.slice(0, 10);
        }
        
        renderActivities();
    }

    function renderActivities() {
        const container = document.getElementById('activity-list');
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
        if (!state.user) return;
        
        const todayKey = new Date().toDateString();
        const dataToSave = {
            today: state.today,
            studyTime: state.studyTime,
            lastSaved: new Date().toISOString()
        };
        
        // Save to localStorage
        localStorage.setItem(`studyData_${state.user.uid}_${todayKey}`, JSON.stringify(dataToSave));
        
        // Save to Firebase if online
        if (navigator.onLine && state.user) {
            window.firebaseDb.collection('users').doc(state.user.uid)
                .collection('days').doc(todayKey).set(dataToSave, { merge: true })
                .catch(error => console.error('Auto-save error:', error));
        }
    }

    // End Day Functions
    async function endDay() {
        pauseTimer();
        
        // Calculate statistics
        const completedTargets = state.today.targets.filter(t => t.completed).length;
        const totalTargets = state.today.targets.length;
        const completedTodos = state.today.todos.filter(t => t.completed).length;
        const totalTodos = state.today.todos.length;
        
        let maxSittingSeconds = 0;
        state.studyTime.sessions.forEach(session => {
            if (session.duration > maxSittingSeconds) {
                maxSittingSeconds = session.duration;
            }
        });
        
        const targetScore = totalTargets > 0 ? (completedTargets / totalTargets) * 40 : 0;
        const timeScore = Math.min((state.studyTime.totalSeconds / (4 * 3600)) * 40, 40);
        const taskScore = totalTodos > 0 ? (completedTodos / totalTodos) * 20 : 0;
        const productivityScore = Math.round(targetScore + timeScore + taskScore);
        
        // Update report display
        document.getElementById('report-date').textContent = new Date().toLocaleDateString();
        document.getElementById('report-user-name').textContent = state.user?.displayName || 'Student';
        document.getElementById('targets-completed').textContent = `${completedTargets}/${totalTargets}`;
        document.getElementById('total-study-hours').textContent = document.getElementById('total-hours').textContent;
        
        const maxHours = Math.floor(maxSittingSeconds / 3600);
        const maxMinutes = Math.floor((maxSittingSeconds % 3600) / 60);
        document.getElementById('max-sitting-hours').textContent = 
            `${maxHours.toString().padStart(2, '0')}:${maxMinutes.toString().padStart(2, '0')}`;
        
        document.getElementById('tasks-completed').textContent = `${completedTodos}/${totalTodos}`;
        document.getElementById('productivity-score').textContent = `${productivityScore}%`;
        document.getElementById('sessions-completed').textContent = state.studyTime.sessions.length;
        
        const targetsProgress = totalTargets > 0 ? (completedTargets / totalTargets) * 100 : 0;
        const tasksProgress = totalTodos > 0 ? (completedTodos / totalTodos) * 100 : 0;
        
        document.getElementById('targets-bar').style.width = `${targetsProgress}%`;
        document.getElementById('tasks-bar').style.width = `${tasksProgress}%`;
        
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
        document.getElementById('summary-text').textContent = summary;
        
        // Save final data
        if (state.user) {
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
                dayEnded: true,
                endTime: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            try {
                await window.firebaseDb.collection('users').doc(state.user.uid)
                    .collection('days').doc(todayKey).set(finalData, { merge: true });
            } catch (error) {
                console.error('Error saving final data:', error);
            }
        }
        
        showScreen('results');
        addActivity('Ended study day', 'flag-checkered');
    }

    // Fixed: Start New Day Function
    function startNewDay() {
        // Reset only study-related data
        state.timer = { seconds: 0, running: false, interval: null };
        state.studyTime = { totalSeconds: 0, sessions: [] };
        
        // Keep targets and todos (as requested)
        state.today.captures = [];
        state.today.activities = [];
        state.today.setupCompleted = false;
        
        // Clear UI elements
        document.getElementById('timer-display').textContent = '00:00:00';
        document.getElementById('total-hours').textContent = '00:00';
        document.getElementById('progress-bar').style.width = '0%';
        document.getElementById('progress-text').textContent = '0% of daily goal';
        
        const capturesGrid = document.getElementById('captures-grid');
        if (capturesGrid) capturesGrid.innerHTML = '';
        
        const activityList = document.getElementById('activity-list');
        if (activityList) activityList.innerHTML = '';
        
        // Save reset state
        saveData();
        
        // Show setup screen
        showScreen('setup');
        addActivity('Started new day', 'sun');
    }

    // Save Report as Image
    function saveReportAsImage() {
        const reportCard = document.getElementById('report-card');
        if (typeof html2canvas === 'undefined') {
            showMessage('html2canvas library not loaded. Please check script includes.', 'error');
            return;
        }
        
        html2canvas(reportCard, {
            backgroundColor: '#f8f9ff',
            scale: 2,
            useCORS: true
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `Study-Report-${new Date().toISOString().split('T')[0]}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            addActivity('Report saved as image', 'download');
            showMessage('Report saved as image!', 'success');
        }).catch(error => {
            console.error('Error saving report:', error);
            showMessage('Error saving report: ' + error.message, 'error');
        });
    }

    // Event Listeners Setup
    function setupEventListeners() {
        // Auth
        document.getElementById('login-btn')?.addEventListener('click', handleLogin);
        document.getElementById('register-btn')?.addEventListener('click', handleRegister);
        document.getElementById('google-login-btn')?.addEventListener('click', handleGoogleLogin);
        document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
        
        // Auth tabs
        document.getElementById('login-tab')?.addEventListener('click', () => {
            document.getElementById('login-tab').classList.add('active');
            document.getElementById('register-tab').classList.remove('active');
            document.getElementById('login-form').classList.add('active');
            document.getElementById('register-form').classList.remove('active');
        });
        
        document.getElementById('register-tab')?.addEventListener('click', () => {
            document.getElementById('register-tab').classList.add('active');
            document.getElementById('login-tab').classList.remove('active');
            document.getElementById('register-form').classList.add('active');
            document.getElementById('login-form').classList.remove('active');
        });
        
        // Setup
        document.getElementById('add-target')?.addEventListener('click', addTarget);
        document.getElementById('target-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTarget();
        });
        document.getElementById('start-study')?.addEventListener('click', completeSetup);
        
        // Timer
        document.getElementById('start-timer')?.addEventListener('click', startTimer);
        document.getElementById('pause-timer')?.addEventListener('click', pauseTimer);
        document.getElementById('reset-timer')?.addEventListener('click', resetTimer);
        
        // Camera
        document.getElementById('toggle-camera')?.addEventListener('click', toggleCamera);
        document.getElementById('capture-btn')?.addEventListener('click', captureImage);
        
        // Todos
        document.getElementById('add-todo')?.addEventListener('click', addTodo);
        document.getElementById('todo-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTodo();
        });
        
        // End Day
        document.getElementById('end-day-btn')?.addEventListener('click', endDay);
        
        // Results
        document.getElementById('save-report')?.addEventListener('click', saveReportAsImage);
        document.getElementById('new-day-btn')?.addEventListener('click', startNewDay);
        document.getElementById('back-dashboard')?.addEventListener('click', () => showScreen('dashboard'));
        
        // Music
        document.getElementById('play-music')?.addEventListener('click', () => {
            const music = document.getElementById('background-music');
            const select = document.getElementById('music-select');
            if (select.value) {
                music.src = select.value;
                music.play().catch(e => console.log('Music play error:', e));
            }
        });
        
        document.getElementById('pause-music')?.addEventListener('click', () => {
            document.getElementById('background-music').pause();
        });
        
        document.getElementById('volume')?.addEventListener('input', (e) => {
            document.getElementById('background-music').volume = e.target.value / 100;
        });
        
        // Auto-save
        setInterval(saveData, 30000);
        window.addEventListener('beforeunload', saveData);
    }

    // Initialize everything
    setupEventListeners();
    showScreen('auth');
    
    // Update next session timer
    function updateNextSession() {
        const now = new Date();
        const nextHour = new Date();
        nextHour.setHours(now.getHours() + 1, 0, 0, 0);
        
        const diff = nextHour - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        const countdownEl = document.getElementById('next-session-countdown');
        if (countdownEl) {
            countdownEl.textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    // Update next session every second
    setInterval(updateNextSession, 1000);
    updateNextSession();
});
