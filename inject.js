(function () {
    const DONE = 4;

    console.log("[FL Masquerade] Starting injected script.");

    function reportLogin(userId, username, token) {
        let event = new CustomEvent("FL_MQ_LoggedIn", {
            detail: {userId: userId, username: username, token: token}
        })
        window.dispatchEvent(event);
    }

    function openBypass(original_function) {
        return function (method, url, async) {
            this._targetUrl = url;
            this.addEventListener("readystatechange", parseResponse);
            return original_function.apply(this, arguments);
        };
    }

    function sendBypass(original_function) {
        return function (body) {
            if (this._targetUrl.endsWith("/logout")) {
                this.status = 200;
                this.responseText = '{"isSuccess": true}';
                this.readyState = DONE;
                return this;
            }

            return original_function.apply(this, arguments);
        };
    }

    function parseResponse(response) {
        if (this.readyState !== DONE) {
            return;
        }

        let targetUrl = response.currentTarget.responseURL;
        if (targetUrl.endsWith("/api/login")) {
            let data = JSON.parse(response.target.responseText);

            reportLogin(data.user.id, data.user.name, data.jwt);
        }
    }

    window.addEventListener("message", (event) => {
        if(event.data.action === "FL_MQ_switchTo") {
            localStorage.access_token = event.data.accessToken;
            location.reload(true);
        }
    });

    console.debug("[FL Masquerade] Setting up API interceptors.");
    XMLHttpRequest.prototype.open = openBypass(XMLHttpRequest.prototype.open);
    XMLHttpRequest.prototype.send = sendBypass(XMLHttpRequest.prototype.send);
    //XMLHttpRequest.prototype.setRequestHeader = installAuthSniffer(XMLHttpRequest.prototype.setRequestHeader);
}())