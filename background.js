/**
 * @file background.js
 * @description Background script for the Jetzt Chrome/Firefox extension.
 * Responsible for handling global extension events, such as web browser action clicks
 * (clicking the extension icon) and native context menu interactions. On trigger, it 
 * injects or invokes the content script to initialize speed-reading on the active page.
 */

// Event listener for the extension's browser action button (toolbar icon click)
chrome.browserAction.onClicked.addListener(function(tab) {
  console.log('Speed-reading in ' + tab.url);
  // Triggers the selection module of jetzt on the active page
  chrome.tabs.executeScript(null,{
    code: 'document.jetzt.select()'
  });
});

// Create a context menu option to allow users to speed-read selected text directly
chrome.contextMenus.create({
	"id": "jetztMenu"
	,"title": "Speed-read this with Jetzt"
	,"contexts": [
		"selection"
	]
});

// Event listener for context menu item clicks
chrome.contextMenus.onClicked.addListener(function(data) {
  if (data.menuItemId == 'jetztMenu') {
    // Note: document.getSelection() may not work properly with PDFs.
    // data.selectionText is used as a workaround to extract the selected string.
    chrome.tabs.executeScript(null,{
        code: data.selectionText ? 'document.jetzt.select(' + JSON.stringify(data) + ')' : 'document.jetzt.select()'
    });
  }
});
