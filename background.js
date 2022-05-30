const PROFILE_PREFIX = "profile_";

class ProfileStorage {
    constructor() {
        this.profiles = new Map();
    }

    loadProfiles() {
        return new Promise(((resolve, reject) => {
            chrome.storage.local.get(null, (results) => {
                for (const key in results) {
                    if (key.startsWith(PROFILE_PREFIX)) {
                        const userId = parseInt(key.substring(PROFILE_PREFIX.length).trim());
                        console.debug(`[FL Masquerade] Loading data for ${userId}`)
                        this.profiles.set(userId, results[key]);
                    }
                }

                resolve(this.profiles);
            })
        }))
    }

    getProfile(userId) {
        return this.profiles.get(userId);
    }

    removeProfile(userId) {
        if (this.profiles.has(userId)) {
            this.profiles.delete(userId);
            chrome.storage.local.remove(`profile_${userId}`);
            return true;
        }
        return false;
    }

    addProfile(userId, username, token) {
        const userRecord = {};
        userRecord[`profile_${userId}`] = {
            userId: userId,
            username: username,
            token: token,
        };

        this.profiles.set(userId, userRecord[`profile_${userId}`]);
        chrome.storage.local.set(userRecord, () => console.debug(`Added user ${username} (${userId})`));
    }

    augmentProfile(userId, information) {
        const userRecord = {};
        userRecord[`profile_${userId}`] = {
            ...this.getProfile(userId),
            ...information,
        };

        this.profiles.set(userId, userRecord[`profile_${userId}`]);
        chrome.storage.local.set(userRecord, () => console.debug(`Augmented user ${userId} with `, information));
    }

    listProfiles() {
        return this.profiles
    }
}

const profileStorage = new ProfileStorage();
const REFRESH_INTERVAL = 3;
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
    token.header = JSON.parse(atob(t.split('.')[0]));
    token.payload = JSON.parse(atob(t.split('.')[1]));
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
                    resolve(tabs);
                }
            );
        });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    profileStorage.loadProfiles().then(() => {
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
            chrome.tabs.query({active: true, currentWindow: true, url: "*://*.fallenlondon.com/*"}, function (tabs) {
                if (tabs.length === 0) {
                    return;
                }

                const activeTabId = tabs[0].id;
                console.debug(`[FL Masquerade] Switching tab ${activeTabId} to ${requestedProfile.username}`);
                chrome.tabs.sendMessage(activeTabId, {action: "FL_MQ_switchTo", accessToken: requestedProfile.token});
            });
        }
    })
});

profileStorage.loadProfiles().then(() => {
    console.debug("[FL Masquerade] Loaded profiles in background script");
    refreshProfileTokens();
});

chrome.alarms.create("flTokenRefreshment", { periodInMinutes: REFRESH_INTERVAL });

chrome.alarms.onAlarm.addListener(() => {
    console.debug("[FL Masquerade] Starting to refresh FL API tokens...");
    refreshProfileTokens();
});