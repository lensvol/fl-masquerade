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
    if (message.action === "FL_MQ_switchTo") {
        sendToPage(
            "FL_MQ_switchTo",
            {
                accessToken: message.accessToken
            }
        )
    }
})

window.addEventListener("FL_MQ_LoggedIn", (event) => {
    chrome.runtime.sendMessage({
        action: "FL_MQ_LoggedIn",
        userId: event.detail.userId,
        username: event.detail.username,
        token: event.detail.token
    });
});