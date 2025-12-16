document.addEventListener('DOMContentLoaded', function() {
    // State Management
    let state = {
        timer: {
            seconds: 0,
            isRunning: false,
            interval: null
        },
        studyTime: {
            totalSeconds: 0,
            sessions: []
        },
        today: {
            targets: [],
            todos: [],
            captures: [],
            activities: [],
            setupCompleted: false
        },
        user: null,
        currentSession: null
    };

    // DOM Elements
    const screens = {
        auth: document.getElementById('auth-screen'),
        setup: document.getElementById('setup-screen'),
        dashboard: document.getElementById('dashboard'),
        results: document.getElementById('results-screen')
    };

    // Authentication Elements
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const googleLoginBtn = document.getElementById('google-login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // Setup Elements
    const targetInput = document.getElementById('target-input');
    const addTargetBtn = document.getElementById('add-target');
    const targetsList = document.getElementById('targets-list');
    const startStudyBtn = document.getElementById('start-study');

    // Dashboard Elements
    const timerDisplay = document.getElementById('timer-display');
    const startTimerBtn = document.getElementById('start-timer');
    const pauseTimerBtn = document.getElementById('pause-timer');
    const resetTimerBtn = document.getElementById('reset-timer');
    const totalHoursDisplay = document.getElementById('total-hours');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const currentDateEl = document.getElementById('current-date');
    const endDayBtn = document.getElementById('end-day-btn');

    // Camera Elements
    const cameraFeed = document.getElementById('camera-feed');
    const toggleCameraBtn = document.getElementById('toggle-camera');
    const captureBtn = document.getElementById('capture-btn');
    const capturesGrid = document.getElementById('captures-grid');

    // Todo Elements
    const todoInput = document.getElementById('todo-input');
    const addTodoBtn = document.getElementById('add-todo');
    const todoList = document.getElementById('todo-list');

    // Next Session Elements
    const nextSessionTime = document.getElementById('next-session-time');
    const nextSessionTopic = document.getElementById('next-session-topic');
    const nextSessionCountdown = document.getElementById('next-session-countdown');

    // Activity Elements
    const activityList = document.getElementById('activity-list');

    // Results Elements
    const saveReportBtn = document.getElementById('save-report');
    const newDayBtn = document.getElementById('new-day-btn');
    const backDashboardBtn = document.getElementById('back-dashboard');

    // Music Elements
    const musicSelect = document.getElementById('music-select');
    const playMusicBtn = document.getElementById('play-music');
    const pauseMusicBtn = document.getElementById('pause-music');
    const volumeSlider = document.getElementById('volume');
    const backgroundMusic = document.getElementById('background-music');

    // Initialize App
    initApp();

    function initApp() {
        // Set current date
        const now = new Date();
        currentDateEl.textContent = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Load saved data
        loadState();

        // Setup Firebase auth listener
        if (window.firebaseApp) {
            window.firebaseApp.auth.onAuthStateChanged(handleAuthStateChange);
        }

        // Setup event listeners
        setupEventListeners();

        // Update UI
        updateTimerDisplay();
        updateTotalStudyTime();
        renderTargets();
        renderTodos();
        renderActivities();
        updateNextSession();
    }

    function setupEventListeners() {
        // Auth Tabs
        loginTab.addEventListener('click', () => switchAuthTab('login'));
        registerTab.addEventListener('click', () => switchAuthTab('register'));

        // Auth Buttons
        loginBtn.addEventListener('click', handleLogin);
        registerBtn.addEventListener('click', handleRegister);
        if (googleLoginBtn) googleLoginBtn.addEventListener('click', handleGoogleLogin);
        if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

        // Setup
        addTargetBtn.addEventListener('click', addTargetFromInput);
        targetInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTargetFromInput();
        });
        startStudyBtn.addEventListener('click', completeSetup);

        // Timer
        startTimerBtn.addEventListener('click', startTimer);
        pauseTimerBtn.addEventListener('click', pauseTimer);
        resetTimerBtn.addEventListener('click', resetTimer);

        // Camera
        if (toggleCameraBtn) toggleCameraBtn.addEventListener('click', toggleCamera);
        if (captureBtn) captureBtn.addEventListener('click', captureImage);

        // Todos
        addTodoBtn.addEventListener('click', addTodoFromInput);
        todoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTodoFromInput();
        });

        // End Day
        if (endDayBtn) endDayBtn.addEventListener('click', endDay);

        // Results
        if (saveReportBtn) saveReportBtn.addEventListener('click', saveReportAsImage);
        if (newDayBtn) newDayBtn.addEventListener('click', startNewDay);
        if (backDashboardBtn) backDashboardBtn.addEventListener('click', () => showScreen('dashboard'));

        // Music
        if (playMusicBtn) playMusicBtn.addEventListener('click', playBackgroundMusic);
        if (pauseMusicBtn) pauseMusicBtn.addEventListener('click', pauseBackgroundMusic);
        if (volumeSlider) volumeSlider.addEventListener('input', updateMusicVolume);

        // Auto-save
        setInterval(saveState, 30000);
        window.addEventListener('beforeunload', saveState);
    }

    // Auth Functions
    function switchAuthTab(tab) {
        if (tab === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.classList.add('active');
            registerForm.classList.remove('active');
        } else {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            registerForm.classList.add('active');
            loginForm.classList.remove('active');
        }
    }

    async function handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            alert('Please enter email and password');
            return;
        }

        try {
            const userCredential = await window.firebaseApp.auth.signInWithEmailAndPassword(email, password);
            console.log('Logged in:', userCredential.user);
            state.user = userCredential.user;
            checkUserSetup();
        } catch (error) {
            alert('Login failed: ' + error.message);
        }
    }

    async function handleRegister() {
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        if (!name || !email || !password) {
            alert('Please fill all fields');
            return;
        }

        if (password.length < 6) {
            alert('Password must be at least 6 characters');
            return;
        }

        try {
            const userCredential = await window.firebaseApp.auth.createUserWithEmailAndPassword(email, password);
            await userCredential.user.updateProfile({ displayName: name });
            
            // Create user document
            await window.firebaseApp.db.collection('users').doc(userCredential.user.uid).set({
                name: name,
                email: email,
                createdAt: new Date(),
                totalStudyHours: 0,
                totalDays: 0
            });

            state.user = userCredential.user;
            showScreen('setup');
        } catch (error) {
            alert('Registration failed: ' + error.message);
        }
    }

    async function handleGoogleLogin() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await window.firebaseApp.auth.signInWithPopup(provider);
            state.user = result.user;
            
            // Check if user exists
            const userDoc = await window.firebaseApp.db.collection('users').doc(result.user.uid).get();
            if (!userDoc.exists) {
                await window.firebaseApp.db.collection('users').doc(result.user.uid).set({
                    name: result.user.displayName,
                    email: result.user.email,
                    createdAt: new Date(),
                    totalStudyHours: 0,
                    totalDays: 0
                });
            }
            
            checkUserSetup();
        } catch (error) {
            alert('Google login failed: ' + error.message);
        }
    }

    async function handleLogout() {
        try {
            await window.firebaseApp.auth.signOut();
            state.user = null;
            showScreen('auth');
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    function handleAuthStateChange(user) {
        if (user) {
            state.user = user;
            checkUserSetup();
        } else {
            state.user = null;
            showScreen('auth');
        }
    }

    async function checkUserSetup() {
        if (!state.user) return;

        const todayKey = new Date().toDateString();
        
        // Check localStorage first
        const savedState = localStorage.getItem(`studyState_${state.user.uid}`);
        if (savedState) {
            const parsed = JSON.parse(savedState);
            if (parsed.lastSaveDate === todayKey && parsed.today.setupCompleted) {
                // Load from localStorage
                state.today = parsed.today;
                state.studyTime = parsed.studyTime;
                showScreen('dashboard');
                return;
            }
        }

        // Check Firebase
        try {
            const userDoc = await window.firebaseApp.db.collection('users').doc(state.user.uid)
                .collection('days').doc(todayKey).get();
            
            if (userDoc.exists && userDoc.data().setupCompleted) {
                // Load from Firebase
                const data = userDoc.data();
                state.today = data.today || state.today;
                state.studyTime = data.studyTime || state.studyTime;
                showScreen('dashboard');
            } else {
                showScreen('setup');
            }
        } catch (error) {
            console.error('Error checking setup:', error);
            showScreen('setup');
        }
    }

    // Screen Management
    function showScreen(screenName) {
        Object.keys(screens).forEach(key => {
            screens[key].classList.remove('active');
        });
        screens[screenName].classList.add('active');
    }

    // Setup Functions
    function addTargetFromInput() {
        const text = targetInput.value.trim();
        if (!text) return;

        const target = {
            id: Date.now(),
            text: text,
            completed: false,
            createdAt: new Date()
        };

        state.today.targets.push(target);
        targetInput.value = '';
        renderTargets();
        addActivity(`Added target: "${text}"`, 'bullseye');
        saveState();
    }

    function renderTargets() {
        targetsList.innerHTML = '';
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
                saveState();
                addActivity(target.completed ? `Completed target: "${target.text}"` : `Unchecked target: "${target.text}"`, 
                           target.completed ? 'check-circle' : 'times-circle');
            });
            
            targetsList.appendChild(div);
        });
    }

    async function completeSetup() {
        // Get schedule data
        const timeSlots = document.querySelectorAll('.time-slot');
        const schedule = [];
        
        timeSlots.forEach(slot => {
            const time = slot.querySelector('.time').textContent;
            const topic = slot.querySelector('input').value.trim();
            if (topic) {
                schedule.push({ time, topic });
            }
        });

        // Mark setup as completed
        state.today.setupCompleted = true;
        
        // Save to Firebase
        if (state.user) {
            const todayKey = new Date().toDateString();
            try {
                await window.firebaseApp.db.collection('users').doc(state.user.uid)
                    .collection('days').doc(todayKey).set({
                        today: state.today,
                        studyTime: state.studyTime,
                        setupCompleted: true,
                        lastUpdated: new Date()
                    }, { merge: true });
            } catch (error) {
                console.error('Error saving setup:', error);
            }
        }

        // Save locally
        saveState();
        
        // Show dashboard
        showScreen('dashboard');
        addActivity('Started study session', 'play-circle');
        
        // Set first session from schedule
        if (schedule.length > 0) {
            nextSessionTopic.textContent = schedule[0].topic;
        }
    }

    // Timer Functions
    function startTimer() {
        if (state.timer.isRunning) return;
        
        state.timer.isRunning = true;
        state.timer.startTime = new Date();
        
        state.timer.interval = setInterval(() => {
            state.timer.seconds++;
            state.studyTime.totalSeconds++;
            updateTimerDisplay();
            updateTotalStudyTime();
            
            // Auto-save every minute
            if (state.timer.seconds % 60 === 0) {
                saveState();
            }
        }, 1000);
        
        startTimerBtn.disabled = true;
        pauseTimerBtn.disabled = false;
        addActivity('Timer started', 'play');
    }

    function pauseTimer() {
        if (!state.timer.isRunning) return;
        
        clearInterval(state.timer.interval);
        state.timer.isRunning = false;
        
        // Record session
        if (state.timer.startTime) {
            const session = {
                start: state.timer.startTime,
                end: new Date(),
                duration: state.timer.seconds
            };
            state.studyTime.sessions.push(session);
            state.currentSession = null;
            state.timer.startTime = null;
        }
        
        startTimerBtn.disabled = false;
        pauseTimerBtn.disabled = true;
        addActivity('Timer paused', 'pause');
        saveState();
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
        
        timerDisplay.textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function updateTotalStudyTime() {
        const hours = Math.floor(state.studyTime.totalSeconds / 3600);
        const minutes = Math.floor((state.studyTime.totalSeconds % 3600) / 60);
        
        totalHoursDisplay.textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        // Update progress (8-hour goal)
        const progress = Math.min((state.studyTime.totalSeconds / (8 * 3600)) * 100, 100);
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}% of daily goal`;
    }

    // Camera Functions
    let cameraStream = null;

    async function toggleCamera() {
        if (!cameraStream) {
            try {
                cameraStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'user' } 
                });
                cameraFeed.srcObject = cameraStream;
                cameraFeed.classList.add('active');
                toggleCameraBtn.innerHTML = '<i class="fas fa-video-slash"></i> DISABLE CAMERA';
                captureBtn.disabled = false;
                addActivity('Camera enabled', 'camera');
            } catch (error) {
                alert('Camera error: ' + error.message);
            }
        } else {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
            cameraFeed.srcObject = null;
            cameraFeed.classList.remove('active');
            toggleCameraBtn.innerHTML = '<i class="fas fa-video"></i> ENABLE CAMERA';
            captureBtn.disabled = true;
            addActivity('Camera disabled', 'video-slash');
        }
    }

    function captureImage() {
        if (!cameraStream) return;
        
        const canvas = document.getElementById('camera-canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = cameraFeed.videoWidth;
        canvas.height = cameraFeed.videoHeight;
        context.drawImage(cameraFeed, 0, 0);
        
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
        img.onclick = () => {
            const win = window.open();
            win.document.write(`<img src="${imageData}" style="max-width:100%;">`);
        };
        
        capturesGrid.appendChild(img);
        addActivity('Image captured', 'camera');
        saveState();
    }

    // Todo Functions
    function addTodoFromInput() {
        const text = todoInput.value.trim();
        if (!text) return;

        const todo = {
            id: Date.now(),
            text: text,
            completed: false,
            createdAt: new Date()
        };

        state.today.todos.push(todo);
        todoInput.value = '';
        renderTodos();
        addActivity(`Added task: "${text}"`, 'tasks');
        saveState();
    }

    function renderTodos() {
        todoList.innerHTML = '';
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
                saveState();
                addActivity(todo.completed ? `Completed task: "${todo.text}"` : `Unchecked task: "${todo.text}"`, 
                           todo.completed ? 'check' : 'times');
            });
            
            const deleteBtn = div.querySelector('.delete-task');
            deleteBtn.addEventListener('click', () => {
                state.today.todos = state.today.todos.filter(t => t.id !== todo.id);
                renderTodos();
                addActivity(`Deleted task: "${todo.text}"`, 'trash');
                saveState();
            });
            
            todoList.appendChild(div);
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
        activityList.innerHTML = '';
        state.today.activities.forEach(activity => {
            const div = document.createElement('div');
            div.className = 'activity-item';
            div.innerHTML = `
                <i class="fas fa-${activity.icon}"></i>
                <span>${activity.text}</span>
                <span class="activity-time">
                    ${activity.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            `;
            activityList.appendChild(div);
        });
    }

    // Next Session Functions
    function updateNextSession() {
        // Simplified next session logic
        const now = new Date();
        const nextHour = now.getHours() + 1;
        const formattedTime = nextHour > 12 ? `${nextHour - 12}:00 PM` : `${nextHour}:00 AM`;
        
        nextSessionTime.textContent = formattedTime;
        
        // Update countdown every second
        setInterval(updateCountdown, 1000);
    }

    function updateCountdown() {
        const now = new Date();
        const nextHour = new Date();
        nextHour.setHours(now.getHours() + 1, 0, 0, 0);
        
        const diff = nextHour - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        nextSessionCountdown.textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // End Day Functions
    async function endDay() {
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
        document.getElementById('report-date').textContent = new Date().toLocaleDateString();
        document.getElementById('report-user-name').textContent = state.user?.displayName || 'Student';
        document.getElementById('targets-completed').textContent = `${completedTargets}/${totalTargets}`;
        document.getElementById('total-study-hours').textContent = totalHoursDisplay.textContent;
        
        const maxHours = Math.floor(maxSittingSeconds / 3600);
        const maxMinutes = Math.floor((maxSittingSeconds % 3600) / 60);
        document.getElementById('max-sitting-hours').textContent = 
            `${maxHours.toString().padStart(2, '0')}:${maxMinutes.toString().padStart(2, '0')}`;
        
        document.getElementById('tasks-completed').textContent = `${completedTodos}/${totalTodos}`;
        document.getElementById('productivity-score').textContent = `${productivityScore}%`;
        document.getElementById('sessions-completed').textContent = state.studyTime.sessions.length;
        
        // Update progress bars
        const targetsProgress = totalTargets > 0 ? (completedTargets / totalTargets) * 100 : 0;
        const tasksProgress = totalTodos > 0 ? (completedTodos / totalTodos) * 100 : 0;
        
        document.getElementById('targets-bar').style.width = `${targetsProgress}%`;
        document.getElementById('tasks-bar').style.width = `${tasksProgress}%`;
        
        // Update summary
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
        await saveFinalData(completedTargets, totalTargets, completedTodos, totalTodos, 
                          state.studyTime.totalSeconds, maxSittingSeconds, productivityScore);
        
        showScreen('results');
        addActivity('Ended study day', 'flag-checkered');
    }

    async function saveFinalData(completedTargets, totalTargets, completedTodos, totalTodos, 
                               totalStudySeconds, maxSittingSeconds, productivityScore) {
        if (!state.user) return;

        const todayKey = new Date().toDateString();
        const finalData = {
            today: state.today,
            studyTime: state.studyTime,
            completedTargets,
            totalTargets,
            completedTodos,
            totalTodos,
            totalStudySeconds,
            maxSittingSeconds,
            productivityScore,
            dayEnded: true,
            endTime: new Date()
        };

        try {
            // Save to Firebase
            await window.firebaseApp.db.collection('users').doc(state.user.uid)
                .collection('days').doc(todayKey).set(finalData, { merge: true });

            // Update user totals
            const userRef = window.firebaseApp.db.collection('users').doc(state.user.uid);
            const userDoc = await userRef.get();
            const currentData = userDoc.data() || {};

            await userRef.update({
                totalStudyHours: (currentData.totalStudyHours || 0) + (totalStudySeconds / 3600),
                totalDays: (currentData.totalDays || 0) + 1,
                lastActive: new Date()
            });
        } catch (error) {
            console.error('Error saving final data:', error);
        }
    }

    // New Day Function - FIXED
    function startNewDay() {
        // Reset state for new day
        state.timer = {
            seconds: 0,
            isRunning: false,
            interval: null,
            startTime: null
        };
        
        // Keep targets and todos from previous day
        // Reset only study time and sessions
        state.studyTime = {
            totalSeconds: 0,
            sessions: []
        };
        
        // Reset camera captures and activities
        state.today.captures = [];
        state.today.activities = [];
        state.today.setupCompleted = false;
        
        // Clear UI
        timerDisplay.textContent = '00:00:00';
        totalHoursDisplay.textContent = '00:00';
        progressBar.style.width = '0%';
        progressText.textContent = '0% of daily goal';
        capturesGrid.innerHTML = '';
        
        // Save state
        saveState();
        
        // Show setup screen
        showScreen('setup');
        addActivity('Started new day', 'sun');
    }

    // Save Report as Image
    function saveReportAsImage() {
        const reportCard = document.getElementById('report-card');
        
        html2canvas(reportCard, {
            backgroundColor: '#f8f9ff',
            scale: 2
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `Study-Report-${new Date().toISOString().split('T')[0]}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            addActivity('Report saved as image', 'download');
        });
    }

    // Music Functions
    function playBackgroundMusic() {
        const selectedMusic = musicSelect.value;
        if (selectedMusic) {
            backgroundMusic.src = selectedMusic;
            backgroundMusic.play().catch(e => {
                console.log('Autoplay prevented:', e);
            });
        }
    }

    function pauseBackgroundMusic() {
        backgroundMusic.pause();
    }

    function updateMusicVolume() {
        backgroundMusic.volume = volumeSlider.value / 100;
    }

    // Data Persistence
    function saveState() {
        if (!state.user) return;
        
        const stateToSave = {
            ...state,
            lastSaveDate: new Date().toDateString(),
            lastSaveTime: new Date()
        };
        
        // Save to localStorage
        localStorage.setItem(`studyState_${state.user.uid}`, JSON.stringify(stateToSave));
        
        // Save to Firebase if online
        if (state.user && navigator.onLine) {
            const todayKey = new Date().toDateString();
            try {
                window.firebaseApp.db.collection('users').doc(state.user.uid)
                    .collection('days').doc(todayKey).set({
                        today: state.today,
                        studyTime: state.studyTime,
                        lastUpdated: new Date()
                    }, { merge: true });
            } catch (error) {
                console.error('Auto-save error:', error);
            }
        }
    }

    function loadState() {
        if (!state.user) return;
        
        const saved = localStorage.getItem(`studyState_${state.user.uid}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const todayKey = new Date().toDateString();
                
                // Only load if it's from today
                if (parsed.lastSaveDate === todayKey) {
                    state.today = parsed.today || state.today;
                    state.studyTime = parsed.studyTime || state.studyTime;
                    state.timer = parsed.timer || state.timer;
                    
                    // Restore timer if it was running
                    if (state.timer.isRunning) {
                        const elapsed = Math.floor((new Date() - new Date(parsed.lastSaveTime)) / 1000);
                        state.timer.seconds += elapsed;
                        startTimer();
                    }
                }
            } catch (error) {
                console.error('Error loading state:', error);
            }
        }
    }

    // Make functions available globally
    window.startNewDay = startNewDay;
    window.showScreen = showScreen;
});
