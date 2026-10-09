let currentTrackedWord = '';

function injectSaveButton() {
  if (document.getElementById('sd-save-dictionary-btn')) return;

  const button = document.createElement('button');
  button.id = 'sd-save-dictionary-btn';
  button.innerText = '💾 Save';

  button.addEventListener('click', handleSaveTranslation);
  document.body.appendChild(button);
}

function getPageTranslationData() {
  let inputWord = '';
  let translatedWord = '';

  const wordHeader = document.querySelector('h1') || document.querySelector('[data-testid="dictionary-header"]');
  const translationOutput = document.querySelector('#dictionary-lookup-headword-1') || 
                            document.querySelector('a[href*="/translate/"]') ||
                            document.querySelector('.quickdef-1');

  if (wordHeader && wordHeader.innerText.trim()) {
    inputWord = wordHeader.innerText.trim();
  }
  if (translationOutput && translationOutput.innerText.trim()) {
    translatedWord = translationOutput.innerText.trim();
  }

  if (!inputWord || !translatedWord) {
    const textareaInput = document.querySelector('textarea#source-text') || 
                          document.querySelector('textarea[data-testid="translator-input"]') ||
                          document.querySelector('textarea');

    const sentenceOutput = document.querySelector('[data-testid="translator-output"]') ||
                           document.querySelector('#translation-output') ||
                           document.querySelector('.translation-output') ||
                           document.querySelector('[class*="translationOutput"]');

    if (textareaInput && textareaInput.value.trim()) {
      inputWord = textareaInput.value.trim();
    }
    if (sentenceOutput && sentenceOutput.innerText.trim()) {
      translatedWord = sentenceOutput.innerText.trim();
    }
  }

  return {
    input: cleanTranslationText(inputWord),
    translation: cleanTranslationText(translatedWord)
  };
}

async function handleSaveTranslation() {
  const { input: cleanInput, translation: cleanTranslation } = getPageTranslationData();

  if (!cleanInput) {
    alert('Could not detect text on this page.');
    return;
  }

  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const entryLine = `${cleanInput} - ${cleanTranslation || 'N/A'} - ${timestamp}`;

  currentTrackedWord = cleanInput;

  chrome.storage.local.get(['savedDictionary'], (result) => {
    let dictionaryList = result.savedDictionary || [];

    const isDuplicate = dictionaryList.some(entry => {
      const existingText = entry.toLowerCase();
      return existingText.includes(`${cleanInput.toLowerCase()} -`) || 
             existingText.includes(`- ${cleanInput.toLowerCase()} -`);
    });

    if (isDuplicate) {
      updateButtonState('saved', 'Already Saved');
      return;
    }

    dictionaryList.push(entryLine);

    chrome.storage.local.set({ savedDictionary: dictionaryList }, () => {
      updateButtonState('saved', '✓ Saved');
    });
  });
}

function updateButtonState(state, text) {
  const button = document.getElementById('sd-save-dictionary-btn');
  if (!button) return;

  if (state === 'saved') {
    button.innerText = text;
    button.style.backgroundColor = '#28a745';
    button.disabled = true;
  } else {
    button.innerText = '💾 Save';
    button.style.backgroundColor = '#0073e6';
    button.disabled = false;
  }
}

function cleanTranslationText(text) {
  if (!text) return '';
  return text.replace(/[\r\n]+/g, ' ').trim();
}

const observer = new MutationObserver((mutations) => {
  const isOurButton = mutations.some(m => 
    m.target && (m.target.id === 'sd-save-dictionary-btn' || m.target.parentNode?.id === 'sd-save-dictionary-btn')
  );
  if (isOurButton) return;

  if (!document.getElementById('sd-save-dictionary-btn')) {
    injectSaveButton();
  }

  const { input: currentInputOnPage } = getPageTranslationData();
  if (currentInputOnPage && currentInputOnPage !== currentTrackedWord) {
    updateButtonState('default');
  }
});

observer.observe(document.body, { childList: true, subtree: true });
injectSaveButton();