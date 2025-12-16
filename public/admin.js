console.log('Admin.js loaded');

const socket = io();

let roomTimers = {};

socket.on('connect', () => {
  console.log('Admin socket connected:', socket.id);
  socket.emit('admin-connect');
});

socket.on('disconnect', () => {
  console.log('Admin socket disconnected');
});

socket.on('game-state', (gameState) => {
  console.log('Game state received:', gameState);
  updateAllRooms(gameState);
  updateRankings(gameState.completedTeams);
});

socket.on('password-wrong-admin', (data) => {
  console.log('Password wrong for room:', data.roomNumber, 'Penalties:', data.penalties);
  showWrongNotification(data.roomNumber);
});

socket.on('hint-requested', (data) => {
  console.log('Hint requested from room:', data.roomNumber, 'Message:', data.message);
  showHintNotification(data.roomNumber, data.message);
});

function updateAllRooms(gameState) {
  for (let roomNumber in gameState.rooms) {
    const room = gameState.rooms[roomNumber];
    updateRoomDisplay(parseInt(roomNumber), room);
  }
}

function updateRoomDisplay(roomNumber, roomData) {
  const roomCard = document.querySelector(`.room-card[data-room="${roomNumber}"]`);
  if (!roomCard) return;
  
  const statusBadge = roomCard.querySelector('.status-badge');
  const teamName = roomCard.querySelector('.team-name');
  const elapsedTime = roomCard.querySelector('.elapsed-time');
  const penaltyInfo = roomCard.querySelector('.penalty-info');
  const screamToggle = roomCard.querySelector('.scream-toggle');
  const passwordInput = roomCard.querySelector('.password-input');
  const digitsInput = roomCard.querySelector('.digits-input');
  
  if (screamToggle) {
    screamToggle.checked = roomData.screamEnabled !== false;
  }
  
  if (passwordInput && roomData.password) {
    passwordInput.value = roomData.password;
  }
  
  if (digitsInput && roomData.digits) {
    digitsInput.value = roomData.digits;
  }
  
  if (roomData.completed) {
    statusBadge.textContent = '완료';
    statusBadge.className = 'status-badge completed';
    teamName.textContent = roomData.teamName;
    
    if (roomTimers[roomNumber]) {
      clearInterval(roomTimers[roomNumber]);
      delete roomTimers[roomNumber];
    }
    
  } else if (roomData.isActive && roomData.startTime) {
    statusBadge.textContent = '진행중';
    statusBadge.className = 'status-badge active';
    teamName.textContent = roomData.teamName;
    
    if (!roomTimers[roomNumber]) {
      roomTimers[roomNumber] = setInterval(() => {
        updateTimer(roomNumber, roomData);
      }, 100);
    }
    
  } else {
    statusBadge.textContent = '대기중';
    statusBadge.className = 'status-badge inactive';
    teamName.textContent = '-';
    elapsedTime.textContent = '00:00:00';
    
    if (roomTimers[roomNumber]) {
      clearInterval(roomTimers[roomNumber]);
      delete roomTimers[roomNumber];
    }
  }
  
  const penaltySeconds = roomData.penalties * 30;
  penaltyInfo.textContent = `패널티: ${roomData.penalties}회 (+${penaltySeconds}초)`;
}

