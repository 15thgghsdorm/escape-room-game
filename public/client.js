console.log('Client.js loaded');

const socket = io();

let currentRoom = null;
let timerInterval = null;
let startTime = null;
let passwordInput = '';
let maxDigits = 4;
let penaltyTime = 0;
let audioInitialized = false;
let screamEnabled = true;

const roomBGM = {
    1: 'sounds/hospital.mp3',
    2: 'sounds/christmas.mp3',
    3: 'sounds/hotel.mp3',
    4: 'sounds/waiting.mp3'
};

const announcementSounds = {
    'start': 'sounds/announcement_start.mp3',
    '10min': 'sounds/announcement_10min.mp3',
    '5min': 'sounds/announcement_5min.mp3',
    'end': 'sounds/announcement_end.mp3',
    'other1': 'sounds/announcement_other1.mp3',
    'other2': 'sounds/announcement_other2.mp3'
};

socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
});

socket.on('disconnect', () => {
    console.log('Socket disconnected');
});

function initializeAudio() {
    if (audioInitialized) return;

    audioInitialized = true;
    console.log('Audio initialized successfully');
}

function selectRoom(roomNumber) {
    console.log('Selecting room:', roomNumber);
    initializeAudio();
    currentRoom = roomNumber;
    socket.emit('select-room', roomNumber);
    showScreen('team-name-screen');
}

function submitTeamName() {
    const teamName = document.getElementById('team-name-input').value.trim();
    if (!teamName) {
        alert('팀 이름을 입력하세요');
        return;
    }

    initializeAudio();
    console.log('Submitting team name:', teamName, 'for room:', currentRoom);
    socket.emit('set-team-name', { roomNumber: currentRoom, teamName: teamName });
}

socket.on('game-started', (data) => {
    console.log('Game started:', data);
    showScreen('game-screen');
    
    startTime = data.startTime || Date.now();
    penaltyTime = 0;
    
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    startTimer();

    playAmbientSound();

    passwordInput = '0'.repeat(maxDigits);
    updatePasswordDisplay();
    updatePenaltyDisplay();
});

function startTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    timerInterval = setInterval(() => {
        if (!startTime) return;
        
        const elapsed = Date.now() - startTime + penaltyTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);

        const timerElement = document.getElementById('timer');
        if (timerElement) {
            timerElement.textContent =
                `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }, 100);
}

function updatePenaltyDisplay() {
    const penaltySeconds = Math.floor(penaltyTime / 1000);
    const penaltyElement = document.getElementById('penalty-display');
    if (penaltyElement) {
        penaltyElement.textContent = `패널티: +${penaltySeconds}초`;
    }
}

function addNumber(num) {
    console.log('Adding number:', num, 'Current input:', passwordInput, 'Max digits:', maxDigits);

    if (passwordInput === '0'.repeat(maxDigits)) {
        passwordInput = '';
    }

    if (passwordInput.length < maxDigits) {
        passwordInput += num;
    }

    updatePasswordDisplay();
    console.log('Updated password:', passwordInput);
}

function updatePasswordDisplay() {
    const display = document.getElementById('password-display');
    if (display) {
        display.textContent = passwordInput.padStart(maxDigits, '0');

        if (maxDigits <= 4) {
            display.style.letterSpacing = '0.6rem';
        } else if (maxDigits <= 6) {
            display.style.letterSpacing = '0.5rem';
        } else {
            display.style.letterSpacing = '0.3rem';
        }
    }
}

function clearPassword() {
    console.log('Clearing password');
    passwordInput = '0'.repeat(maxDigits);
    updatePasswordDisplay();
}

function submitPassword() {
    const finalPassword = passwordInput.padStart(maxDigits, '0');
    console.log('Submitting password:', finalPassword, 'for room:', currentRoom);
    socket.emit('check-password', { roomNumber: currentRoom, password: finalPassword });
}

socket.on('password-correct', (data) => {
    console.log('Password correct!', data);
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    stopAmbientSound();
    playSuccessSound();

    const totalTime = data.time + penaltyTime;
    const hours = Math.floor(totalTime / 3600000);
    const minutes = Math.floor((totalTime % 3600000) / 60000);
    const seconds = Math.floor((totalTime % 60000) / 1000);

    const finalTimeElement = document.getElementById('final-time');
    if (finalTimeElement) {
        finalTimeElement.textContent =
            `완료 시간: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    const penaltySeconds = Math.floor(penaltyTime / 1000);
    const finalPenaltyElement = document.getElementById('final-penalty');
    if (finalPenaltyElement) {
        finalPenaltyElement.textContent = `패널티: +${penaltySeconds}초`;
    }

    showScreen('success-screen');
});

