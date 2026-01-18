let blockList = [];
let endTime = null;

// Load saved data on startup
browser.storage.local.get(['blockList', 'endTime']).then((data) => {
  if (data.blockList) blockList = data.blockList;
  if (data.endTime) endTime = data.endTime;
  
  // Check if session is still active
  if (endTime && Date.now() < endTime) {
    startBlocking();
  } else {
    endTime = null;
    browser.storage.local.set({ endTime: null });
  }
});

// Listen for messages from popup
browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'startSession') {
    blockList = message.blockList;
    endTime = Date.now() + (message.minutes * 60 * 1000);
    
    // Save to storage
    browser.storage.local.set({ blockList, endTime });
    
    startBlocking();
    return Promise.resolve({ success: true });
  }
  
  if (message.action === 'getStatus') {
    return Promise.resolve({
      active: endTime && Date.now() < endTime,
      endTime: endTime,
      blockList: blockList
    });
  }
});

function startBlocking() {
  // This listener will block requests
  if (!browser.webRequest.onBeforeRequest.hasListener(blockRequest)) {
    browser.webRequest.onBeforeRequest.addListener(
      blockRequest,
      { urls: ["<all_urls>"] },
      ["blocking"]
    );
  }
  
  // Check periodically if session has ended
  checkSessionEnd();
}

function blockRequest(details) {
  // Don't block if session has ended
  if (!endTime || Date.now() >= endTime) {
    return {};
  }
  
  const url = new URL(details.url);
  const hostname = url.hostname;
  
  // Check if domain matches any in blocklist
  for (let domain of blockList) {
    if (hostname === domain || hostname.endsWith('.' + domain)) {
      return { cancel: true };  // Just cancel the request - page won't load
    }
  }
  
  return {};
}

function checkSessionEnd() {
  if (!endTime) return;
  
  const timeLeft = endTime - Date.now();
  
  if (timeLeft <= 0) {
    // Session ended
    endTime = null;
    browser.storage.local.set({ endTime: null });
    browser.webRequest.onBeforeRequest.removeListener(blockRequest);
  } else {
    // Check again in 1 second
    setTimeout(checkSessionEnd, 1000);
  }
}