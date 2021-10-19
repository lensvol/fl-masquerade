function getTokens() {
    return new Promise(((resolve, reject) => {
        chrome.storage.local.get(null, (results) => {
            const tokensList = [];

            for (const key in results) {
                if (key.startsWith("profile_")) {
                    const storedToken = results[key].token;
                    tokensList.push(storedToken);
                }
            }

            resolve(tokensList);
        })
    }))
}

let currentInd = 0;

chrome.browserAction.onClicked.addListener((tab) => {
    chrome.tabs.query({active: true, currentWindow: true, url: "*://*.fallenlondon.com/*"}, function(tabs) {
        if(tabs.length === 0) {
            return;
        }

        const activeTabId = tabs[0].id;

        getTokens().then(tokens => {
            console.log("Trying to switch profiles...");
            currentInd = (currentInd + 1) % tokens.length;

            chrome.tabs.sendMessage(activeTabId, {action: "FL_MQ_switchTo", accessToken: tokens[currentInd]});
        });
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "FL_MQ_LoggedIn") {
            const userRecord = {};
            userRecord[`profile_${request.userId}`] = {
                username: request.username,
                token: request.token,
            };

            chrome.storage.local.set(userRecord, () => console.debug(`Saved token ${request.token} for ${request.userId}`));
        }
    }
)