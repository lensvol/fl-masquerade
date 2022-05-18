(function () {
    const DONE = 4;
    const PERSONA_CHANGE_STORYLET_ID = 777_777_777;
    const ADD_PERSONA_STORYLET_ID = 777_777_776;
    const CHOICE_STORYLET_DESCRIPTION = `
<strong>Here you can switch to one of your other accounts, provided that you logged into them at least once
while the extension was active.</strong>
`;
    let actionCount = 0;
    let maxActions = 20;

    class Storylet {
        constructor(storyletId, name) {
            this._category = "";
            this._name = name;
            this._image = "questionsmall";
            this._description = "";
            this._id = storyletId;
            this._qualityRequirements = [];
            this._teaser = "";
            this._buttonText = "GO";
            this._branches = [];
            this._isLocked = false;
            this._canGoBack = true;
        }

        category(name) {
            this._category = name;
            return this;
        }

        canGoBack(boolean_value) {
            this._canGoBack = true;
        }

        isLocked(boolean_value) {
            this._isLocked = boolean_value;
            return this;
        }

        buttonText(text) {
            this._buttonText = text;
            return this;
        }

        teaser(text) {
            this._teaser = text;
            return this;
        }

        description(text) {
            this._description = text;
            return this;
        }

        image(imageId) {
            this._image = imageId;
            return this;
        }

        addBranch(branch) {
            this._branches.push(branch)
            return this;
        }

        buildEntrypoint() {
            return {
                category: this._category,
                buttonText: this._buttonText,
                name: this._name,
                id: this._id,
                image: this._image,
                qualityRequirements: this._qualityRequirements,
                teaser: this._teaser,
            }
        }

        build() {
            return {
                childBranches: this._branches,
                description: this._description,
                distribution: 0,
                frequency: "Always",
                id: this._id,
                image: this._image,
                isInEventUseTree: false,
                isLocked: this._isLocked,
                canGoBack: this._canGoBack,
                name: this._name,
                qualityRequirements: [],
                teaser: this._teaser,
                urgency: "Normal",
            }
        }
    }

    class Branch {
        constructor(branchId, name) {
            this.branchId = branchId;
            this.name = name;
            this._image = "questionsmall";
            this._description = "";
            this._actionCost = 0;
            this._actionLocked = false;
            this._challenges = [];
            this._currencyCost = 0;
            this._currencyLocked = false;
            this._isLocked = false;
            this._ordering = 0;
            this._qualityLocked = false;
            this._qualityRequirements = [];
            this._buttonText = "GO";
            return this;
        }

        description(text) {
            this._description = text;
            return this;
        }

        isLocked(boolean_value) {
            this._isLocked = boolean_value;
            return this;
        }

        buttonText(text) {
            this._buttonText = text;
            return this;
        }

        image(imageId) {
            this._image = imageId;
            return this;
        }

        build() {
            return {
                name: this.name,
                description: capitalize(this._description),
                actionCost: this._actionCost,
                actionLocked: this._actionLocked,
                challenges: this._challenges,
                currencyCost: this._currencyCost,
                currencyLocked: this._currencyLocked,
                id: this.branchId,
                image: this._image,
                isLocked: this._isLocked,
                ordering: this._ordering,
                buttonText: this._buttonText,
                planKey: "1234567890abcdefghijklmnopqrstuv",
                qualityLocked: this._qualityLocked,
                qualityRequirements: this._qualityRequirements,
            }
        }
    }

    console.log("[FL Masquerade] Starting injected script.");

    let activeProfiles = new Map();
    let currentUserId = -1;

    function reportLogin(userId, username, token) {
        const event = new CustomEvent("FL_MQ_LoggedIn", {
            detail: {userId: userId, username: username, token: token}
        })
        window.dispatchEvent(event);
    }

    function reportAdditionalInfo(userId, name, description, avatar) {
        const event = new CustomEvent("FL_MQ_augmentInfo", {
            detail: {userId: userId, name: name, description: description, avatar: avatar}
        })
        window.dispatchEvent(event);
    }

    function reportUpdatedToken(userId, newToken) {
        const event = new CustomEvent("FL_MQ_augmentInfo", {
            detail: {userId: userId, token: newToken}
        })
        window.dispatchEvent(event);
    }

    function requestProfileList() {
        const event = new CustomEvent("FL_MQ_listProfiles", {})
        window.dispatchEvent(event);
    }

    function switchToUser(userId) {
        const event = new CustomEvent("FL_MQ_switchTo", {detail: {userId: userId}})
        window.dispatchEvent(event);
    }

    function openBypass(original_function) {
        return function (method, url, async) {
            this._targetUrl = url;
            this.addEventListener("readystatechange", parseResponse);
            return original_function.apply(this, arguments);
        };
    }

    function setFakeXhrResponse(request, status, responseText) {
        Object.defineProperty(request, 'responseText', {writable: true});
        Object.defineProperty(request, 'readyState', {writable: true});
        Object.defineProperty(request, 'status', {writable: true});

        request.responseText = JSON.stringify(createChoiceStorylet([]));
        request.readyState = DONE;
        request.status = 200;

        request.onreadystatechange();
    }

    function sendBypass(original_function) {
        return function (body) {
            if (this._targetUrl.endsWith("/logout")) {
                setFakeXhrResponse(this, 200, '{"isSuccess": true}');
                return this;
            }

            if (this._targetUrl.endsWith("/begin")) {
                const requestData = JSON.parse(arguments[0]);
                if (requestData.eventId === PERSONA_CHANGE_STORYLET_ID) {
                    setFakeXhrResponse(this, 200, JSON.stringify(createChoiceStorylet([])));
                    return this;
                }
            }

            if (this._targetUrl.endsWith("/choosebranch")) {
                const requestData = JSON.parse(arguments[0]);
                if (requestData.branchId === PERSONA_CHANGE_STORYLET_ID) {
                    setFakeXhrResponse(this, 200, JSON.stringify(createChoiceStorylet()));

                    return this;
                }

                if (requestData.branchId === ADD_PERSONA_STORYLET_ID) {
                    localStorage.access_token = "";
                    location.reload(true);
                }

                if (requestData.branchId > PERSONA_CHANGE_STORYLET_ID) {
                    const response = {
                        actions: actionCount,
                        canChangeOutfit: true,
                        endStorylet: {
                            rootEventId: PERSONA_CHANGE_STORYLET_ID,
                            premiumBenefitsApply: true,
                            maxActionsAllowed: maxActions,
                            isLinkingEvent: false,
                            event: {
                                isInEventUseTree: false,
                                image: "maskrose",
                                id: PERSONA_CHANGE_STORYLET_ID + 1,
                                frequency: "Always",
                                description: "And now, you wait.",
                                name: "Why We Wear Faces",
                            },
                            image: "masktanned",
                            isDirectLinkingEvent: true,
                            canGoAgain: false,
                            currentActionsRemaining: actionCount,
                        },
                        isSuccess: true,
                        messages: [],
                        phase: "End",
                    };

                    setFakeXhrResponse(this, 200, JSON.stringify(response));

                    const requestedUserId = requestData.branchId - PERSONA_CHANGE_STORYLET_ID;
                    console.log(`Switching to ${requestedUserId}...`);
                    switchToUser(requestedUserId);

                    return this;
                }
            }

            return original_function.apply(this, arguments);
        };
    }

    function capitalize(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    function createStoryletPlaceholder() {
        return new Storylet(PERSONA_CHANGE_STORYLET_ID, "Become Someone Completely Different")
            .image("maskrose")
            .buttonText("DO IT")
            .category("Fancy")
            .teaser("Why do we wear faces, again?")
            .build()
    }

    function createBranchPlaceholder() {
        return new Branch(PERSONA_CHANGE_STORYLET_ID, "Become Someone Completely Different")
            .image("maskrose")
            .buttonText("DO IT")
    }

    function createChoiceStorylet(profiles) {
        const profileBranches = [];

        for (let k of activeProfiles.keys()) {
            if (k === currentUserId) {
                continue;
            }

            const profile = activeProfiles.get(k);

            const profileTagline = (profile.description || "").replace(/(<([^>]+)>)/gi, "");

            profileBranches.push(
                new Branch(PERSONA_CHANGE_STORYLET_ID + k, profile.name || profile.username)
                    .description(profileTagline)
                    .image(`../cameos/${profile.avatar || "dorian"}`)
                    .buttonText("DO IT")
                    .build()
            )
        }

        profileBranches.push(
            new Branch(ADD_PERSONA_STORYLET_ID, "Add new persona")
                .description("<b><i>Choosing this option will take you to the login screen.</i></b>")
                .image("maskrose")
                .buttonText("ENTER")
                .build()
        )

        const choiceStorylet = new Storylet(PERSONA_CHANGE_STORYLET_ID, "Become Someone Completely Different")
            .image("maskrose")
            .category("Fancy")
            .description(CHOICE_STORYLET_DESCRIPTION)
            .teaser("Why do we wear faces, again?");

        profileBranches.map(profile => choiceStorylet.addBranch(profile))

        return {
            actions: actionCount,
            canChangeOutfit: true,
            isSuccess: true,
            phase: "In",
            storylet: choiceStorylet.build()
        }
    }

    function parseResponse(response) {
        if (this.readyState !== DONE) {
            return;
        }

        let targetUrl = response.currentTarget.responseURL;
        if (targetUrl.endsWith("/api/login")) {
            const data = JSON.parse(response.target.responseText);

            reportLogin(data.user.id, data.user.name, data.jwt);
        }

        if (targetUrl.endsWith("/api/character/actions")) {
            const data = JSON.parse(response.target.responseText);

            actionCount = data.actions;
            maxActions = data.actionBankSize;
        }

        if (targetUrl.endsWith("/api/login/user")) {
            const data = JSON.parse(response.target.responseText);
            if (data.jwt !== currentToken) {
                console.log(`[FL Masquerade] Token has been updated for user ${data.user.id}`);
                currentToken = data.jwt;
                reportUpdatedToken(data.user.id, data.jwt);
            }
        }

        if (targetUrl.endsWith("/api/character/myself")) {
            const data = JSON.parse(response.target.responseText);
            const ch = data.character;

            currentUserId = ch.user.id;

            reportAdditionalInfo(ch.user.id, ch.name, ch.descriptiveText, ch.avatarImage);
        }

        if (targetUrl.endsWith("/api/storylet") || targetUrl.endsWith("/api/storylet/goback")) {
            const data = JSON.parse(response.target.responseText);
            if (data.phase === "Available") {
                data.storylets.push(createStoryletPlaceholder())

                Object.defineProperty(this, 'responseText', {writable: true});
                this.responseText = JSON.stringify(data);
            }

            if (data.phase === "In" && !data.storylet.canGoBack) {
                data.storylet.childBranches.push(createBranchPlaceholder());
                Object.defineProperty(this, 'responseText', {writable: true});
                this.responseText = JSON.stringify(data);
            }
        }
    }

    window.addEventListener("message", (event) => {
        if (event.data.action === "FL_MQ_switchTo") {
            localStorage.access_token = event.data.accessToken;
            location.reload(true);
        }

        if (event.data.action === "FL_MQ_listProfiles") {
            activeProfiles = new Map(event.data.profiles);
            console.debug("Profile data was updated.")
        }
    });

    console.debug("[FL Masquerade] Setting up API interceptors.");
    XMLHttpRequest.prototype.open = openBypass(XMLHttpRequest.prototype.open);
    XMLHttpRequest.prototype.send = sendBypass(XMLHttpRequest.prototype.send);

    currentToken = localStorage.access_token || sessionStorage.access_token;

    requestProfileList();
}())