function updateTimer(roomNumber, roomData) {
  const roomCard = document.querySelector(`.room-card[data-room="${roomNumber}"]`);
  if (!roomCard) return;
  
  const elapsedTime = roomCard.querySelector('.elapsed-time');
  if (!elapsedTime) return;
  
  if (!roomData.isActive || roomData.completed) {
    if (roomTimers[roomNumber]) {
      clearInterval(roomTimers[roomNumber]);
      delete roomTimers[roomNumber];
    }
    return;
  }
  
  const now = Date.now();
  const elapsed = now - roomData.startTime;
  const penaltyTime = roomData.penalties * 30000;
  const totalTime = elapsed + penaltyTime;
  
  const hours = Math.floor(totalTime / 3600000);
  const minutes = Math.floor((totalTime % 3600000) / 60000);
  const seconds = Math.floor((totalTime % 60000) / 1000);
  
  elapsedTime.textContent = 
    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateRankings(completedTeams) {
  const tbody = document.getElementById('rankings-body');
  if (!tbody) return;
  
  if (!completedTeams || completedTeams.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">아직 완료한 팀이 없습니다</td></tr>';
    return;
  }
  
  tbody.innerHTML = '';
  
  completedTeams.forEach((team, index) => {
    const row = document.createElement('tr');
    
    const hours = Math.floor(team.time / 3600000);
    const minutes = Math.floor((team.time % 3600000) / 60000);
    const seconds = Math.floor((team.time % 60000) / 1000);
    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    const roomNames = {
      1: '폐병원',
      2: '크리스마스 악몽',
      3: '호텔',
      4: '대기실'
    };
    
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${team.teamName}</td>
      <td>${roomNames[team.roomNumber]}</td>
      <td>${timeString}</td>
      <td>${team.penalties}회 (+${team.penalties * 30}초)</td>
    `;
    
    tbody.appendChild(row);
  });
}

function setPassword(roomNumber) {
  const passwordInput = document.querySelector(`.password-input[data-room="${roomNumber}"]`);
  const digitsInput = document.querySelector(`.digits-input[data-room="${roomNumber}"]`);
  
  const password = passwordInput.value.trim();
  const digits = parseInt(digitsInput.value);
  
  if (!password) {
    alert('비밀번호를 입력하세요');
    return;
  }
  
  if (digits < 1 || digits > 10) {
    alert('자릿수는 1~10 사이여야 합니다');
    return;
  }
  
  if (password.length !== digits) {
    alert(`비밀번호는 ${digits}자리여야 합니다`);
    return;
  }
  
  console.log('Setting password for room', roomNumber, ':', password, 'digits:', digits);
  socket.emit('admin-set-password', { roomNumber, password, digits });
  alert('비밀번호가 설정되었습니다');
}

function sendHint(roomNumber) {
  const hintInput = document.querySelector(`.hint-input[data-room="${roomNumber}"]`);
  const hint = hintInput.value.trim();
  
  if (!hint) {
    alert('힌트를 입력하세요');
    return;
  }
  
  console.log('Sending hint to room', roomNumber, ':', hint);
  socket.emit('send-hint', { roomNumber, hint });
  hintInput.value = '';
}

function sendEffect(roomNumber, effect) {
  console.log('Sending effect to room', roomNumber, ':', effect);
  socket.emit('send-effect', { roomNumber, effect });
}

function resetRoom(roomNumber) {
  if (confirm(`방 ${roomNumber}을(를) 리셋하시겠습니까?`)) {
    console.log('Resetting room', roomNumber);
    socket.emit('admin-reset-room', roomNumber);
  }
}

function resetRankings() {
  if (confirm('순위표를 초기화하시겠습니까?')) {
    console.log('Resetting rankings');
    socket.emit('admin-reset-rankings');
  }
}

function playAnnouncement(roomNumber, announcement) {
  console.log('Playing announcement', announcement, 'to room', roomNumber);
  socket.emit('play-announcement', { roomNumber, announcement });
}

function showHintNotification(roomNumber, message) {
  const notification = document.getElementById('hint-notification');
  const text = document.getElementById('hint-notification-text');
  
  const roomNames = {
    1: '폐병원',
    2: '크리스마스 악몽',
    3: '호텔',
    4: '대기실'
  };
  
  text.textContent = `${roomNames[roomNumber]}에서 힌트 요청: ${message}`;
  notification.classList.remove('hidden');
  
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 5000);
}

function showWrongNotification(roomNumber) {
  const notification = document.getElementById('wrong-notification');
  const text = document.getElementById('wrong-notification-text');
  
  const roomNames = {
    1: '폐병원',
    2: '크리스마스 악몽',
    3: '호텔',
    4: '대기실'
  };
  
  text.textContent = `${roomNames[roomNumber]}에서 오답 제출!`;
  notification.classList.remove('hidden');
  
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('Admin DOM loaded');
  
  document.querySelectorAll('.scream-toggle').forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      const roomNumber = parseInt(e.target.getAttribute('data-room'));
      const enabled = e.target.checked;
      console.log('Toggling scream for room', roomNumber, ':', enabled);
      socket.emit('toggle-scream', { roomNumber, enabled });
    });
  });
});
