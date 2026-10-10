chrome.commands.onCommand.addListener(async (command) => {
  if (command === "translate_highlight") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    // Execute script on current active tab to grab selected text
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString().trim()
    }, (results) => {
      if (results && results[0] && results[0].result) {
        const selectedText = results[0].result;
        // Store selected text temporarily and trigger popup
        chrome.storage.local.set({ highlightedText: selectedText }, () => {
          chrome.action.openPopup();
        });
      }
    });
  }
});