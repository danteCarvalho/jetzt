/*
   Licensed under the Apache License v2.0.
            
   A copy of which can be found at the root of this distrubution in 
   the file LICENSE-2.0 or at http://www.apache.org/licenses/LICENSE-2.0
*/

/**
 * @file modules/control.js
 * @description Input control and keyboard binding system for Jetzt.
 * Hooks keystroke events to execute visual reading adjustments like pausing, speed changes,
 * jumping across sentences/paragraphs, scaling the reader, and switching color themes.
 */

(function (window) {

  var jetzt = window.jetzt
    , H = jetzt.helpers
    , config = jetzt.config
    , control = {};

  jetzt.control = control;

  /**
   * Prevents browser default behavior and stops event cascading.
   * @param {Event} ev Keyboard/interaction event
   */
  function killEvent (ev) {
    ev.preventDefault();
    ev.stopImmediatePropagation();
  }

  /**
   * Binds custom keystrokes to an action executor instance when reader view is active.
   * Key mappings:
   *  - Escape: Quits Teraz/Jetzt.
   *  - Arrow Up / Down: Increases / decreases words per minute.
   *  - Arrow Left / Right: Rewinds or advances sentences (or paragraphs with Alt).
   *  - Space: Pauses/Resumes reading.
   *  - Plus / Minus: Adjusts user scale size.
   *  - 0: Switches between Light and Dark mode.
   *  - Slash / Question Mark: Toggles meta statistical messages.
   * @param {object} executor Active execution/rendering handle.
   */
  control.keyboard = function (executor) {
    jetzt.view.reader.onKeyDown(function (ev) {
      if(ev.ctrlKey || ev.metaKey) {
        return;
      }

      // handle custom keybindings eventually
      switch (ev.keyCode) {
        case 27: //esc
          killEvent(ev);
          jetzt.quit();
          break;
        case 38: //up
          killEvent(ev);
          config.adjustWPM(+10);
          break;
        case 40: //down
          killEvent(ev);
          config.adjustWPM(-10);
          break;
        case 37: //left
          killEvent(ev);
          if (typeof executor.isAtStart === "function" && executor.isAtStart()) {
            if (typeof jetzt.loadPrevParagraph === "function" && jetzt.loadPrevParagraph()) {
              break;
            }
          }
          if (ev.altKey) executor.prevParagraph();
          else executor.prevSentence();
          break;
        case 39: //right
          killEvent(ev);
          if (typeof executor.isAtEnd === "function" && executor.isAtEnd()) {
            if (typeof jetzt.loadNextParagraph === "function" && jetzt.loadNextParagraph()) {
              break;
            }
          }
          if (ev.altKey) executor.nextParagraph();
          else executor.nextSentence();
          break;
        case 32: //space
          killEvent(ev);
          executor.toggleRunning();
          break;
        case 187: // =/+ (MSIE, Safari, Chrome)
        case 107: // =/+ (Firefox, numpad)
        case 61: // =/+ (Firefox, Opera)
          killEvent(ev);
          config.adjustScale(0.1);
          break;
        case 109: // -/_ (numpad, Opera, Firefox)
        case 189: // -/_ (MSIE, Safari, Chrome)
        case 173: // -/_ (Firefox)
          killEvent(ev);
          config.adjustScale(-0.1);
          break;
        case 48: //0 key, for changing the theme
          killEvent(ev);
          config("dark", !config("dark"));
          break;
        case 86: //v / V key, for toggling TTS voice reading
          killEvent(ev);
          var nowEnabled = !config("tts_enabled");
          config("tts_enabled", nowEnabled);
          jetzt.view.reader.setMessage("Voz: " + (nowEnabled ? "Ativada" : "Desativada"));
          break;
        case 191: // / and ?
          killEvent(ev);
          config("show_message", !config("show_message"));
          break;
      }

    });
  };

  // Global window shortcut. Holding Alt + S initiates Jetzt selection mode.
  window.addEventListener("keydown", function (ev) {
    if (!jetzt.isOpen() && ev.altKey && ev.keyCode === 83) {
      ev.preventDefault();
      jetzt.select();
    }
  });

})(this);
