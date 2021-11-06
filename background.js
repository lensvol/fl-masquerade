const profileStorage = new ProfileStorage();

function reportProfilesList(tabId) {
    profileStorage.loadProfiles().then(() => {
        const result = {
            action: "FL_MQ_listProfiles",
            // https://stackoverflow.com/questions/55301808/send-a-map-to-content-script
            profiles: [...profileStorage.listProfiles()],
        };
        chrome.tabs.sendMessage(tabId, result);
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log(request);
    if (request.action === "FL_MQ_LoggedIn") {
        profileStorage.addProfile(request.userId, request.username, request.token);
        reportProfilesList(sender.tab.id);
    }

    if (request.action === "FL_MQ_augmentInfo") {
        profileStorage.augmentProfile(request.userId, {
            name: request.name,
            avatar: request.avatar,
            description: request.description,
        });
        reportProfilesList(sender.tab.id);
    }

    if (request.action === "FL_MQ_listProfiles") {
        reportProfilesList(sender.tab.id);
    }

    if (request.action === "FL_MQ_switchTo") {
        const requestedProfile = profileStorage.getProfile(request.userId);

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

profileStorage.loadProfiles().then(() => console.debug("[FL Masquerade] Loaded profiles in background script"));