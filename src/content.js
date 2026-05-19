(async () => {
    // Dynamic import for content scripts using ES Modules
    const src = chrome.runtime.getURL("src/main.js");
    const contentMain = await import(src);
    // Pass the chrome API to the module because dynamic imports lose access to it!
    contentMain.init(chrome);
})();
