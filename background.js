const profileStorage = new ProfileStorage();
const REFRESH_INTERVAL = 60;
const EXPIRATION_THRESHOLD = 8 * 60 * 60;

function reportProfilesList(tabs) {
    profileStorage.loadProfiles().then(() => {
        const result = {
            action: "FL_MQ_listProfiles",
            // https://stackoverflow.com/questions/55301808/send-a-map-to-content-script
            profiles: [...profileStorage.listProfiles()],
        };
        tabs.map((t) => chrome.tabs.sendMessage(t.id, result))
    });
}

// Taken from https://stackoverflow.com/a/47115113
function jwtDecode(t) {
    let token = {};
    token.raw = t;
    token.header = JSON.parse(window.atob(t.split('.')[0]));
    token.payload = JSON.parse(window.atob(t.split('.')[1]));
    return (token)
}

function refreshProfileTokens() {
    profileStorage.loadProfiles().then(() => {
        let profiles = profileStorage.listProfiles();

        let promises = [];

        for (let k of profiles.keys()) {
            const profile = profiles.get(k);
            const tokenInfo = jwtDecode(profile.token);
            const nowInSecs = Math.round(new Date().getTime() / 1000);

            if (tokenInfo.payload.exp - nowInSecs > EXPIRATION_THRESHOLD) {
                console.debug(`Skipping ${profile.userId}: too fresh (${tokenInfo.payload.exp - nowInSecs} > ${EXPIRATION_THRESHOLD})`)
                continue;
            }

            console.debug(`Queueing ${profile.userId} for token refresh...`);

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
        chrome.windows.getCurrent(w => {
            chrome.tabs.query(
                {windowId: w.id, url: "*://*.fallenlondon.com/*"},
                function (tabs) {
                    console.log(`Tabs: ${tabs}`);
                    resolve(tabs);
                }
            );
        });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log(request);
    if (request.action === "FL_MQ_LoggedIn") {
        profileStorage.addProfile(request.userId, request.username, request.token);
        reportProfilesList([sender.tab]);
    }

    if (request.action === "FL_MQ_augmentInfo") {
        profileStorage.augmentProfile(request.userId, request);
        reportProfilesList([sender.tab]);
    }

    if (request.action === "FL_MQ_listProfiles") {
        reportProfilesList([sender.tab]);
    }

    if (request.action === "FL_MQ_removeProfile") {
        const requestedProfile = profileStorage.getProfile(request.userId);
        if (requestedProfile != null) {
            console.debug(`[FL Masquerade] Removing profile with ID ${request.userId} from storage...`)
            profileStorage.removeProfile(requestedProfile.userId);
        } else {
            console.debug(`[FL Masquerade] Attempt to remove deleted profile ${request.userId}!`)
        }

        getFallenLondonTabs().then(tabs => {
            reportProfilesList(tabs)
        });
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

