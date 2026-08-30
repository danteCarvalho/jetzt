/**
 * @file background.js
 * @description Background script for the Jetzt Chrome/Firefox extension.
 * Responsible for handling global extension events, such as web browser action clicks
 * (clicking the extension icon) and native context menu interactions. On trigger, it 
 * injects or invokes the content script to initialize speed-reading on the active page.
 */

// Use global chrome / self object or extension api reference
var actionApi = typeof chrome !== 'undefined' && chrome.action ? chrome.action : (typeof browser !== 'undefined' && browser.action ? browser.action : null);
var scriptingApi = typeof chrome !== 'undefined' && chrome.scripting ? chrome.scripting : (typeof browser !== 'undefined' && browser.scripting ? browser.scripting : null);

if (!actionApi && typeof chrome !== 'undefined' && chrome.browserAction) {
  actionApi = chrome.browserAction;
}

// Event listener for the extension's browser action button (toolbar icon click)
if (actionApi && actionApi.onClicked) {
  actionApi.onClicked.addListener(function(tab) {
    console.log('Speed-reading in ' + tab.url);
    if (scriptingApi) {
      scriptingApi.executeScript({
        target: { tabId: tab.id },
        func: function() {
          if (document.jetzt && typeof document.jetzt.select === 'function') {
            document.jetzt.select();
          }
        }
      });
    } else if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.executeScript) {
      chrome.tabs.executeScript(null, {
        code: 'document.jetzt.select()'
      });
    }
  });
}

// Create a context menu option to allow users to speed-read selected text directly
if (typeof chrome !== 'undefined' && chrome.contextMenus) {
  // Clear any existing menu items first to avoid duplicate ID errors during service worker restart
  chrome.contextMenus.removeAll(function() {
    chrome.contextMenus.create({
      "id": "jetztMenu"
      ,"title": "Speed-read this with Jetzt"
      ,"contexts": [
        "selection"
      ]
    });
  });
}

// Event listener for context menu item clicks
if (typeof chrome !== 'undefined' && chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener(function(data, tab) {
    if (data.menuItemId === 'jetztMenu') {
      if (scriptingApi) {
        scriptingApi.executeScript({
          target: { tabId: tab.id },
          func: function(selectionData) {
            if (document.jetzt && typeof document.jetzt.select === 'function') {
              document.jetzt.select(selectionData);
            }
          },
          args: [data.selectionText ? data : null]
        });
      } else if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.executeScript) {
        chrome.tabs.executeScript(null, {
          code: data.selectionText ? 'document.jetzt.select(' + JSON.stringify(data) + ')' : 'document.jetzt.select()'
        });
      }
    }
  });
}
