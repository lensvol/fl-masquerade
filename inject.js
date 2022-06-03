(function () {
    const DONE = 4;
    const EXTENSION_NAME = 'FL Masquerade';

    const GLOBE_BTN_CLASS_LIST = "fa fa-inverse fa-stack-1x fa-pencil";

    const FL_ID_NAMESPACE_START = 778_777_777
    const ADD_PERSONA_STORYLET_ID = FL_ID_NAMESPACE_START;
    const PERSONA_CHANGE_STORYLET_ID = ADD_PERSONA_STORYLET_ID + 1;
    const PERSONA_REDACTION_STORYLET_ID = PERSONA_CHANGE_STORYLET_ID + 100;
    const CHOICE_STORYLET_DESCRIPTION = `
<strong>Here you can switch to one of your other accounts, provided that you logged into them at least once
while the extension was active.</strong>
`;
    let actionCount = 0;
    let maxActions = 20;
    let rememberUser = false;
    let availablePersonas = [];

    function log(message) {
        console.log(`[${EXTENSION_NAME}] ${message}`);
    }

    function debug(message) {
        console.debug(`[${EXTENSION_NAME}] ${message}`);
    }

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

        build() {
            return {
                category: this._category,
                buttonText: this._buttonText,
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

        qualityLocked(boolean_value) {
            this._qualityLocked = boolean_value;
            return this;
        }

        qualityRequirement(req) {
            this._qualityRequirements.push(req);
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

    function createLockForRedactionStorylet(isLocked) {
        return {
            allowedOn: "Character",
            category: "Dreams",
            id: 7_777_777,
            image: "maskrose",
            isCost: false,
            nature: "Thing",
            qualityId: -1,
            qualityName: "Personas Galore",
            status: isLocked ? "Locked" : "Unlocked",
            tooltip: isLocked ? "To remove any personas you have to add them first." :
                "You unlocked this by adding at least 1 additional persona.",
        }

    }

    function createFinishedChangeResponse() {
        return  {
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
        }
    }

    function createFinishedRedactionResponse() {
        return {
            actions: actionCount,
            canChangeOutfit: true,
            endStorylet: {
                rootEventId: PERSONA_REDACTION_STORYLET_ID,
                premiumBenefitsApply: true,
                maxActionsAllowed: maxActions,
                isLinkingEvent: false,
                event: {
                    isInEventUseTree: false,
                    image: "nadirlight",
                    id: PERSONA_REDACTION_STORYLET_ID + 1,
                    frequency: "Always",
                    description: "You forget. You forgot. You will be forgetting... But whom? And why? Yes.",
                    name: "Irrigo Dreaming",
                },
                image: "nadirlight",
                isDirectLinkingEvent: true,
                canGoAgain: false,
                currentActionsRemaining: actionCount,
            },
            isSuccess: true,
            messages: [],
            phase: "End",
        }
    }

    log("Starting injected script.");

    let activeProfiles = new Map();
    let currentUserId = -1;

    function reportLogin(userId, username, token) {
        const event = new CustomEvent("FL_MQ_LoggedIn", {
            detail: {userId: userId, username: username, token: token}
        })
        window.dispatchEvent(event);
    }

    function showModalInput(title, imageURL, label, submitButtonText, contents, description, handler) {
        const containerDiv = document.createElement("div");
        containerDiv.classList.add("modal-dialog__overlay", "modal--share-dialog__overlay", "modal-dialog__overlay--after-open");

        const dialogDiv = document.createElement("div");
        dialogDiv.classList.add("modal-dialog", "media--root", "modal-dialog--after-open");
        dialogDiv.setAttribute("role", "dialog");
        dialogDiv.setAttribute("aria-modal", "true");
        dialogDiv.setAttribute("tabindex", "-1");

        const contentsDiv = document.createElement("div");
        contentsDiv.className = "modal__content";

        const titleHeader = document.createElement("h1");
        titleHeader.classList.add("heading", "heading--1");
        titleHeader.textContent = title;

        const labelHeader = document.createElement("p");
        labelHeader.textContent = label;

        const descriptionText = document.createElement("p");
        descriptionText.className = "descriptive";
        descriptionText.textContent = description;

        const mediaDiv = document.createElement("div");
        mediaDiv.className = "media";
        const mediaLeftDiv = document.createElement("div");
        mediaLeftDiv.className = "media__left";
        const mediaBodyDiv = document.createElement("div");
        mediaBodyDiv.className = "media__body";

        const imageCardDiv = document.createElement("div");
        imageCardDiv.classList.add("card", "card--sm");
        const image = document.createElement("img");
        image.className = "media__object";
        image.setAttribute("src", imageURL);
        image.setAttribute("height", 113);
        image.setAttribute("width", 97);

        const formElement = document.createElement("form");
        formElement.setAttribute("action", "#");

        const editField = document.createElement("p");
        editField.className = "form__group";

        const textInput = document.createElement("input");
        textInput.setAttribute("name", "textInput");
        textInput.setAttribute("id", "textInput");
        textInput.setAttribute("value", contents);
        textInput.className = "form__control";

        const buttonsDiv = document.createElement("div");
        buttonsDiv.style.cssText = "text-align: right";
        const cancelButton = document.createElement("button");
        cancelButton.classList.add("button", "button--primary");
        cancelButton.textContent = "Cancel";
        const submitButton = document.createElement("button");
        submitButton.classList.add("button", "button--primary");
        submitButton.textContent = submitButtonText;

        imageCardDiv.appendChild(image);

        mediaLeftDiv.append(imageCardDiv);
        mediaDiv.appendChild(mediaLeftDiv);
        mediaDiv.appendChild(mediaBodyDiv);

        editField.appendChild(textInput);
        formElement.appendChild(editField);
        formElement.appendChild(descriptionText);

        buttonsDiv.appendChild(cancelButton);
        buttonsDiv.appendChild(submitButton);
        formElement.appendChild(buttonsDiv);

        mediaBodyDiv.appendChild(labelHeader);
        mediaBodyDiv.appendChild(formElement);

        contentsDiv.appendChild(titleHeader);
        contentsDiv.appendChild(mediaDiv);

        dialogDiv.appendChild(contentsDiv);
        containerDiv.appendChild(dialogDiv);
        
        const modalPortals = document.querySelectorAll("div[class='ReactModalPortal']");
        if (modalPortals != null) {
            modalPortals[modalPortals.length - 1].appendChild(containerDiv);
        }

        submitButton.addEventListener("click", () => {
           containerDiv.remove();
           if (handler != null) {
               handler(textInput.value);
           }
        });

        cancelButton.addEventListener("click", () => {
            containerDiv.remove();
        });
    }

    function ensureEditPersonaButtonlet(node) {
        let branches = null;
        if (node.hasAttribute("data-branch-id")) {
            branches = [node];
        } else {
            branches = node.querySelectorAll("div[data-branch-id]");
        }

        for (const branchContainer of branches) {
            const branchId = parseInt(branchContainer.attributes["data-branch-id"].value);

            if (branchId < ADD_PERSONA_STORYLET_ID) {
                continue;
            }

            const branchHeader = branchContainer.querySelector("h2[class*='branch__title'], h2[class*='storylet__heading']");
            if (!branchHeader) {
                continue;
            }

            let existingButtons = branchContainer.getElementsByClassName(GLOBE_BTN_CLASS_LIST);
            if (existingButtons.length > 0) {
                console.debug("Duplicate note buttons found, please tell the developer about it!");
                return;
            }

            const otherButtons = branchContainer.querySelectorAll("div[class*='buttonlet']");
            const container = branchHeader.parentElement;
            if (otherButtons.length > 0) {
                for (const buttonNode of otherButtons) {
                    container.removeChild(buttonNode);
                }
            }

            if (branchId === ADD_PERSONA_STORYLET_ID
                || branchId === PERSONA_REDACTION_STORYLET_ID
                || branchId === PERSONA_CHANGE_STORYLET_ID
            ) {
                continue;
            }

            const branchUserIndex = branchId - PERSONA_CHANGE_STORYLET_ID - 1;
            const userProfile = activeProfiles.get(availablePersonas[branchUserIndex]);

            const editPersonaButton = createButtonlet("pencil", "Make a note on this persona");
            editPersonaButton.addEventListener("click", () => {
                showModalInput(
                    userProfile.name,
                    `https://images.fallenlondon.com/cameos/${userProfile.avatar}.png`,
                    "A few words about this persona:",
                    "Save",
                    userProfile.note !== undefined ? userProfile.note : "",
                    "For example: its current Ambition, unique items (e.g. Ha'Pennies), specific purpose " +
                        "for which it was created.",
                    (personaNote) => {
                        debug(`Note for user: ${userProfile.userId}: ${personaNote}`);

                        const profileTagline = (userProfile.description + "." || "").replace(/(<([^>]+)>)/gi, "");
                        const profileNote = `<br><b>Note:</b> ${personaNote}`;

                        updatePersonaNote(userProfile.userId, personaNote);
                        updatePersonaBranchDescription(userProfile.userId, capitalize(`${profileTagline}${profileNote}`));
                    }
                );
            });
            container.insertBefore(editPersonaButton, container.firstChild);
        }
    }

    function updatePersonaBranchDescription(userId, newDescription) {
        const personaBranchId = PERSONA_CHANGE_STORYLET_ID + availablePersonas.indexOf(userId) + 1;
        const personaDescription = document.querySelector(`div[data-branch-id='${personaBranchId}']  > div[class='media__body branch__body'] > div > p`);
        if (personaDescription == null) {
            debug(`Cannot find branch with ID ${personaBranchId} (${userId}`);
            return;
        }

        personaDescription.innerHTML = newDescription;
    }

    function updatePersonaNote(userId, note) {
        const event = new CustomEvent("FL_MQ_augmentInfo", {
            detail: {userId: userId, note: note}
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

    function removeProfile(userId) {
        const event = new CustomEvent("FL_MQ_removeProfile", {detail: {userId: userId}})
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

        request.responseText = responseText;
        request.readyState = DONE;
        request.status = status;

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
                    setFakeXhrResponse(this, 200, JSON.stringify(createChoiceStorylet()));
                    return this;
                }
            }

            if (this._targetUrl.endsWith("/choosebranch")) {
                const requestData = JSON.parse(arguments[0]);

                if (requestData.branchId === PERSONA_CHANGE_STORYLET_ID) {
                    setFakeXhrResponse(this, 200, JSON.stringify(createChoiceStorylet()));
                    return this;
                }

                if (requestData.branchId === PERSONA_REDACTION_STORYLET_ID) {
                    setFakeXhrResponse(this, 200, JSON.stringify(createRedactionStorylet()));
                    return this;
                }

                if (requestData.branchId === ADD_PERSONA_STORYLET_ID) {
                    clearAuthToken();
                    location.reload(true);
                }

                if (requestData.branchId > PERSONA_CHANGE_STORYLET_ID && requestData.branchId < PERSONA_REDACTION_STORYLET_ID) {
                    const response = createFinishedChangeResponse();

                    setFakeXhrResponse(this, 200, JSON.stringify(response));

                    const requestedUserIndex = requestData.branchId - PERSONA_CHANGE_STORYLET_ID - 1;
                    const requestedUserId = activeProfiles.get(availablePersonas[requestedUserIndex]).userId;

                    log(`Switching to ${requestedUserId}...`);
                    switchToUser(requestedUserId);

                    return this;
                }

                if (requestData.branchId > PERSONA_REDACTION_STORYLET_ID) {
                    const response = createFinishedRedactionResponse();

                    setFakeXhrResponse(this, 200, JSON.stringify(response));

                    const requestedUserIndex = requestData.branchId - PERSONA_REDACTION_STORYLET_ID - 1;
                    const requestedUserId = activeProfiles.get(availablePersonas[requestedUserIndex]).userId;
                    log(`Deleting ${requestedUserId}...`);
                    removeProfile(requestedUserId);

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
            .description("Why do we wear faces, again?")
            .buttonText("DO IT")
            .build()
    }

    function createChoiceStorylet() {
        const profileBranches = [];

        availablePersonas.forEach((k, i) => {
            const profile = activeProfiles.get(k);
            const profileTagline = (profile.description + "." || "").replace(/(<([^>]+)>)/gi, "");
            const profileNote = !profile.note ? "" : `<br><b>Note:</b> ${profile.note}`;

            profileBranches.push(
                new Branch(PERSONA_CHANGE_STORYLET_ID + (i + 1), profile.name || profile.username)
                    .description(`${profileTagline}${profileNote}`)
                    .image(`../cameos/${profile.avatar || "dorian"}`)
                    .buttonText("DO IT")
                    .build()
            )
        });

        profileBranches.push(
            new Branch(ADD_PERSONA_STORYLET_ID, "Add new persona")
                .description("<b><i>Choosing this option will take you to the login screen.</i></b>")
                .image("maskrose")
                .buttonText("ENTER")
                .build()
        )

        profileBranches.push(
            new Branch(PERSONA_REDACTION_STORYLET_ID, "Forget yourself")
                .image("nadirlight")
                .description("<b><i>Choose this to remove one or more personas from the list.</i></b>")
                .buttonText("REDACT")
                .qualityRequirement(createLockForRedactionStorylet(activeProfiles.size === 1))
                .qualityLocked(activeProfiles.size === 1)
                .build()
        );

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

    function createRedactionStorylet() {
        const profileBranches = [];

        availablePersonas.forEach((k, i) => {
            const profile = activeProfiles.get(k);
            const profileTagline = (profile.description || "").replace(/(<([^>]+)>)/gi, "");

            profileBranches.push(
                new Branch(PERSONA_REDACTION_STORYLET_ID + (i + 1), `<del>${profile.name || profile.username}</del>`)
                    .description(`Forget about <b>${profileTagline}</b>...`)
                    .image(`../cameos/${profile.avatar || "dorian"}`)
                    .buttonText("CONSENT")
                    .build()
            );
        });

        const redactionStorylet = new Storylet(PERSONA_REDACTION_STORYLET_ID, "Forget yourself")
            .image("nadirlight")
            .category("Fancy")
            .description("...Wait, what?")
            .teaser("...Wait, what?");

        profileBranches.map(profile => redactionStorylet.addBranch(profile))

        return {
            actions: actionCount,
            canChangeOutfit: true,
            isSuccess: true,
            phase: "In",
            storylet: redactionStorylet.build()
        }
    }

    function createButtonlet(icon, title) {
        const containerDiv = document.createElement("div");
        containerDiv.className = "storylet-root__frequency";

        const buttonlet = document.createElement("button");
        buttonlet.setAttribute("type", "button");
        buttonlet.className = "buttonlet-container";

        const outerSpan = document.createElement("span");
        outerSpan.classList.add("buttonlet", "fa-stack", "fa-lg", "buttonlet-enabled");
        outerSpan.setAttribute("title", title);

        [
            ["fa", "fa-circle", "fa-stack-2x"],
            (GLOBE_BTN_CLASS_LIST + " fa-pencil").split(" "),
            ["u-visually-hidden"]
        ].map(classNames => {
            let span = document.createElement("span");
            span.classList.add(...classNames);
            outerSpan.appendChild(span);
        })

        buttonlet.appendChild(outerSpan);
        containerDiv.appendChild(buttonlet);

        return containerDiv;
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
                log(`Token has been updated for user ${data.user.id}`);

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

                setFakeXhrResponse(this, 200, JSON.stringify(data));
            }

            if (data.phase === "In" && !data.storylet.canGoBack) {
                data.storylet.childBranches.push(createBranchPlaceholder());

                setFakeXhrResponse(this, 200, JSON.stringify(data));
            }
        }
    }

    function clearAuthToken() {
        localStorage.access_token = "";
        sessionStorage.access_token = "";
    }

    function setAuthToken(accessToken, remember = false) {
        if (remember) {
            localStorage.access_token = accessToken;
            sessionStorage.access_token = "";
        } else {
            localStorage.access_token = "";
            sessionStorage.access_token = accessToken;
        }
    }

    window.addEventListener("message", (event) => {
        if (event.data.action === "FL_MQ_switchTo") {
            setAuthToken(event.data.accessToken, rememberUser);

            location.reload(true);
        }

        if (event.data.action === "FL_MQ_listProfiles") {
            activeProfiles = new Map(event.data.profiles);
            availablePersonas = new Array(...activeProfiles.keys()).filter(k => k !== currentUserId);
            availablePersonas.sort();

            debug("Profile data was updated.")
        }
    });

    debug("Setting up API interceptors.");
    XMLHttpRequest.prototype.open = openBypass(XMLHttpRequest.prototype.open);
    XMLHttpRequest.prototype.send = sendBypass(XMLHttpRequest.prototype.send);

    currentToken = localStorage.access_token || sessionStorage.access_token;

    requestProfileList();

    debug("Setting up DOM mutation observer.")
    let mainContentObserver = new MutationObserver(((mutations, observer) => {
        for (let m = 0; m < mutations.length; m++) {
            const mutation = mutations[m];

            for (let n = 0; n < mutation.addedNodes.length; n++) {
                const node = mutation.addedNodes[n];

                if (node.nodeName.toLowerCase() === "input") {
                    log(node);
                    continue;
                }

                if (node.nodeName.toLowerCase() !== "div") {
                    continue;
                }

                ensureEditPersonaButtonlet(node);

                const rememberMeCheckbox = node.querySelector("input[name='rememberMe']");
                if (rememberMeCheckbox != null) {
                    debug(`R: ${rememberUser} ${rememberMeCheckbox.checked}`);
                    rememberUser = rememberMeCheckbox.checked;
                    rememberMeCheckbox.addEventListener('change', (event) => {
                        rememberUser = event.currentTarget.checked;
                        debug(`${rememberUser} ${event.currentTarget.checked}`)
                    });
                }
            }
        }
    }));
    mainContentObserver.observe(document, {childList: true, subtree: true});
}())