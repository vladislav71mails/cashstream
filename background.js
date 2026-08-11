// Фоновый воркер: инициализация состояния при первой установке
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get('csState');
  if (!existing.csState) {
    chrome.storage.local.set({ csState: null }); // shared.js подставит DEFAULT_STATE при первом чтении
  }
});