socket.on('password-wrong', (data) => {
    console.log('Password wrong! Scream enabled:', data.screamEnabled);

    penaltyTime += 30000;
    updatePenaltyDisplay();

    const wrongMsg = document.getElementById('wrong-message');
    if (wrongMsg) {
        wrongMsg.classList.remove('hidden');
    }

    const display = document.getElementById('password-display');
    if (display) {
        display.style.border = '3px solid #ff0000';
        display.style.animation = 'shake 0.5s';
    }

    document.body.classList.add('shake');
    triggerBloodSplash();
    triggerIntenseBloodDrip();
    triggerExtremeFlash();

    if (data.screamEnabled === true) {
        playEffectSound('scream');
    }

    passwordInput = '0'.repeat(maxDigits);
    updatePasswordDisplay();

    setTimeout(() => {
        if (display) {
            display.style.border = '3px solid #8b0000';
            display.style.animation = '';
        }
        if (wrongMsg) {
            wrongMsg.classList.add('hidden');
        }
        document.body.classList.remove('shake');
    }, 2000);
});

function requestHint() {
    console.log('Opening hint request popup');
    const popup = document.getElementById('hint-request-popup');
    if (popup) {
        popup.classList.remove('hidden');
        const textArea = document.getElementById('hint-request-text');
        if (textArea) {
            textArea.value = '';
            textArea.focus();
        }
    }
}

function sendHintRequest() {
    const hintText = document.getElementById('hint-request-text').value.trim();
    if (!hintText) {
        alert('힌트 요청 내용을 입력하세요');
        return;
    }

    console.log('Sending hint request:', hintText, 'for room:', currentRoom);
    socket.emit('request-hint', { roomNumber: currentRoom, message: hintText });
    
    const requestPopup = document.getElementById('hint-request-popup');
    if (requestPopup) {
        requestPopup.classList.add('hidden');
    }

    const popup = document.getElementById('hint-popup');
    const content = popup.querySelector('.hint-content');
    if (content) {
        content.textContent = '힌트 요청이 전송되었다...';
    }
    if (popup) {
        popup.classList.remove('hidden');
    }

    setTimeout(() => {
        if (popup) {
            popup.classList.add('hidden');
        }
    }, 3000);
}

function cancelHintRequest() {
    const popup = document.getElementById('hint-request-popup');
    if (popup) {
        popup.classList.add('hidden');
    }
}

socket.on('hint-received', (hint) => {
    console.log('Hint received:', hint);
    const popup = document.getElementById('hint-popup');
    const content = popup.querySelector('.hint-content');
    if (content) {
        content.textContent = hint;
    }
    if (popup) {
        popup.classList.remove('hidden');
    }

    setTimeout(() => {
        if (popup) {
            popup.classList.add('hidden');
        }
    }, 5000);
});

socket.on('effect-trigger', (effect) => {
    console.log('Effect triggered:', effect);
    switch (effect) {
        case 'flash':
            triggerExtremeFlash();
            break;
        case 'shake':
            triggerExtremeShake();
            break;
        case 'scream':
            playEffectSound('scream');
            break;
        case 'bloodDrip':
            triggerIntenseBloodDrip();
            break;
    }
});

