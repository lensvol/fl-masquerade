console.log("[FL Genius Loci] Content script started.");

const s = document.createElement('script');
s.src = chrome.runtime.getURL('inject.js');
s.onload = function () {
    this.remove();
};
(document.head || document.documentElement).appendChild(s);

function sendToPage(action, detail) {
    window.postMessage({
        action: action,
        ...detail
    }, "https://www.fallenlondon.com");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message.action) return;

    if (!message.action.startsWith("FL_MQ_")) return;

    sendToPage(message.action, message);
});

["FL_MQ_LoggedIn", "FL_MQ_switchTo", "FL_MQ_listProfiles"].forEach((eventType) => {
    window.addEventListener(eventType, (event) => {
        chrome.runtime.sendMessage({
            action: eventType,
            ...event.detail,
        })
    });
});
