// Main Application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize variables
    let timerInterval;
    let seconds = 0;
    let isTimerRunning = false;
    let totalStudySeconds = 0;
    let todaysData = {
        targets: [],
        todos: [],
        sessions: [],
        captures: [],
        activities: []
    };
    let currentSession = {
        startTime: null,
        endTime: null,
        topic: '',
        duration: 0
    };
    
    // DOM Elements
    const startStudyBtn = document.getElementById('start-study-btn');
    const startTimerBtn = document.getElementById('start-timer-btn');
    const pauseTimerBtn = document.getElementById('pause-timer-btn');
    const resetTimerBtn = document.getElementById('reset-timer-btn');
    const timerDisplay = document.getElementById('timer-display');
    const totalHoursDisplay = document.getElementById('total-hours');
    const toggleCameraBtn = document.getElementById('toggle-camera-btn');
    const captureBtn = document.getElementById('capture-btn');
    const cameraFeed = document.getElementById('camera-feed');
    const cameraCanvas = document.getElementById('camera-canvas');
    const captureHistory = document.getElementById('capture-history');
    const addTargetBtn = document.getElementById('add-target-btn');
    const targetInput = document.getElementById('target-input');
    const targetsList = document.getElementById('targets-list');
    const todoInput = document.getElementById('todo-input');
    const addTodoBtn = document.getElementById('add-todo-btn');
    const todoList = document.getElementById('todo-list');
    const endDayBtn = document.getElementById('end-day-btn');
    const saveReportBtn = document.getElementById('save-report-btn');
    const newDayBtn = document.getElementById('new-day-btn');
    const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
    const musicSelect = document.getElementById('music-select');
    const playMusicBtn = document.getElementById('play-music-btn');
    const pauseMusicBtn = document.getElementById('pause-music-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const backgroundMusic = document.getElementById('background-music');
    const currentDateElement = document.getElementById('current-date');
    const activityList = document.getElementById('activity-list');
    
    // Initialize
    initApp();
    
    function initApp() {
        // Set current date
        const now = new Date();
        currentDateElement.textContent = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Load saved data from localStorage
        loadLocalData();
        
        // Initialize timer
        updateTimerDisplay();
        
        // Initialize next session timer
        updateNextSession();
        
        // Setup event listeners
        setupEventListeners();
    }
    
    function setupEventListeners() {
        // Timer controls
        startTimerBtn.addEventListener('click', startTimer);
        pauseTimerBtn.addEventListener('click', pauseTimer);
        resetTimerBtn.addEventListener('click', resetTimer);
        
        // Start study session
        startStudyBtn.addEventListener('click', startStudySession);
        
        // Camera controls
        toggleCameraBtn.addEventListener('click', toggleCamera);
        captureBtn.addEventListener('click', captureImage);
        
        // Targets
        addTargetBtn.addEventListener('click', addTarget);
        
        // Todos
        addTodoBtn.addEventListener('click', addTodo);
        todoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTodo();
        });
        
        // Music controls
        playMusicBtn.addEventListener('click', playMusic);
        pauseMusicBtn.addEventListener('click', pauseMusic);
        volumeSlider.addEventListener('input', updateVolume);
        musicSelect.addEventListener('change', changeMusic);
        
        // End day and report
        endDayBtn.addEventListener('click', endDay);
        saveReportBtn.addEventListener('click', saveReportAsImage);
        newDayBtn.addEventListener('click', startNewDay);
        backToDashboardBtn.addEventListener('click', () => {
            window.authModule.showDashboardPage();
        });
        
        // Save data before page unload
        window.addEventListener('beforeunload', saveLocalData);
        
        // Periodic auto-save
        setInterval(saveLocalData, 30000); // Save every 30 seconds
    }
    
    // Timer Functions
    function startTimer() {
        if (!isTimerRunning) {
            isTimerRunning = true;
            currentSession.startTime = new Date();
            
            // Update UI
            startTimerBtn.disabled = true;
            pauseTimerBtn.disabled = false;
            
            // Start interval
            timerInterval = setInterval(() => {
                seconds++;
                updateTimerDisplay();
                
                // Update total study time
                totalStudySeconds++;
                updateTotalStudyTime();
                
                // Save session data periodically
                if (seconds % 60 === 0) { // Every minute
                    saveSessionData();
                }
            }, 1000);
            
            // Add activity
            addActivity('Started timer', 'play');
        }
    }
    
    function pauseTimer() {
        if (isTimerRunning) {
            isTimerRunning = false;
            clearInterval(timerInterval);
            
            // Update UI
            startTimerBtn.disabled = false;
            pauseTimerBtn.disabled = true;
            
            // Record session
            if (currentSession.startTime) {
                currentSession.endTime = new Date();
                currentSession.duration = seconds;
                todaysData.sessions.push({...currentSession});
                saveSessionData();
                
                // Reset current session
                currentSession = {
                    startTime: null,
                    endTime: null,
                    topic: '',
                    duration: 0
                };
            }
            
            // Add activity
            addActivity('Paused timer', 'pause');
        }
    }
    
    function resetTimer() {
        pauseTimer();
        seconds = 0;
        updateTimerDisplay();
        
        // Add activity
        addActivity('Reset timer', 'redo');
    }
    
    function updateTimerDisplay() {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        
        timerDisplay.textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    function updateTotalStudyTime() {
        const hours = Math.floor(totalStudySeconds / 3600);
        const minutes = Math.floor((totalStudySeconds % 3600) / 60);
        
        totalHoursDisplay.textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        // Update progress bar (assuming 8-hour goal)
        const progress = Math.min((totalStudySeconds / (8 * 3600)) * 100, 100);
        const progressBar = document.getElementById('study-progress-bar');
        const progressText = document.getElementById('progress-text');
        
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}% of daily goal`;
    }
    
    // Camera Functions
    let stream = null;
    
    async function toggleCamera() {
        if (!stream) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' }
                });
                cameraFeed.srcObject = stream;
                cameraFeed.classList.add('active');
                toggleCameraBtn.innerHTML = '<i class="fas fa-video-slash"></i> Disable Camera';
                captureBtn.disabled = false;
                
                // Add activity
                addActivity('Camera enabled', 'camera');
            } catch (error) {
                alert('Error accessing camera: ' + error.message);
            }
        } else {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
            cameraFeed.srcObject = null;
            cameraFeed.classList.remove('active');
            toggleCameraBtn.innerHTML = '<i class="fas fa-video"></i> Enable Camera';
            captureBtn.disabled = true;
            
            // Add activity
            addActivity('Camera disabled', 'video-slash');
        }
    }
    
    function captureImage() {
        if (!stream) return;
        
        const context = cameraCanvas.getContext('2d');
        cameraCanvas.width = cameraFeed.videoWidth;
        cameraCanvas.height = cameraFeed.videoHeight;
        context.drawImage(cameraFeed, 0, 0);
        
        const imageData = cameraCanvas.toDataURL('image/png');
        
        // Add to capture history
        const img = document.createElement('img');
        img.src = imageData;
        img.className = 'capture-item';
        img.title = 'Captured at ' + new Date().toLocaleTimeString();
        captureHistory.appendChild(img);
        
        // Save to todaysData
        todaysData.captures.push({
            data: imageData,
            timestamp: new Date()
        });
        
        // Add activity
        addActivity('Captured image', 'camera');
        
        // Auto-save
        saveLocalData();
    }
    
    // Target Functions
    function addTarget() {
        const targetText = targetInput.value.trim();
        if (!targetText) return;
        
        const target = {
            id: Date.now(),
            text: targetText,
            completed: false,
            createdAt: new Date()
        };
        
        todaysData.targets.push(target);
        renderTargets();
        targetInput.value = '';
        
        // Add activity
        addActivity('Added target: ' + targetText, 'bullseye');
        
        // Auto-save
        saveLocalData();
    }
    
    function renderTargets() {
        targetsList.innerHTML = '';
        
        todaysData.targets.forEach(target => {
            const div = document.createElement('div');
            div.className = 'target-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = target.completed;
            checkbox.addEventListener('change', () => {
                target.completed = checkbox.checked;
                saveLocalData();
                addActivity(target.completed ? 'Completed target' : 'Unchecked target', 
                           target.completed ? 'check-circle' : 'times-circle');
            });
            
            const label = document.createElement('label');
            label.textContent = target.text;
            label.style.textDecoration = target.completed ? 'line-through' : 'none';
            label.style.opacity = target.completed ? '0.6' : '1';
            
            div.appendChild(checkbox);
            div.appendChild(label);
            targetsList.appendChild(div);
        });
    }
    
    // Todo Functions
    function addTodo() {
        const todoText = todoInput.value.trim();
        if (!todoText) return;
        
        const todo = {
            id: Date.now(),
            text: todoText,
            completed: false,
            createdAt: new Date()
        };
        
        todaysData.todos.push(todo);
        renderTodos();
        todoInput.value = '';
        
        // Add activity
        addActivity('Added task: ' + todoText, 'tasks');
        
        // Auto-save
        saveLocalData();
    }
    
    function renderTodos() {
        todoList.innerHTML = '';
        
        todaysData.todos.forEach(todo => {
            const div = document.createElement('div');
            div.className = `todo-item ${todo.completed ? 'completed' : ''}`;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = todo.completed;
            checkbox.addEventListener('change', () => {
                todo.completed = checkbox.checked;
                div.className = `todo-item ${todo.completed ? 'completed' : ''}`;
                saveLocalData();
                addActivity(todo.completed ? 'Completed task' : 'Unchecked task', 
                           todo.completed ? 'check' : 'times');
            });
            
            const span = document.createElement('span');
            span.textContent = todo.text;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.style.background = 'none';
            deleteBtn.style.border = 'none';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.style.marginLeft = 'auto';
            deleteBtn.style.color = 'var(--danger-color)';
            deleteBtn.addEventListener('click', () => {
                todaysData.todos = todaysData.todos.filter(t => t.id !== todo.id);
                renderTodos();
                saveLocalData();
                addActivity('Deleted task', 'trash');
            });
            
            div.appendChild(checkbox);
            div.appendChild(span);
            div.appendChild(deleteBtn);
            todoList.appendChild(div);
        });
    }
    
    // Activity Functions
    function addActivity(text, icon) {
        const activity = {
            text,
            icon,
            timestamp: new Date()
        };
        
        todaysData.activities.unshift(activity); // Add to beginning
        if (todaysData.activities.length > 10) {
            todaysData.activities = todaysData.activities.slice(0, 10); // Keep only last 10
        }
        
        renderActivities();
    }
    
    function renderActivities() {
        activityList.innerHTML = '';
        
        todaysData.activities.forEach(activity => {
            const div = document.createElement('div');
            div.className = 'activity-item';
            
            const time = activity.timestamp.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            div.innerHTML = `
                <i class="fas fa-${activity.icon}"></i>
                <span>${activity.text}</span>
                <span style="margin-left: auto; color: var(--gray-color); font-size: 0.9rem;">${time}</span>
            `;
            
            activityList.appendChild(div);
        });
    }
    
    // Music Functions
    function playMusic() {
        const selectedMusic = musicSelect.value;
        if (selectedMusic) {
            backgroundMusic.src = selectedMusic;
            backgroundMusic.play().catch(e => {
                console.log('Autoplay prevented:', e);
                alert('Click play again to start music. Some browsers require user interaction.');
            });
            addActivity('Started background music', 'music');
        }
    }
    
    function pauseMusic() {
        backgroundMusic.pause();
        addActivity('Paused background music', 'pause');
    }
    
    function updateVolume() {
        backgroundMusic.volume = volumeSlider.value / 100;
    }
    
    function changeMusic() {
        if (!backgroundMusic.paused) {
            playMusic();
        }
    }
    
    // Session Functions
    function startStudySession() {
        // Get timetable data
        const timeSlots = document.querySelectorAll('.time-slot');
        const timetable = [];
        
        timeSlots.forEach(slot => {
            const time = slot.dataset.time;
            const topic = slot.querySelector('input').value.trim();
            if (topic) {
                timetable.push({ time, topic });
            }
        });
        
        // Save setup data
        const setupData = {
            targets: todaysData.targets,
            timetable,
            music: musicSelect.value,
            setupCompleted: true,
            setupTime: new Date()
        };
        
        // Save to Firebase
        const user = window.authModule.getCurrentUser();
        const today = new Date().toDateString();
        
        if (user) {
            window.authModule.db.collection('users').doc(user.uid)
                .collection('days').doc(today)
                .set(setupData, { merge: true })
                .then(() => {
                    console.log('Setup data saved');
                    window.authModule.showDashboardPage();
                    
                    // Set first session from timetable
                    if (timetable.length > 0) {
                        const firstSession = timetable[0];
                        document.getElementById('current-session-topic').textContent = firstSession.topic;
                        updateNextSession();
                    }
                    
                    addActivity('Started study session', 'play-circle');
                })
                .catch(error => {
                    console.error('Error saving setup:', error);
                    alert('Error saving setup data. Please try again.');
                });
        } else {
            // Fallback to localStorage
            saveLocalData();
            window.authModule.showDashboardPage();
            addActivity('Started study session', 'play-circle');
        }
    }
    
    function saveSessionData() {
        // Save session data locally
        saveLocalData();
        
        // Optionally save to Firebase
        const user = window.authModule.getCurrentUser();
        const today = new Date().toDateString();
        
        if (user && currentSession.startTime) {
            const sessionData = {
                sessions: todaysData.sessions,
                totalStudySeconds,
                lastUpdated: new Date()
            };
            
            window.authModule.db.collection('users').doc(user.uid)
                .collection('days').doc(today)
                .set(sessionData, { merge: true })
                .catch(error => console.error('Error saving session:', error));
        }
    }
    
    function updateNextSession() {
        // Simplified next session logic
        const now = new Date();
        const nextHour = now.getHours() + 1;
        const nextTime = `${nextHour}:00`;
        
        document.getElementById('next-session-time').textContent = 
            nextHour > 12 ? `${nextHour - 12}:00 PM` : `${nextHour}:00 AM`;
        
        // Start countdown
        updateNextSessionCountdown();
        setInterval(updateNextSessionCountdown, 1000);
    }
    
    function updateNextSessionCountdown() {
        const now = new Date();
        const nextHour = new Date();
        nextHour.setHours(now.getHours() + 1, 0, 0, 0);
        
        const diff = nextHour - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        document.getElementById('next-session-countdown').textContent =
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // End Day and Report Functions
    function endDay() {
        pauseTimer(); // Ensure timer is stopped
        
        // Calculate statistics
        const completedTargets = todaysData.targets.filter(t => t.completed).length;
        const totalTargets = todaysData.targets.length;
        const completedTodos = todaysData.todos.filter(t => t.completed).length;
        const totalTodos = todaysData.todos.length;
        
        // Calculate max sitting hours (longest session)
        let maxSittingSeconds = 0;
        todaysData.sessions.forEach(session => {
            if (session.duration > maxSittingSeconds) {
                maxSittingSeconds = session.duration;
            }
        });
        
        // Calculate productivity score (simplified)
        const targetScore = totalTargets > 0 ? (completedTargets / totalTargets) * 40 : 0;
        const timeScore = Math.min((totalStudySeconds / (4 * 3600)) * 40, 40); // 4 hours = 100%
        const taskScore = totalTodos > 0 ? (completedTodos / totalTodos) * 20 : 0;
        const productivityScore = Math.round(targetScore + timeScore + taskScore);
        
        // Update report display
        document.getElementById('report-date').textContent = new Date().toLocaleDateString();
        document.getElementById('report-user').textContent = window.authModule.getCurrentUser()?.displayName || 'Student';
        document.getElementById('targets-completed').textContent = `${completedTargets}/${totalTargets}`;
        document.getElementById('total-study-hours').textContent = totalHoursDisplay.textContent;
        
        const maxHours = Math.floor(maxSittingSeconds / 3600);
        const maxMinutes = Math.floor((maxSittingSeconds % 3600) / 60);
        document.getElementById('max-sitting-hours').textContent = 
            `${maxHours.toString().padStart(2, '0')}:${maxMinutes.toString().padStart(2, '0')}`;
        
        document.getElementById('tasks-completed').textContent = `${completedTodos}/${totalTodos}`;
        document.getElementById('productivity-score').textContent = `${productivityScore}%`;
        document.getElementById('sessions-completed').textContent = todaysData.sessions.length;
        
        // Update progress bars
        const targetsProgress = totalTargets > 0 ? (completedTargets / totalTargets) * 100 : 0;
        const tasksProgress = totalTodos > 0 ? (completedTodos / totalTodos) * 100 : 0;
        
        document.getElementById('targets-progress-bar').style.width = `${targetsProgress}%`;
        document.getElementById('tasks-progress-bar').style.width = `${tasksProgress}%`;
        
        // Update summary text
        let summary = '';
        if (productivityScore >= 80) {
            summary = 'Outstanding work today! Your focus and dedication are impressive.';
        } else if (productivityScore >= 60) {
            summary = 'Great job today! You made solid progress toward your goals.';
        } else if (productivityScore >= 40) {
            summary = 'Good effort today. Every bit of progress counts!';
        } else {
            summary = 'Every day is a new opportunity. Tomorrow you can do even better!';
        }
        document.getElementById('report-summary-text').textContent = summary;
        
        // Show results page
        window.authModule.showResultsPage();
        
        // Save final data to Firebase
        saveFinalDataToFirebase(completedTargets, totalTargets, completedTodos, totalTodos, 
                               totalStudySeconds, maxSittingSeconds, productivityScore);
    }
    
    async function saveFinalDataToFirebase(completedTargets, totalTargets, completedTodos, totalTodos, 
                                          totalStudySeconds, maxSittingSeconds, productivityScore) {
        const user = window.authModule.getCurrentUser();
        const today = new Date().toDateString();
        
        if (user) {
            const finalData = {
                completedTargets,
                totalTargets,
                completedTodos,
                totalTodos,
                totalStudySeconds,
                maxSittingSeconds,
                productivityScore,
                sessionsCount: todaysData.sessions.length,
                capturesCount: todaysData.captures.length,
                dayEnded: true,
                endTime: new Date()
            };
            
            try {
                await window.authModule.db.collection('users').doc(user.uid)
                    .collection('days').doc(today)
                    .set(finalData, { merge: true });
                
                // Update user's total stats
                const userRef = window.authModule.db.collection('users').doc(user.uid);
                const userDoc = await userRef.get();
                const currentData = userDoc.data() || {};
                
                await userRef.update({
                    totalStudyHours: (currentData.totalStudyHours || 0) + (totalStudySeconds / 3600),
                    totalDays: (currentData.totalDays || 0) + 1,
                    lastActive: new Date()
                });
                
                console.log('Final data saved to Firebase');
            } catch (error) {
                console.error('Error saving final data:', error);
            }
        }
    }
    
    function saveReportAsImage() {
        const reportCard = document.getElementById('report-card');
        
        html2canvas(reportCard, {
            backgroundColor: '#f8f9fa',
            scale: 2,
            useCORS: true
        }).then(canvas => {
            // Convert canvas to image
            const image = canvas.toDataURL('image/png');
            
            // Create download link
            const link = document.createElement('a');
            link.download = `Study-Report-${new Date().toISOString().split('T')[0]}.png`;
            link.href = image;
            link.click();
            
            addActivity('Saved report as image', 'download');
        });
    }
    
    function startNewDay() {
        // Reset all data for new day
        resetTimer();
        todaysData = {
            targets: [],
            todos: [],
            sessions: [],
            captures: [],
            activities: []
        };
        totalStudySeconds = 0;
        updateTotalStudyTime();
        
        // Clear displays
        captureHistory.innerHTML = '';
        targetsList.innerHTML = '';
        todoList.innerHTML = '';
        activityList.innerHTML = '';
        
        // Reset progress
        document.getElementById('study-progress-bar').style.width = '0%';
        document.getElementById('progress-text').textContent = '0% of daily goal';
        
        // Go to setup page
        window.authModule.showSetupPage();
        
        addActivity('Started new day', 'sun');
    }
    
    // Data Persistence Functions
    function saveLocalData() {
        const dataToSave = {
            todaysData,
            totalStudySeconds,
            currentSession,
            seconds,
            isTimerRunning,
            lastSaved: new Date()
        };
        
        localStorage.setItem('studyTrackerData', JSON.stringify(dataToSave));
        
        // Also save to Firebase if user is logged in
        const user = window.authModule.getCurrentUser();
        if (user) {
            const today = new Date().toDateString();
            const saveData = {
                ...dataToSave,
                lastUpdated: new Date()
            };
            
            window.authModule.db.collection('users').doc(user.uid)
                .collection('days').doc(today)
                .set(saveData, { merge: true })
                .catch(error => console.error('Auto-save error:', error));
        }
    }
    
    function loadLocalData() {
        const savedData = localStorage.getItem('studyTrackerData');
        
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                
                // Check if data is from today
                const today = new Date().toDateString();
                const savedDate = data.lastSaved ? new Date(data.lastSaved).toDateString() : null;
                
                if (savedDate === today) {
                    // Load today's data
                    todaysData = data.todaysData || {
                        targets: [],
                        todos: [],
                        sessions: [],
                        captures: [],
                        activities: []
                    };
                    totalStudySeconds = data.totalStudySeconds || 0;
                    currentSession = data.currentSession || {
                        startTime: null,
                        endTime: null,
                        topic: '',
                        duration: 0
                    };
                    seconds = data.seconds || 0;
                    isTimerRunning = data.isTimerRunning || false;
                    
                    // Restore UI
                    updateTimerDisplay();
                    updateTotalStudyTime();
                    renderTargets();
                    renderTodos();
                    renderActivities();
                    
                    // Restore captures
                    todaysData.captures.forEach(capture => {
                        const img = document.createElement('img');
                        img.src = capture.data;
                        img.className = 'capture-item';
                        img.title = 'Captured at ' + new Date(capture.timestamp).toLocaleTimeString();
                        captureHistory.appendChild(img);
                    });
                    
                    // Restore timer state if it was running
                    if (isTimerRunning) {
                        startTimer();
                    }
                    
                    console.log('Loaded saved data from localStorage');
                } else {
                    console.log('Saved data is from a different day, starting fresh');
                    // Data is from a different day, start fresh
                    startNewDay();
                }
            } catch (error) {
                console.error('Error loading saved data:', error);
            }
        }
    }
});