socket.on('room-config', (config) => {
    console.log('Room config received:', config);
    maxDigits = config.digits;
    passwordInput = '0'.repeat(maxDigits);
    screamEnabled = config.screamEnabled !== undefined ? config.screamEnabled : true;
    updatePasswordDisplay();
    console.log('Updated maxDigits to:', maxDigits, 'screamEnabled:', screamEnabled);
});

socket.on('scream-toggle', (data) => {
    screamEnabled = data.enabled;
    console.log('Scream sound', screamEnabled ? 'enabled' : 'disabled');

    if (!screamEnabled) {
        stopEffectSound();
        console.log('Scream sound immediately stopped');
    }
});

socket.on('play-announcement', (data) => {
    console.log('Playing announcement:', data.announcement);
    const audioFile = announcementSounds[data.announcement];
    if (audioFile) {
        playAnnouncementAudio(audioFile);
    } else {
        console.error('Unknown announcement:', data.announcement);
    }
});

function triggerExtremeFlash() {
    document.body.classList.add('flash');
    setTimeout(() => document.body.classList.remove('flash'), 500);
}

function triggerExtremeShake() {
    document.body.classList.add('shake');
    playEffectSound('scream');
    setTimeout(() => document.body.classList.remove('shake'), 500);
}

function triggerBloodSplash() {
    const splash = document.querySelector('.blood-splash');
    if (!splash) return;

    splash.classList.remove('active');
    void splash.offsetWidth;
    splash.classList.add('active');

    setTimeout(() => {
        splash.classList.remove('active');
    }, 2000);
}

function triggerIntenseBloodDrip() {
    const bloodDrip = document.getElementById('blood-drip');
    if (!bloodDrip) return;
    
    bloodDrip.classList.remove('blood-drip-intense');
    void bloodDrip.offsetWidth;
    bloodDrip.classList.add('blood-drip-intense');

    setTimeout(() => {
        bloodDrip.classList.remove('blood-drip-intense');
    }, 2500);
}

function showScreen(screenId) {
    console.log('Showing screen:', screenId);
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
}

function playAmbientSound() {
    const audio = document.getElementById('ambient-sound');
    if (!audio) {
        console.error('Ambient audio element not found');
        return;
    }

    const bgmFile = roomBGM[currentRoom];
    console.log('Playing BGM for room', currentRoom, ':', bgmFile);

    audio.src = bgmFile;
    audio.volume = 0.3;
    audio.loop = true;

    const playPromise = audio.play();

    if (playPromise !== undefined) {
        playPromise.then(() => {
            console.log('Ambient sound playing:', bgmFile);
        }).catch(error => {
            console.error('Ambient sound play failed:', error);
        });
    }
}

function stopAmbientSound() {
    const audio = document.getElementById('ambient-sound');
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }
}

function duckAmbientSound() {
    const audio = document.getElementById('ambient-sound');
    if (audio && !audio.paused) {
        audio.volume = 0.08;
        console.log('BGM ducked to 0.08');
    }
}

function restoreAmbientSound() {
    const audio = document.getElementById('ambient-sound');
    if (audio && !audio.paused) {
        audio.volume = 0.3;
        console.log('BGM restored to 0.3');
    }
}

function playAnnouncementAudio(audioFile) {
    const audio = document.getElementById('announcement-sound');
    if (!audio) {
        console.error('Announcement audio element not found');
        return;
    }

    console.log('Playing announcement audio:', audioFile);

    duckAmbientSound();

    audio.src = audioFile;
    audio.volume = 0.9;
    audio.loop = false;

    audio.onended = () => {
        restoreAmbientSound();
        console.log('Announcement audio ended, BGM restored');
    };

    audio.onerror = (e) => {
        console.error('Announcement audio error:', e);
        console.error('Failed to load:', audioFile);
        restoreAmbientSound();
    };

    const playPromise = audio.play();

    if (playPromise !== undefined) {
        playPromise.then(() => {
            console.log('Announcement audio playing:', audioFile);
        }).catch(error => {
            console.error('Announcement audio play failed:', error);
            restoreAmbientSound();
        });
    }
}

