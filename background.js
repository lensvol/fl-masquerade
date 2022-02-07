const profileStorage = new ProfileStorage();
const REFRESH_INTERVAL = 60;

function reportProfilesList(tabIds) {
    profileStorage.loadProfiles().then(() => {
        const result = {
            action: "FL_MQ_listProfiles",
            // https://stackoverflow.com/questions/55301808/send-a-map-to-content-script
            profiles: [...profileStorage.listProfiles()],
        };
        for (let tabId of tabIds) {
            chrome.tabs.sendMessage(tabId, result);
        }
    });
}

function refreshProfileTokens() {
    profileStorage.loadProfiles().then(() => {
        let profiles = profileStorage.listProfiles();

        let promises = [];

        for (let k of profiles.keys()) {
            const profile = profiles.get(k);

            promises.push(
                fetch(
                    "https://api.fallenlondon.com/api/login/user",
                    {
                        method: "GET",
                        headers: {"Authorization": `Bearer ${profile.token}`}
                    }
                )
                .then(response => response.json())
            );
        }

        Promise
            .allSettled(promises)
            .then((responses) => {
                for (let json of responses) {
                    // TODO: Error handling
                    let newToken = json.value.jwt;
                    console.log(`Exchanged token for ${json.value.user.name}: ${newToken}`);

                    profileStorage.augmentProfile(json.value.user.id, {token: newToken});
                }

                getFallenLondonTabs().then(tabs => reportProfilesList(tabs));
            });
    });
}

function getFallenLondonTabs() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query(
            {currentWindow: true, url: "*://*.fallenlondon.com/*"},
            function(tabs) { resolve(tabs); });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log(request);
    if (request.action === "FL_MQ_LoggedIn") {
        profileStorage.addProfile(request.userId, request.username, request.token);
        reportProfilesList([sender.tab.id]);
    }

    if (request.action === "FL_MQ_augmentInfo") {
        profileStorage.augmentProfile(request.userId, request);
        reportProfilesList([sender.tab.id]);
    }

    if (request.action === "FL_MQ_listProfiles") {
        reportProfilesList([sender.tab.id]);
    }

    if (request.action === "FL_MQ_switchTo") {
        const requestedProfile = profileStorage.getProfile(request.userId);

        // TODO: Reimplement via getFallenLondonTabs
        chrome.tabs.query({active: true, currentWindow: true, url: "*://*.fallenlondon.com/*"}, function(tabs) {
            if(tabs.length === 0) {
                return;
            }

            const activeTabId = tabs[0].id;
            console.debug(`[FL Masquerade] Switching tab ${activeTabId} to ${requestedProfile.username}`);
            chrome.tabs.sendMessage(activeTabId, {action: "FL_MQ_switchTo", accessToken: requestedProfile.token});
        });
    }
});

profileStorage.loadProfiles().then(() => {
    console.debug("[FL Masquerade] Loaded profiles in background script");
    refreshProfileTokens();
});

setInterval(refreshProfileTokens, 1000 * 60 * REFRESH_INTERVAL);

