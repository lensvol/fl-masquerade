class TrackPlayer {
    constructor() {
        this.profiles = new Map();
    }

    loadProfiles() {
        return new Promise(((resolve, reject) => {
            chrome.storage.local.get(null, (results) => {
                for (const key in results) {
                    if (key.startsWith("profile_")) {
                        const profileId = parseInt(key.substring(7).trim());
                        console.debug(`[FL Masquerade] Loading data for ${profileId}`)
                        this.profiles.set(profileId, results[key]);
                    }
                }

                resolve(this.profiles);
            })
        }))
    }
}