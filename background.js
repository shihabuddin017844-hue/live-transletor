const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby6v-xB5ZY8CG0nGxzgMAo23Wci0yeJUxfamMAXsaZ4Ftutm3BNsmYNg7S-lIebjRql/exec';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'translate') {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=bn&dt=t&q=' + encodeURIComponent(msg.word);
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const meaning = data[0].map(part => part[0]).join('');
        sendResponse({ ok: true, meaning });
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === 'save') {
    fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ word: msg.word, meaning: msg.meaning, page: msg.page })
    })
      .then(r => r.text())
      .then(text => sendResponse({ ok: true, result: text }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
});