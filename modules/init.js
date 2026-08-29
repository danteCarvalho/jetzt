/*
   Licensed under the Apache License v2.0.
            
   A copy of which can be found at the root of this distrubution in 
   the file LICENSE-2.0 or at http://www.apache.org/licenses/LICENSE-2.0
*/

(function (window) {
  var jetzt  = window.jetzt
    , reader = jetzt.view.reader;


  /*** state ***/
  var executor;

  // Holds reference to the currently parsed DOM element(s) to allow contiguous sibling traversal
  jetzt.currentSelection = null;

  function getReadableElements() {
    var query = 'p, h1, h2, h3, h4, h5, h6, blockquote, li, td, th, section, article, div';
    var matches = document.querySelectorAll(query);
    var result = [];
    for (var i = 0; i < matches.length; i++) {
      var el = matches[i];
      // Filter out elements that are empty, invisible, or inside script/style/nav tags
      var tagName = el.tagName.toUpperCase();
      if (tagName !== 'SCRIPT' && tagName !== 'STYLE' && tagName !== 'NAV' && tagName !== 'NOSCRIPT' && tagName !== 'HEAD') {
        if (el.textContent && el.textContent.trim().length > 0) {
          var rect = el.getBoundingClientRect();
          var isVisible = el.offsetWidth > 0 || el.offsetHeight > 0 || (rect && (rect.width > 0 || rect.height > 0));
          if (isVisible) {
            // Also ensure it's not a generic wrapping container that contains other matching child block elements
            var hasBlockChildren = el.querySelector('p, h1, h2, h3, h4, h5, h6, blockquote, li');
            if (!hasBlockChildren) {
              result.push(el);
            }
          }
        }
      }
    }
    return result;
  }

  function findNextParagraphElement(el) {
    var all = getReadableElements();
    var idx = all.indexOf(el);
    if (idx !== -1 && idx < all.length - 1) {
      return all[idx + 1];
    }
    // Fallback: if our element is not directly in the list, see if any list element contains it
    for (var i = 0; i < all.length; i++) {
      if (all[i].contains(el)) {
        if (i < all.length - 1) {
          return all[i + 1];
        }
      } else if (el.contains(all[i])) {
        // If our current selection is a parent containing readable items, get the next one after the last contained item
        if (i > idx) {
          idx = i;
        }
      }
    }
    if (idx !== -1 && idx < all.length - 1) {
      return all[idx + 1];
    }
    return null;
  }

  function findPrevParagraphElement(el) {
    var all = getReadableElements();
    var idx = all.indexOf(el);
    if (idx !== -1 && idx > 0) {
      return all[idx - 1];
    }
    // Fallback: if our element is not directly in the list, see if any list element contains it
    for (var i = 0; i < all.length; i++) {
      if (all[i].contains(el)) {
        if (i > 0) {
          return all[i - 1];
        }
      } else if (el.contains(all[i])) {
        // Find the first contained index
        if (idx === -1 || i < idx) {
          idx = i;
        }
      }
    }
    if (idx > 0) {
      return all[idx - 1];
    }
    return null;
  }

  jetzt.init = function (instructions, elements) {
    if (executor) throw new Error("jetzt already initialised");

    jetzt.currentSelection = elements || null;

    reader.clear();
    executor = jetzt.exec(instructions);
    jetzt.executor = executor;
    jetzt.control.keyboard(executor);

    reader.show();
    reader.onBackdropClick(jetzt.quit);

    setTimeout(function () { executor.start(); }, 500);
  };

  /**
   * Resets and replaces the source instructions using visual cross-fade and bleep highlights.
   * Ensures uninterrupted reader rendering.
   */
  jetzt.loadNewSource = function (instructions, elements) {
    if (executor) {
      executor.destroy();
      executor = null;
      jetzt.executor = null;
    }
    reader.clear();
    executor = jetzt.exec(instructions);
    jetzt.executor = executor;
    jetzt.control.keyboard(executor);
    
    jetzt.currentSelection = elements || null;

    setTimeout(function () { executor.start(); }, 300);
  };

  /**
   * Searches the document DOM hierarchy for the next sibling paragraph-like container 
   * and commences speed-reading on it.
   * @returns {boolean} True if a next element was successfully retrieved and loaded.
   */
  jetzt.loadNextParagraph = function () {
    if (!jetzt.currentSelection || jetzt.currentSelection.length === 0) {
      return false;
    }
    var lastEl = jetzt.currentSelection[jetzt.currentSelection.length - 1];
    var nextEl = findNextParagraphElement(lastEl);
    if (nextEl) {
      jetzt.view.removeAllOverlays();
      jetzt.view.addOverlay(nextEl);
      
      // Smoothly scroll the window/document to align the next active paragraph in the center of the viewport
      if (typeof nextEl.scrollIntoView === "function") {
        nextEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      setTimeout(function () {
        jetzt.view.removeAllOverlays();
      }, 800);

      var newInstructions = jetzt.parse.dom(nextEl);
      jetzt.loadNewSource(newInstructions, [nextEl]);
      return true;
    }
    return false;
  };

  /**
   * Searches the document DOM hierarchy for the previous sibling paragraph-like container 
   * and commences speed-reading on it.
   * @returns {boolean} True if a previous element was successfully retrieved and loaded.
   */
  jetzt.loadPrevParagraph = function () {
    if (!jetzt.currentSelection || jetzt.currentSelection.length === 0) {
      return false;
    }
    var firstEl = jetzt.currentSelection[0];
    var prevEl = findPrevParagraphElement(firstEl);
    if (prevEl) {
      jetzt.view.removeAllOverlays();
      jetzt.view.addOverlay(prevEl);

      // Smoothly scroll the window/document to align the previous active paragraph in the center of the viewport
      if (typeof prevEl.scrollIntoView === "function") {
        prevEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      setTimeout(function () {
        jetzt.view.removeAllOverlays();
      }, 800);

      var newInstructions = jetzt.parse.dom(prevEl);
      jetzt.loadNewSource(newInstructions, [prevEl]);
      return true;
    }
    return false;
  };

  jetzt.quit = function () {
    if (executor) {
      if (typeof executor.destroy === "function") {
        executor.destroy();
      } else {
        executor.stop();
      }
    }
    reader.hide();
    executor = null;
    jetzt.executor = null;
    jetzt.currentSelection = null;
  };

  jetzt.isOpen = function () {
    return !!executor;
  };

})(this);
