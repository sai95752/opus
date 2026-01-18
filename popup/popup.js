const setupView = document.getElementById('setupView');
const activeView = document.getElementById('activeView');
const domainList = document.getElementById('domainList');
const duration = document.getElementById('duration');
const startBtn = document.getElementById('startBtn');
const timeRemaining = document.getElementById('timeRemaining');
const blockedDomains = document.getElementById('blockedDomains');
const savedDomainsDiv = document.getElementById('savedDomains');

let savedDomains = [];

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('preset-btn')) {
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    duration.value = e.target.getAttribute('data-minutes');
  }
});

browser.storage.local.get(['savedDomains']).then((data) => {
  if (data.savedDomains) {
    savedDomains = data.savedDomains;
    renderSavedDomains();
  }
});

browser.runtime.sendMessage({ action: 'getStatus' }).then((status) => {
  if (status.active) {
    showActiveView(status);
    startTimer(status.endTime);
  }
});

function renderSavedDomains() {
  savedDomainsDiv.innerHTML = '';
  
  if (savedDomains.length === 0) {
    return;
  }
  
  savedDomains.forEach((domain, index) => {
    const tag = document.createElement('span');
    tag.className = 'domain-tag';
    tag.innerHTML = `${domain} <button class="remove-btn" data-index="${index}">×</button>`;
    savedDomainsDiv.appendChild(tag);
  });
  
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      savedDomains.splice(index, 1);
      browser.storage.local.set({ savedDomains });
      renderSavedDomains();
    });
  });
}

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.classList.add('show');
  setTimeout(() => {
    errorDiv.classList.remove('show');
  }, 10000);
}

startBtn.addEventListener('click', () => {
  const newDomains = domainList.value
    .split('\n')
    .map(d => d.trim())
    .filter(d => d.length > 0);
  
  const allDomains = [...new Set([...savedDomains, ...newDomains])];
  
  const minutes = parseInt(duration.value);
  
  if (allDomains.length === 0) {
    showError('Please add at least one domain to block');
    return;
  }
  
  if (isNaN(minutes) || minutes < 1) {
    showError('Duration must be a number greater than 0');
    return;
  }
  
  if (newDomains.length > 0) {
    savedDomains = allDomains;
    browser.storage.local.set({ savedDomains });
    renderSavedDomains();
  }
  
  // Start the session
  browser.runtime.sendMessage({
    action: 'startSession',
    blockList: allDomains,
    minutes: minutes
  }).then(() => {
    const endTime = Date.now() + (minutes * 60 * 1000);
    showActiveView({ blockList: allDomains, endTime });
    startTimer(endTime);
    domainList.value = '';  
  });
});

function showActiveView(status) {
  setupView.style.display = 'none';
  activeView.style.display = 'block';
  blockedDomains.textContent = 'Blocking: ' + status.blockList.join(', ');
}

function startTimer(endTime) {
  function updateTimer() {
    const now = Date.now();
    const remaining = endTime - now;
    
    if (remaining <= 0) {
      // Session ended
      setupView.style.display = 'block';
      activeView.style.display = 'none';
      domainList.value = '';
      return;
    }
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    timeRemaining.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    setTimeout(updateTimer, 1000);
  }
  
  updateTimer();
}