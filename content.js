let host = null;
let bestVoice = null;
const MAX_CHARS = 500;

function removePopup() {
  if (host) { host.remove(); host = null; }
}

function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const english = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
  const prefer = [
    v => /natural/i.test(v.name) && /en-US/i.test(v.lang),
    v => /natural/i.test(v.name),
    v => /google us english/i.test(v.name),
    v => /google/i.test(v.name),
    v => /(aria|jenny|guy|zira|david)/i.test(v.name),
    v => /en-US/i.test(v.lang)
  ];
  for (const test of prefer) {
    const found = english.find(test);
    if (found) return found;
  }
  return english[0] || null;
}

try {
  window.speechSynthesis.onvoiceschanged = () => { bestVoice = pickVoice(); };
} catch (err) {}

function speak(text) {
  try {
    window.speechSynthesis.cancel();
    if (!bestVoice) bestVoice = pickVoice();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    if (bestVoice) utter.voice = bestVoice;
    utter.rate = text.length > 40 ? 0.9 : 0.8;
    utter.pitch = 1;
    utter.volume = 1;
    window.speechSynthesis.speak(utter);
  } catch (err) {}
}

function makeEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

const STYLE = `
  .box { background:#1e1e2e; color:#fff; padding:10px 14px; border-radius:10px;
         box-shadow:0 4px 16px rgba(0,0,0,.35); font-family:Arial,sans-serif; }
  .top { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:6px; }
  .word { font-size:13px; color:#9aa0b4; max-height:80px; overflow-y:auto; line-height:1.4; }
  .speak { background:transparent; border:none; cursor:pointer; font-size:18px; padding:0; line-height:1; flex-shrink:0; }
  .meaning { font-size:17px; font-weight:bold; margin-bottom:8px; max-height:200px; overflow-y:auto; line-height:1.5; }
  .save { background:#4f8cff; color:#fff; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:13px; }
  .save:disabled { background:#555a6e; cursor:default; }
`;

function safeSend(message, callback) {
  try {
    chrome.runtime.sendMessage(message, (res) => {
      if (chrome.runtime.lastError) { callback(null); return; }
      callback(res);
    });
  } catch (err) {
    callback(null);
  }
}

function showPopup(text, rect) {
  removePopup();

  const isLong = text.length > 40;
  const width = isLong ? 380 : 280;

  host = document.createElement('div');
  host.style.cssText = 'position:fixed; z-index:2147483647; width:' + width + 'px; top:' +
    Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 260)) + 'px; left:' +
    Math.max(8, Math.min(rect.left, window.innerWidth - width - 20)) + 'px;';
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = STYLE;

  const box = makeEl('div', 'box');
  const top = makeEl('div', 'top');
  const wordEl = makeEl('span', 'word', text);
  const speakBtn = makeEl('button', 'speak', '\uD83D\uDD0A');
  speakBtn.addEventListener('click', () => speak(text));
  top.appendChild(wordEl);
  top.appendChild(speakBtn);

  const meaningEl = makeEl('div', 'meaning', 'Loading...');
  const saveBtn = makeEl('button', 'save', 'Save');
  saveBtn.disabled = true;

  box.appendChild(top);
  box.appendChild(meaningEl);
  box.appendChild(saveBtn);
  shadow.appendChild(style);
  shadow.appendChild(box);
  document.documentElement.appendChild(host);

  safeSend({ type: 'translate', word: text }, (res) => {
    if (!res || !res.ok) {
      meaningEl.textContent = 'Could not translate. Reload this page and try again.';
      return;
    }
    meaningEl.textContent = res.meaning;
    saveBtn.disabled = false;

    saveBtn.addEventListener('click', () => {
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;
      safeSend(
        { type: 'save', word: text, meaning: res.meaning, page: location.href },
        (r) => {
          if (r && r.ok && r.result === 'duplicate') saveBtn.textContent = 'Already saved today';
          else if (r && r.ok) saveBtn.textContent = 'Saved';
          else { saveBtn.textContent = 'Error, try again'; saveBtn.disabled = false; }
        }
      );
    });
  });
}

function checkSelection() {
  const selection = window.getSelection();
  const text = selection ? selection.toString().replace(/\s+/g, ' ').trim() : '';
  if (!text || text.length > MAX_CHARS || selection.rangeCount === 0) {
    return false;
  }
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  showPopup(text, rect);
  return true;
}

document.addEventListener('mouseup', (e) => {
  if (host && e.composedPath().includes(host)) return;
  setTimeout(() => {
    if (!checkSelection()) removePopup();
  }, 20);
}, true);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') removePopup();
  if (e.altKey && (e.key === 'w' || e.key === 'W' || e.code === 'KeyW')) {
    e.preventDefault();
    checkSelection();
  }
}, true);