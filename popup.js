let sourceLang = 'en';
let targetLang = 'es';
let lastTranslatedPair = { english: '', spanish: '' };

let currentPage = 1;
const itemsPerPage = 5;
let totalEntries = [];

document.addEventListener('DOMContentLoaded', () => {
  const translateInput = document.getElementById('translate-input');
  const translateOutput = document.getElementById('translation-output');
  const translateBtn = document.getElementById('translate-btn');
  const saveBtn = document.getElementById('save-popup-btn');
  const swapBtn = document.getElementById('swap-lang-btn');
  const sourceLabel = document.getElementById('source-lang-label');
  const targetLabel = document.getElementById('target-lang-label');
  
  const historyToggle = document.getElementById('history-toggle');
  const historyDropdown = document.getElementById('history-dropdown');
  const toggleArrow = document.getElementById('toggle-arrow');

  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  const openDashboardBtn = document.getElementById('open-dashboard-btn');

  loadSavedHistory();

  historyToggle.addEventListener('click', () => {
    const isHidden = historyDropdown.style.display === '' || historyDropdown.style.display === 'none';
    historyDropdown.style.display = isHidden ? 'block' : 'none';
    toggleArrow.innerText = isHidden ? '▲' : '▼';
  });

  swapBtn.addEventListener('click', () => {
    const temp = sourceLang;
    sourceLang = targetLang;
    targetLang = temp;

    sourceLabel.innerText = sourceLang === 'en' ? 'English' : 'Spanish';
    targetLabel.innerText = targetLang === 'es' ? 'Spanish' : 'English';
    translateOutput.innerHTML = '<em>Translation output...</em>';
    saveBtn.disabled = true;
  });

  translateBtn.addEventListener('click', performTranslation);
  translateInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      performTranslation();
    }
  });

  async function performTranslation() {
    const text = translateInput.value.trim();
    if (!text) return;

    translateOutput.innerText = 'Translating...';
    saveBtn.disabled = true;

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data && data[0]) {
        const translatedText = data[0].map(item => item[0]).join('');
        translateOutput.innerText = translatedText;

        lastTranslatedPair = {
          english: sourceLang === 'en' ? text : translatedText,
          spanish: sourceLang === 'es' ? text : translatedText
        };

        saveBtn.disabled = false;
        saveBtn.innerText = '💾 Save';
      }
    } catch {
      translateOutput.innerText = 'Translation failed.';
    }
  }

  saveBtn.addEventListener('click', () => {
    if (!lastTranslatedPair.english) return;

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const entryLine = `${lastTranslatedPair.english} - ${lastTranslatedPair.spanish} - ${timestamp}`;

    chrome.storage.local.get(['savedDictionary'], (result) => {
      let list = result.savedDictionary || [];
      const isDuplicate = list.some(entry => entry.toLowerCase().includes(`${lastTranslatedPair.english.toLowerCase()} -`));

      if (isDuplicate) {
        saveBtn.innerText = 'Already Saved';
        saveBtn.disabled = true;
        return;
      }

      list.push(entryLine);
      chrome.storage.local.set({ savedDictionary: list }, () => {
        saveBtn.innerText = '✓ Saved!';
        saveBtn.disabled = true;
        loadSavedHistory();
      });
    });
  });

  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTablePage();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentPage * itemsPerPage < totalEntries.length) {
      currentPage++;
      renderTablePage();
    }
  });

  openDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });
});

function loadSavedHistory() {
  chrome.storage.local.get(['savedDictionary'], (result) => {
    totalEntries = (result.savedDictionary || []).slice().reverse();
    document.getElementById('word-count').innerText = `(${totalEntries.length})`;
    renderTablePage();
  });
}

function renderTablePage() {
  const tableBody = document.getElementById('dictionary-list');
  const pageIndicator = document.getElementById('page-indicator');
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');

  tableBody.innerHTML = '';
  const totalPages = Math.ceil(totalEntries.length / itemsPerPage) || 1;
  pageIndicator.innerText = `Page ${currentPage} of ${totalPages}`;

  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage >= totalPages;

  const start = (currentPage - 1) * itemsPerPage;
  const pageItems = totalEntries.slice(start, start + itemsPerPage);

  pageItems.forEach((entry) => {
    const [english, spanish, rawTimestamp] = entry.split(' - ');
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${escapeHtml(english || '')}</strong></td>
      <td style="color: #0073e6;">${escapeHtml(spanish || '')}</td>
      <td style="color: #6c757d;">${escapeHtml(formatTime(rawTimestamp))}</td>
    `;
    tableBody.appendChild(row);
  });
}

function formatTime(rawTimestamp) {
  if (!rawTimestamp) return '';
  const dateObj = new Date(rawTimestamp.replace(' ', 'T'));
  return isNaN(dateObj) ? rawTimestamp : dateObj.toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}