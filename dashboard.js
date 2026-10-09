let sourceLang = 'en';
let targetLang = 'es';
let lastTranslatedPair = { english: '', spanish: '' };

let currentPage = 1;
const itemsPerPage = 100;
let rawEntries = [];
let filteredEntries = [];

document.addEventListener('DOMContentLoaded', () => {
  const translateInput = document.getElementById('translate-input');
  const translateOutput = document.getElementById('translation-output');
  const translateBtn = document.getElementById('translate-btn');
  const saveBtn = document.getElementById('save-btn');
  const swapBtn = document.getElementById('swap-lang-btn');
  const sourceLabel = document.getElementById('source-lang-label');
  const targetLabel = document.getElementById('target-lang-label');
  const exportAnkiBtn = document.getElementById('export-anki-btn');

  const startDateInput = document.getElementById('start-date');
  const endDateInput = document.getElementById('end-date');
  const resetFilterBtn = document.getElementById('reset-filter-btn');

  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');

  loadSavedHistory();

  startDateInput.addEventListener('change', applyDateFilter);
  endDateInput.addEventListener('change', applyDateFilter);
  resetFilterBtn.addEventListener('click', () => {
    startDateInput.value = '';
    endDateInput.value = '';
    applyDateFilter();
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
        saveBtn.innerText = '💾 Save to Dictionary';
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

  exportAnkiBtn.addEventListener('click', generateAnkiExportFile);

  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTablePage();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentPage * itemsPerPage < filteredEntries.length) {
      currentPage++;
      renderTablePage();
    }
  });
});

function loadSavedHistory() {
  chrome.storage.local.get(['savedDictionary'], (result) => {
    rawEntries = (result.savedDictionary || []).slice().reverse();
    applyDateFilter();
  });
}

function applyDateFilter() {
  const startDateVal = document.getElementById('start-date').value;
  const endDateVal = document.getElementById('end-date').value;

  const startMs = startDateVal ? new Date(`${startDateVal}T00:00:00`).getTime() : -Infinity;
  const endMs = endDateVal ? new Date(`${endDateVal}T23:59:59`).getTime() : Infinity;

  filteredEntries = rawEntries.filter(entry => {
    const parts = entry.split(' - ');
    const rawTime = parts[2] ? parts[2].trim() : '';

    if (!rawTime) return true;

    const entryMs = new Date(rawTime.replace(' ', 'T')).getTime();
    if (isNaN(entryMs)) return true;

    return entryMs >= startMs && entryMs <= endMs;
  });

  document.getElementById('word-count').innerText = `${filteredEntries.length} words shown (${rawEntries.length} total)`;
  currentPage = 1;
  renderTablePage();
}

function renderTablePage() {
  const tableBody = document.getElementById('dictionary-list');
  const pageIndicator = document.getElementById('page-indicator');
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');

  tableBody.innerHTML = '';
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage) || 1;
  pageIndicator.innerText = `Page ${currentPage} of ${totalPages}`;

  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage >= totalPages;

  const start = (currentPage - 1) * itemsPerPage;
  const pageItems = filteredEntries.slice(start, start + itemsPerPage);

  pageItems.forEach((entry) => {
    const [english, spanish, rawTimestamp] = entry.split(' - ');
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${escapeHtml(english || '')}</strong></td>
      <td style="color: #0073e6; font-weight: 500;">${escapeHtml(spanish || '')}</td>
      <td style="color: #6c757d;">${escapeHtml(formatTime(rawTimestamp))}</td>
    `;
    tableBody.appendChild(row);
  });
}

function formatTime(rawTimestamp) {
  if (!rawTimestamp) return '';
  const dateObj = new Date(rawTimestamp.replace(' ', 'T'));
  return isNaN(dateObj) ? rawTimestamp : dateObj.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

async function generateAnkiExportFile() {
  if (filteredEntries.length === 0) {
    alert('No words match the selected date range to export!');
    return;
  }

  let fileContent = '#separator:tab\n#html:true\n';

  filteredEntries.forEach(entry => {
    const parts = entry.split(' - ');
    const english = parts[0] ? parts[0].trim() : '';
    const spanish = parts[1] ? parts[1].trim() : '';

    if (english && spanish) {
      fileContent += `${english}\t${spanish}\n`;
    }
  });

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'Spanish_Anki_Import.txt',
      types: [{
        description: 'Anki Import Text File',
        accept: { 'text/plain': ['.txt'] }
      }]
    });

    const writable = await handle.createWritable();
    await writable.write(fileContent);
    await writable.close();

  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Anki export error:', err);
    }
  }
}