/*
   Licensed under the Apache License v2.0.
            
   A copy of which can be found at the root of this distrubution in 
   the file LICENSE-2.0 or at http://www.apache.org/licenses/LICENSE-2.0
*/

/**
 * @file modules/select.js
 * @description Document content selection module.
 * Enables interactive selection of DOM elements when commencing page speed-reading,
 * or reads highlighted/selected text fragments directly from both HTML pages and PDFs.
 */

(function (window) {

  var jetzt  = window.jetzt
    , H      = jetzt.helpers;

  // Tiny wrapper to bind an event to the window
  function on (event, cb) {
    window.addEventListener(event, cb);
  }

  // Tiny wrapper to unbind an event from the window
  function off (event, cb) {
    window.removeEventListener(event, cb);
  }

  /**
   * Enters the interactive DOM node pointer mode. Hovering over paragraphs or blocks
   * highlights them using overlays. Clicking a hovered section parses and reads it.
   */
  function selectMode () {
    var selection = [];
    var previousElement = null;

    /**
     * Renders overlays over targeted selected nodes in the viewport.
     */
    var showSelection = function () {

      overlays = [];

      for (var i=0, len=selection.length; i < len; i++) {
        if (!jetzt.view.addOverlay(selection[i])) {
          break;
        }
      }
    };

    /**
     * Clears previous visual overlays and highlights a new set of nodes.
     * @param {HTMLElement[]} sel Collection of DOM nodes.
     */
    var setSelection = function (sel) {
      jetzt.view.removeAllOverlays();
      selection = sel;
      showSelection();
    };

    // Valid parent elements containing multi-line content flows
    var validParents = {
      "DIV": true,
      "ARTICLE": true,
      "BLOCKQUOTE": true,
      "MAIN": true,
      "SECTION": true,
      "UL": true,
      "OL": true,
      "DL": true
    };

    // Valid child text element tags
    var validChildren = {
      "P": true,
      "H1": true,
      "H2": true,
      "H3": true,
      "H4": true,
      "H5": true,
      "H6": true,
      "SPAN": true,
      "DL": true,
      "OL": true,
      "UL": true,
      "BLOCKQUOTE": true,
      "SECTION": true
    };

    /**
     * Helper to select adjacent siblings in parent blocks (e.g. adjacent paragraphs in an article/div).
     * @param {HTMLElement} el The seed/active element.
     * @returns {HTMLElement[]} Sibling tags.
     */
    var selectSiblings = function (el) {
      var firstChild = el;
      var parent = el.parentNode;
      while (parent && !validParents[parent.tagName]) {
        firstChild = parent;
        parent = firstChild.parentNode;

      }

      if (parent) {
        var kids = parent.childNodes
          , len = kids.length
          , result = []
          , i = 0;

          while (kids[i] !== firstChild) i++;

          for (; i < len; i++) {
            var kid = kids[i];
            if (validChildren[kid.tagName]) {
              result.push(kid);
            }
          }

          return result;

      } else {
        return [el];
      }
    };

    /**
     * Exits DOM node pointer mode, cleaning up mouse/key listeners and overlays.
     */
    var stop = function () {
      jetzt.view.removeAllOverlays();
      off("mouseover", mouseoverHandler);
      off("mousemove", moveHandler);
      off("keydown", keydownHandler);
      off("keyup", keyupHandler);
      off("click", clickHandler);
      previousElement && H.removeClass(previousElement, "sr-pointer");
    };

    /**
     * Handles pointer hovering events. Highlighting siblings of target nodes unless user is holding Alt.
     */
    var mouseoverHandler = function (ev) {
      previousElement && H.removeClass(previousElement, "sr-pointer");

      H.addClass(ev.target, "sr-pointer");

      previousElement = ev.target;

      if (ev.altKey) {
        setSelection([ev.target]);
      } else {
        setSelection(selectSiblings(ev.target));
      }
    };

    /**
     * Handles mouse pointer clicks. Commences RSVP reading on selected targets.
     */
    var clickHandler = function (ev) {
      stop();
      jetzt.init(jetzt.parse.dom(selection), selection);
    };

    /**
     * Triggered on mouse movements to re-establish hover monitoring.
     */
    var moveHandler = function (ev) {
      mouseoverHandler(ev);
      off("mousemove", moveHandler);
    };

    /**
     * Monitors special navigation keystrokes during selection (Escape key exits selectMode).
     */
    var keydownHandler = function (ev) {
      if (ev.keyCode === 27) {
        stop();
      } else if (ev.altKey && selection.length > 1) {
        setSelection([selection[0]]);
      }
    };

    /**
     * Restores sibling highlight sets if pressing/releasing modifiers like Alt.
     */
    var keyupHandler = function (ev) {
      if (!ev.altKey && selection.length === 1) {
        setSelection(selectSiblings(selection[0]));
      }
    };

    on("mouseover", mouseoverHandler);
    on("click", clickHandler);
    on("mousemove", moveHandler);
    on("keydown", keydownHandler);
    on("keyup", keyupHandler);
  }


  function initMobileSelectionBubble() {
    var bubble = document.createElement("div");
    bubble.className = "sr-mobile-selection-bubble";
    
    var btnSelect = document.createElement("button");
    btnSelect.className = "sr-bubble-btn";
    btnSelect.innerHTML = "&#9654; Ler Seleção";

    var divider = document.createElement("div");
    divider.className = "sr-bubble-divider";

    var btnPara = document.createElement("button");
    btnPara.className = "sr-bubble-btn";
    btnPara.innerHTML = "&#9654; Ler Parágrafo";

    bubble.appendChild(btnSelect);
    bubble.appendChild(divider);
    bubble.appendChild(btnPara);

    document.body.appendChild(bubble);

    var selectionTimeout = null;

    var lastSelectedText = "";
    var lastSelectedElem = null;

    function hideBubble() {
      bubble.classList.remove("visible");
      bubble.style.display = "none";
    }

    function showBubbleAt(rect) {
      bubble.style.display = "flex";
      // Force layout/reflow
      bubble.offsetWidth; 
      bubble.classList.add("visible");
    }

    function checkSelection() {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        hideBubble();
        return;
      }

      var text = sel.toString().trim();
      if (text.length === 0) {
        hideBubble();
        return;
      }

      lastSelectedText = text;
      lastSelectedElem = null;
      if (sel.anchorNode) {
        var node = sel.anchorNode;
        lastSelectedElem = node.nodeType === 1 ? node : node.parentNode;
      }

      try {
        var range = sel.getRangeAt(0);
        var rect = range.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          showBubbleAt(rect);
        } else {
          hideBubble();
        }
      } catch (e) {
        hideBubble();
      }
    }

    document.addEventListener("selectionchange", function () {
      if (selectionTimeout) clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(checkSelection, 300);
    });

    document.addEventListener("mousedown", function (e) {
      if (e.target !== bubble && !bubble.contains(e.target)) {
        setTimeout(function () {
          var sel = window.getSelection();
          if (!sel || sel.isCollapsed) {
            hideBubble();
          }
        }, 50);
      }
    });

    document.addEventListener("touchstart", function (e) {
      if (e.target !== bubble && !bubble.contains(e.target)) {
        setTimeout(function () {
          var sel = window.getSelection();
          if (!sel || sel.isCollapsed) {
            hideBubble();
          }
        }, 50);
      }
    });

    var triggered = false;
    function triggerSpeedReadSelection(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (triggered) return;
      triggered = true;
      setTimeout(function () { triggered = false; }, 400);

      var textToRead = lastSelectedText;
      var elemToRead = lastSelectedElem;

      if (!textToRead) {
        var sel = window.getSelection();
        if (sel) {
          textToRead = sel.toString().trim();
          if (sel.anchorNode) {
            var node = sel.anchorNode;
            elemToRead = node.nodeType === 1 ? node : node.parentNode;
          }
        }
      }

      if (textToRead && textToRead.length > 0) {
        jetzt.init(jetzt.parse.string(textToRead), elemToRead ? [elemToRead] : null);
        var activeSel = window.getSelection();
        if (activeSel) {
          activeSel.removeAllRanges();
        }
      }

      lastSelectedText = "";
      lastSelectedElem = null;
      hideBubble();
    }

    function triggerSpeedReadParagraph(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (triggered) return;
      triggered = true;
      setTimeout(function () { triggered = false; }, 400);

      var elemToRead = lastSelectedElem;
      if (!elemToRead) {
        var sel = window.getSelection();
        if (sel && sel.anchorNode) {
          var node = sel.anchorNode;
          elemToRead = node.nodeType === 1 ? node : node.parentNode;
        }
      }

      if (elemToRead) {
        var paragraphElem = elemToRead;
        while (paragraphElem && paragraphElem.tagName !== "P" && 
               paragraphElem.tagName !== "DIV" && 
               paragraphElem.tagName !== "BLOCKQUOTE" && 
               paragraphElem.tagName !== "LI" && 
               paragraphElem.tagName !== "TD" && 
               paragraphElem.tagName !== "TH" && 
               paragraphElem.tagName !== "ARTICLE" && 
               paragraphElem.tagName !== "SECTION" && 
               paragraphElem.tagName !== "BODY") {
          paragraphElem = paragraphElem.parentNode;
        }

        var targetElem = (paragraphElem && paragraphElem.tagName !== "BODY") ? paragraphElem : elemToRead;
        jetzt.init(jetzt.parse.dom(targetElem), [targetElem]);
        var activeSel = window.getSelection();
        if (activeSel) {
          activeSel.removeAllRanges();
        }
      }

      lastSelectedText = "";
      lastSelectedElem = null;
      hideBubble();
    }

    btnSelect.addEventListener("click", triggerSpeedReadSelection);
    btnSelect.addEventListener("touchend", triggerSpeedReadSelection);
    btnSelect.addEventListener("touchstart", function (e) {
      e.preventDefault();
      e.stopPropagation();
    });

    btnPara.addEventListener("click", triggerSpeedReadParagraph);
    btnPara.addEventListener("touchend", triggerSpeedReadParagraph);
    btnPara.addEventListener("touchstart", function (e) {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    initMobileSelectionBubble();
  } else {
    document.addEventListener("DOMContentLoaded", initMobileSelectionBubble);
  }

  /**
   * Entry gate point to now speed-read. If any highlight exists on screen,
   * it grabs that. Otherwise, prompts the interactive select pointer mode.
   * @param {object} [contextData] Optional background/extension invocation payload.
   */
  jetzt.select = function (contextData) {
    var text;
    var anchorNode = null;
    if (contextData === undefined) {
      var sel = window.getSelection();
      text = sel.toString();
      anchorNode = sel.anchorNode;
    } else {
      text = contextData.selectionText;
      var sel = window.getSelection();
      if (sel) {
        anchorNode = sel.anchorNode;
      }
    }
    if (text && text.trim().length > 0) {
      var elem = null;
      if (anchorNode) {
        elem = anchorNode.nodeType === 1 ? anchorNode : anchorNode.parentNode;
      }
      jetzt.init(jetzt.parse.string(text), elem ? [elem] : null);
      if (window.getSelection()) {
        window.getSelection().removeAllRanges();
      }
    } else {
      selectMode();
    }
  };

})(this);


