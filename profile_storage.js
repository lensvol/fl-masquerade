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

    addProfile(userId, username, token) {
        const userRecord = {};
        userRecord[`profile_${userId}`] = {
            userId: userId,
            username: username,
            token: token,
        };

        this.profiles.set(userId, userRecord[`profile_${userId}`]);
        
        chrome.storage.local.set(userRecord, () => console.debug(`Saved token for ${username} (${userId})`));
    }

    listProfiles() {
        return this.profiles
    }
}