function playEffectSound(type) {
    const audio = document.getElementById('effect-sound');
    if (!audio) {
        console.error('Effect audio element not found');
        return;
    }

    audio.src = `sounds/${type}.mp3`;
    audio.volume = 0.9;

    const playPromise = audio.play();

    if (playPromise !== undefined) {
        playPromise.then(() => {
            console.log(`Effect sound ${type} playing`);
        }).catch(error => {
            console.error(`Effect sound ${type} play failed:`, error);
        });
    }
}

function stopEffectSound() {
    const audio = document.getElementById('effect-sound');
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
        console.log('Effect sound stopped');
    }
}

function playSuccessSound() {
    const audio = document.getElementById('success-sound');
    if (!audio) {
        console.error('Success audio element not found');
        return;
    }

    audio.volume = 0.8;

    const playPromise = audio.play();

    if (playPromise !== undefined) {
        playPromise.then(() => {
            console.log('Success sound playing');
        }).catch(error => {
            console.error('Success sound play failed:', error);
        });
    }
}

socket.on('game-reset', () => {
    console.log('Game reset received');
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    stopAmbientSound();
    stopEffectSound();

    const announcementAudio = document.getElementById('announcement-sound');
    if (announcementAudio) {
        announcementAudio.pause();
        announcementAudio.currentTime = 0;
    }

    if (currentRoom) {
        socket.emit('client-leave-room', { roomNumber: currentRoom });
    }

    showScreen('room-selection');
    
    const teamNameInput = document.getElementById('team-name-input');
    if (teamNameInput) {
        teamNameInput.value = '';
    }
    
    passwordInput = '';
    penaltyTime = 0;
    startTime = null;
    currentRoom = null;
    
    updatePasswordDisplay();
});

window.addEventListener('beforeunload', () => {
    if (currentRoom && socket.connected) {
        socket.emit('client-leave-room', { roomNumber: currentRoom });
    }
});

window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, setting up event listeners');

    const room1 = document.getElementById('room-1');
    const room2 = document.getElementById('room-2');
    const room3 = document.getElementById('room-3');
    const room4 = document.getElementById('room-4');

    if (room1) room1.addEventListener('click', () => selectRoom(1));
    if (room2) room2.addEventListener('click', () => selectRoom(2));
    if (room3) room3.addEventListener('click', () => selectRoom(3));
    if (room4) room4.addEventListener('click', () => selectRoom(4));

    const submitTeamBtn = document.getElementById('submit-team-btn');
    const teamNameInput = document.getElementById('team-name-input');

    if (submitTeamBtn) submitTeamBtn.addEventListener('click', submitTeamName);
    if (teamNameInput) {
        teamNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitTeamName();
        });
    }

    document.querySelectorAll('.numpad-btn[data-num]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const num = btn.getAttribute('data-num');
            console.log('Numpad button clicked:', num);
            addNumber(num);
        });
    });

    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            clearPassword();
        });
    }

    const submitPwdBtn = document.getElementById('submit-password-btn');
    if (submitPwdBtn) {
        submitPwdBtn.addEventListener('click', (e) => {
            e.preventDefault();
            submitPassword();
        });
    }

    const hintRequestBtn = document.getElementById('hint-request-btn');
    const sendHintBtn = document.getElementById('send-hint-request-btn');
    const cancelHintBtn = document.getElementById('cancel-hint-request-btn');

    if (hintRequestBtn) {
        hintRequestBtn.addEventListener('click', (e) => {
            e.preventDefault();
            requestHint();
        });
        console.log('Hint request button listener attached');
    } else {
        console.error('Hint request button NOT found!');
    }

    if (sendHintBtn) {
        sendHintBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sendHintRequest();
        });
    }

    if (cancelHintBtn) {
        cancelHintBtn.addEventListener('click', (e) => {
            e.preventDefault();
            cancelHintRequest();
        });
    }

    console.log('All event listeners set up successfully');
});