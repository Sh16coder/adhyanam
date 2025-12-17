document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    
    // Initialize state
    let state = {
        user: null,
        timer: { 
            seconds: 0, 
            running: false, 
            interval: null,
            startTime: null,
            accumulatedSeconds: 0  // Track seconds already added to total
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
        }
    };

    // DOM Elements
    const screens = {
        auth: document.getElementById('auth-screen'),
        setup: document.getElementById('setup-screen'),
        dashboard: document.getElementById('dashboard-screen'),
        results: document.getElementById('results-screen')
    };

    // Show screen function
    function showScreen(screenName) {
        Object.values(screens).forEach(screen => {
            if (screen && screen.classList) {
                screen.classList.remove('active');
            }
        });
        
        const targetScreen = screens[screenName];
        if (targetScreen && targetScreen.classList) {
            targetScreen.classList.add('active');
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

    // ========== TIMER FUNCTIONS - FIXED ==========
    
    function startTimer() {
        if (state.timer.running) return;
        
        console.log('Starting timer...');
        state.timer.running = true;
        state.timer.startTime = new Date();
        
        state.timer.interval = setInterval(() => {
            // Increment timer seconds
            state.timer.seconds++;
            
            // Add to total study hours EVERY SECOND
            state.studyTime.totalSeconds++;
            
            // Update displays
            updateTimerDisplay();
            updateTotalStudyTime();
            
            // Auto-save every minute
            if (state.timer.seconds % 60 === 0) {
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
        pauseTimer(); // First pause to record session
        
        // DON'T reset total study hours - only reset the timer display
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

    // ========== ACTIVITY FUNCTIONS ==========
    
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

    // ========== DATA MANAGEMENT ==========
    
    function saveData() {
        console.log('Saving data...');
        
        const todayKey = new Date().toDateString();
        const dataToSave = {
            today: state.today,
            studyTime: state.studyTime,
            timer: state.timer,
            lastSavedDate: todayKey,
            lastSaved: new Date().toISOString()
        };
        
        // Save to localStorage
        localStorage.setItem('studyData_local', JSON.stringify(dataToSave));
        
        // Save to Firebase if available
        if (window.firebaseDb && state.user && navigator.onLine) {
            window.firebaseDb.collection('users').doc(state.user.uid)
                .collection('days').doc(todayKey).set(dataToSave, { merge: true })
                .catch(error => console.error('Firebase save error:', error));
        }
    }

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
        
        // Update displays
        updateTimerDisplay();
        updateTotalStudyTime();
        
        // Restore timer state if it was running
        if (state.timer.running) {
            // Calculate elapsed time since last save
            const lastSaved = state.lastSaved ? new Date(state.lastSaved) : new Date();
            const now = new Date();
            const elapsedSeconds = Math.floor((now - lastSaved) / 1000);
            
            // Add elapsed time to timer and total
            state.timer.seconds += elapsedSeconds;
            state.studyTime.totalSeconds += elapsedSeconds;
            
            // Restart timer
            startTimer();
        }
    }

    // ========== TARGET FUNCTIONS ==========
    
    function addTarget() {
        const input = document.getElementById('targetInput');
        if (!input) return;
        
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

    // ========== TODO FUNCTIONS ==========
    
    function addTodo() {
        const input = document.getElementById('todoInput');
        if (!input) return;
        
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

    // ========== SETUP COMPLETION ==========
    
    function completeSetup() {
        console.log('Completing setup...');
        state.today.setupCompleted = true;
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

    // ========== END DAY & NEW DAY ==========
    
    async function endDay() {
        console.log('Ending day...');
        pauseTimer(); // Make sure timer is stopped
        
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
        if (totalStudyHours) {
            const hours = Math.floor(state.studyTime.totalSeconds / 3600);
            const minutes = Math.floor((state.studyTime.totalSeconds % 3600) / 60);
            totalStudyHours.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        
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
        
        // Show results screen
        showScreen('results');
        addActivity('Ended study day', 'flag-checkered');
    }

    // FIXED: Start New Day Function
    function startNewDay() {
        console.log('Starting new day...');
        
        // RESET TIMER BUT KEEP TOTAL STUDY HOURS
        // Total study hours should persist for the report
        
        // Reset timer state
        state.timer = { 
            seconds: 0, 
            running: false, 
            interval: null,
            startTime: null,
            accumulatedSeconds: 0
        };
        
        // DO NOT reset total study hours - they should show in the report
        
        // Reset sessions for new day
        state.studyTime.sessions = [];
        
        // Keep targets and todos (as requested)
        // Only reset captures and activities
        state.today.captures = [];
        state.today.activities = [];
        state.today.setupCompleted = false;
        
        // Clear UI elements
        const timerDisplay = document.getElementById('timerDisplay');
        const capturesGrid = document.getElementById('capturesGrid');
        const activityList = document.getElementById('activityList');
        
        if (timerDisplay) timerDisplay.textContent = '00:00:00';
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

    // ========== EVENT LISTENERS ==========
    
    function setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Timer buttons
        const startTimerBtn = document.getElementById('startTimerBtn');
        const pauseTimerBtn = document.getElementById('pauseTimerBtn');
        const resetTimerBtn = document.getElementById('resetTimerBtn');
        
        if (startTimerBtn) startTimerBtn.addEventListener('click', startTimer);
        if (pauseTimerBtn) pauseTimerBtn.addEventListener('click', pauseTimer);
        if (resetTimerBtn) resetTimerBtn.addEventListener('click', resetTimer);
        
        // Setup buttons
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
        
        // Todo buttons
        const addTodoBtn = document.getElementById('addTodoBtn');
        const todoInput = document.getElementById('todoInput');
        
        if (addTodoBtn) addTodoBtn.addEventListener('click', addTodo);
        if (todoInput) {
            todoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addTodo();
            });
        }
        
        // End Day and New Day buttons
        const endDayBtn = document.getElementById('endDayBtn');
        const newDayBtn = document.getElementById('newDayBtn');
        const backDashboardBtn = document.getElementById('backDashboardBtn');
        
        if (endDayBtn) endDayBtn.addEventListener('click', endDay);
        if (newDayBtn) newDayBtn.addEventListener('click', startNewDay);
        if (backDashboardBtn) backDashboardBtn.addEventListener('click', () => showScreen('dashboard'));
        
        // Camera buttons
        const toggleCameraBtn = document.getElementById('toggleCameraBtn');
        const captureBtn = document.getElementById('captureBtn');
        
        if (toggleCameraBtn) toggleCameraBtn.addEventListener('click', toggleCamera);
        if (captureBtn) captureBtn.addEventListener('click', captureImage);
        
        // Auth buttons (simplified)
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        
        if (loginBtn) loginBtn.addEventListener('click', () => {
            // Simulate login for demo
            state.user = { displayName: 'Demo User' };
            showScreen('setup');
        });
        
        if (registerBtn) registerBtn.addEventListener('click', () => {
            // Simulate register for demo
            state.user = { displayName: 'Demo User' };
            showScreen('setup');
        });
        
        // Auto-save
        setInterval(saveData, 30000);
        window.addEventListener('beforeunload', saveData);
    }

    // ========== CAMERA FUNCTIONS ==========
    
    let cameraStream = null;

    async function toggleCamera() {
        const button = document.getElementById('toggleCameraBtn');
        const feed = document.getElementById('cameraFeed');
        const captureBtn = document.getElementById('captureBtn');
        
        if (!button || !feed || !captureBtn) return;
        
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
                console.error('Camera error:', error);
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

    // ========== INITIALIZATION ==========
    
    function initApp() {
        console.log('Initializing application...');
        
        // Try to load saved data
        const savedData = localStorage.getItem('studyData_local');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                const todayKey = new Date().toDateString();
                
                if (data.lastSavedDate === todayKey) {
                    state.today = data.today || state.today;
                    state.studyTime = data.studyTime || state.studyTime;
                    state.timer = data.timer || state.timer;
                    state.lastSaved = data.lastSaved;
                    
                    loadSavedData();
                }
            } catch (e) {
                console.error('Error loading saved data:', e);
            }
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
        
        // Start on auth screen for demo
        showScreen('auth');
        
        // For demo purposes, auto-login after 1 second
        setTimeout(() => {
            // Check if we have saved data for today
            if (state.today.setupCompleted) {
                showScreen('dashboard');
            } else {
                showScreen('setup');
            }
        }, 1000);
        
        console.log('Application initialized successfully');
    }

    // Start the app
    initApp();
});