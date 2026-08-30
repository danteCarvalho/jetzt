/*
   Licensed under the Apache License v2.0.

   A copy of which can be found at the root of this distrubution in
   the file LICENSE-2.0 or at http://www.apache.org/licenses/LICENSE-2.0
*/

(function (window) {

  var jetzt = window.jetzt
    , config = jetzt.config
    , H = jetzt.helpers
    , div = H.div
    , span = H.span
    , view = {};

  jetzt.view = view;

  // calculate the focal character index
  function calculatePivot (word) {
    var l = word.length;
    if (l < 2) {
      return 0;
    } else if (l < 6) {
      return 1;
    } else if (l < 10) {
      return 2;
    } else if (l < 14) {
      return 3;
    } else {
      return 4;
    }
  }


  function Reader () {
    // elements
    var backdrop = div("sr-backdrop")
      , wpm = div("sr-wpm")
      , leftWrap = div("sr-wrap sr-left")
      , rightWrap = div("sr-wrap sr-right")
      , leftWord = span()
      , rightWord = span()
      , pivotChar = span("sr-pivot")
      , decorator = span("sr-decorator")
      , word = div("sr-word", [leftWord, pivotChar, rightWord, decorator])

      , progressBar = div("sr-progress")
      , message = div("sr-message")
      , reticle = div("sr-reticle")
      , langSelect = (function () {
          var sel = H.elem("select", "sr-lang-select");
          var langs = [
            { code: "auto", name: "Globo (Auto)" },
            { code: "pt",   name: "PT (Português)" },
            { code: "en",   name: "EN (English)" },
            { code: "es",   name: "ES (Español)" },
            { code: "fr",   name: "FR (Français)" },
            { code: "it",   name: "IT (Italiano)" },
            { code: "de",   name: "DE (Deutsch)" }
          ];
          langs.forEach(function (lang) {
            var opt = document.createElement("option");
            opt.value = lang.code;
            opt.textContent = lang.name;
            sel.appendChild(opt);
          });
          sel.onchange = function () {
            config("tts_lang", sel.value);
            grabFocus();
          };
          sel.onkeydown = sel.onkeyup = sel.onkeypress = function (ev) {
            ev.stopPropagation();
          };
          return sel;
        })()
      , wordBox = div("sr-word-box", [
          reticle, progressBar, message, word, wpm, langSelect
        ])
      , box = div("sr-reader", [
          leftWrap,
          wordBox,
          rightWrap
        ]);

    var mobileControls = null;
    var btnPlayPause = null;
    var isFirefox = /Firefox/i.test(navigator.userAgent);
    var isChrome = /Chrome|Chromium|CriOS/i.test(navigator.userAgent) || /Safari/i.test(navigator.userAgent) || /Edge/i.test(navigator.userAgent);
    if (H.isMobile() || isFirefox || isChrome) {
      var btnPrev = H.elem("button", "sr-mobile-btn sr-mobile-prev");
      btnPrev.innerHTML = "&#9664;"; // left arrow symbol: ◀
      btnPrev.title = "Voltar";
      btnPrev.onclick = function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var executor = jetzt.executor;
        if (executor) {
          if (typeof executor.isAtStart === "function" && executor.isAtStart()) {
            if (typeof jetzt.loadPrevParagraph === "function") {
              jetzt.loadPrevParagraph();
            }
          } else {
            executor.prevSentence();
          }
        }
        grabFocus();
      };
      btnPrev.onmousedown = function (e) { e.preventDefault(); };

      var btnDecSpeed = H.elem("button", "sr-mobile-btn sr-mobile-dec-speed");
      btnDecSpeed.innerHTML = "- Vel";
      btnDecSpeed.onclick = function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        config.adjustWPM(-10);
        grabFocus();
      };
      btnDecSpeed.onmousedown = function (e) { e.preventDefault(); };

      btnPlayPause = H.elem("button", "sr-mobile-btn sr-mobile-play-pause");
      btnPlayPause.innerHTML = "&#9654; Iniciar"; // Default starting state
      btnPlayPause.onclick = function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var executor = jetzt.executor;
        if (executor) {
          executor.toggleRunning();
        }
        grabFocus();
      };
      btnPlayPause.onmousedown = function (e) { e.preventDefault(); };

      var btnIncSpeed = H.elem("button", "sr-mobile-btn sr-mobile-inc-speed");
      btnIncSpeed.innerHTML = "+ Vel";
      btnIncSpeed.onclick = function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        config.adjustWPM(+10);
        grabFocus();
      };
      btnIncSpeed.onmousedown = function (e) { e.preventDefault(); };

      var btnNext = H.elem("button", "sr-mobile-btn sr-mobile-next");
      btnNext.innerHTML = "&#9654;"; // right arrow symbol: ▶
      btnNext.title = "Avançar";
      btnNext.onclick = function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var executor = jetzt.executor;
        if (executor) {
          if (typeof executor.isAtEnd === "function" && executor.isAtEnd()) {
            if (typeof jetzt.loadNextParagraph === "function") {
              jetzt.loadNextParagraph();
            }
          } else {
            executor.nextSentence();
          }
        }
        grabFocus();
      };
      btnNext.onmousedown = function (e) { e.preventDefault(); };

      mobileControls = div("sr-mobile-controls", [
        btnPrev,
        btnDecSpeed,
        btnPlayPause,
        btnIncSpeed,
        btnNext
      ]);
      mobileControls.onmousedown = function (e) {
        e.preventDefault();
      };
    }

    var paragraphControls = null;
    if (H.isMobile() || isFirefox || isChrome) {
      var btnPrevPara = H.elem("button", "sr-mobile-btn sr-para-btn sr-para-prev");
      btnPrevPara.innerHTML = "&#10094;&#10094; Voltar Parágrafo";
      btnPrevPara.title = "Voltar Parágrafo";
      btnPrevPara.onclick = function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (typeof jetzt.loadPrevParagraph === "function" && jetzt.loadPrevParagraph()) {
          grabFocus();
          return;
        }
        var executor = jetzt.executor;
        if (executor && typeof executor.prevParagraph === "function") {
          executor.prevParagraph();
        }
        grabFocus();
      };
      btnPrevPara.onmousedown = function (e) { e.preventDefault(); };

      var btnNextPara = H.elem("button", "sr-mobile-btn sr-para-btn sr-para-next");
      btnNextPara.innerHTML = "Próximo Parágrafo &#10095;&#10095;";
      btnNextPara.title = "Próximo Parágrafo";
      btnNextPara.onclick = function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (typeof jetzt.loadNextParagraph === "function" && jetzt.loadNextParagraph()) {
          grabFocus();
          return;
        }
        var executor = jetzt.executor;
        if (executor && typeof executor.nextParagraph === "function") {
          executor.nextParagraph();
        }
        grabFocus();
      };
      btnNextPara.onmousedown = function (e) { e.preventDefault(); };

      paragraphControls = div("sr-mobile-paragraph-controls", [
        btnPrevPara,
        btnNextPara
      ]);
      paragraphControls.onmousedown = function (e) {
        e.preventDefault();
      };
    }

    var wrapperContents = [box];
    if (mobileControls) {
      wrapperContents.unshift(mobileControls);
    }
    if (paragraphControls) {
      wrapperContents.push(paragraphControls);
    }
    var wrapper = div("sr-reader-wrapper", wrapperContents)
      , unlisten;

    this.onPlayStateChange = function (running) {
      if (btnPlayPause) {
        if (running) {
          btnPlayPause.innerHTML = "&#9208; Parar";
        } else {
          btnPlayPause.innerHTML = "&#9654; Iniciar";
        }
      }
    };

    box.onkeyup = box.onkeypress = function (ev) {
      if(!ev.ctrlKey && !ev.metaKey) {
        ev.stopImmediatePropagation();
        return false;
      }
    };


    var grabFocus = function () {
    	box.tabIndex = 0; // make sure this element can have focus
    	box.focus();
    };

    this.onBackdropClick = function (cb) {
      backdrop.onclick = cb;
    };

    this.onKeyDown = function (cb) {
    	box.onkeydown = cb;
    };

    this.dark = false;

    this.applyConfig = function () {
      // initialise custom size/wpm
      this.dark = config("dark");

      this.applyTheme(config.getSelectedTheme());

      this.setScale(config("scale"));
      this.setWPM(config("target_wpm"));
      this.setFont(config("font_family"));
      this.setFontWeight(config("font_weight"));

      langSelect.value = config("tts_lang") || "auto";

      if (config("show_message")) {
        this.showMessage();
      } else {
        this.hideMessage();
      }
    };

    this.appendTo = function (elem) {
      // fade in backdrop
      elem.appendChild(backdrop);

      // pull down box;
      elem.appendChild(wrapper);
      wrapper.offsetWidth;
      H.addClass(wrapper, "in");
    };

    this.watchConfig = function () {
      var that = this;
      unlisten = config.onChange(function () { that.applyConfig(); });
    };

    this.unwatchConfig = function () {
      unlisten && unlisten();
    };

    this.show = function (cb) {
      this.appendTo(document.body);

      // apply and listen to config;
      this.applyConfig();
      this.watchConfig();

      // need to stop the input focus from scrolling the page up.
      var scrollTop = H.getScrollTop();
      grabFocus();
      document.body.scrollTop = scrollTop;
      document.documentElement.scrollTop = scrollTop;

      box.onblur = grabFocus;
      window.onfocus = function() {
        setTimeout(grabFocus, 100);
      }

      typeof cb === 'function' && window.setTimeout(cb, 340);
    };


    this.hide = function (cb) {
      unlisten();
      box.onblur = null;
      box.blur();
      backdrop.style.opacity = 0;
      H.removeClass(wrapper, "in");
      window.setTimeout(function () {
        backdrop.remove();
        wrapper.remove();
        typeof cb === 'function' && cb();
      }, 340);
    };

    this.setScale = function (scale) {
      wrapper.style.webkitTransform = "translate(-50%, -50%) scale("+scale+")";
      wrapper.style.mozTransform = "translate(-50%, -50%) scale("+scale+")";
      wrapper.style.transform = "translate(-50%, -50%) scale("+scale+")";
    };

    this.setWPM = function (target_wpm) {
      wpm.innerHTML = target_wpm + "";
    };

    this.setFont = function (font) {
      // thanks for pointing that out
      leftWord.style.fontFamily = font;
      pivotChar.style.fontFamily = font;
      rightWord.style.fontFamily = font;
      decorator.style.fontFamily = font;
      leftWrap.style.fontFamily = font;
      rightWrap.style.fontFamily = font;
      wpm.style.fontFamily = font;
      message.style.fontFamily = font;
    };

    this.setFontWeight = function (fontWeight) {
      leftWord.style.fontWeight = fontWeight;
      pivotChar.style.fontWeight = fontWeight;
      rightWord.style.fontWeight = fontWeight;
      decorator.style.fontWeight = fontWeight;
    };

    this.applyTheme = function (theme) {
      var style;
      if (this.dark) {
        style = theme.dark;
      } else {
        style = theme.light;
      }
      var c = style.colors;

      backdrop.offsetWidth;
      backdrop.style.opacity = style.backdrop_opacity;

      backdrop.style.backgroundColor = c.backdrop;
      wordBox.style.backgroundColor = c.background;
      leftWord.style.color = c.foreground;
      rightWord.style.color = c.foreground;
      leftWrap.style.backgroundColor = c.wrap_background;
      rightWrap.style.backgroundColor = c.wrap_background;
      leftWrap.style.color = c.wrap_foreground;
      rightWrap.style.color = c.wrap_foreground;
      reticle.style.borderColor = c.reticle;
      pivotChar.style.color = c.pivot;
      decorator.style.color = c.message;
      progressBar.style.borderColor = c.progress_bar_foreground;
      progressBar.style.backgroundColor = c.progress_bar_background;
      message.style.color = c.message;
      wpm.style.color = c.message;
    };


    this.setProgress = function (percent) {
      progressBar.style.borderLeftWidth = Math.ceil(percent * 4) + "px";
    };

    this.setMessage = function (msg) {
     message.innerHTML = msg;
    };

    this.showMessage = function () {
      message.style.display = "block";
    };

    this.hideMessage = function () {
      message.style.display = "none";
    };

    this.started = false;

    this.setWord = function (token, dec) {
      var pivot = calculatePivot(token.replace(/[?.,!:;*-]+$/, ""));
      leftWord.innerHTML = token.substr(0, pivot);
      pivotChar.innerHTML = token.substr(pivot, 1);
      rightWord.innerHTML = token.substr(pivot + 1)
      if (typeof dec !== "undefined") decorator.innerHTML = dec;

      word.offsetWidth;
      var pivotCenter = reticle.offsetLeft + (reticle.offsetWidth / 2);
      word.style.left = (pivotCenter - pivotChar.offsetLeft - (pivotChar.offsetWidth / 2)) + "px";
    };

    this.setWrap = function (left, right) {
      leftWrap.innerHTML = left;
      rightWrap.innerHTML = right;

      var lw = leftWrap.offsetWidth;
      var rw = rightWrap.offsetWidth;

      wrapper.style.paddingLeft = "50px";
      wrapper.style.paddingRight = "50px";
      if (lw > rw) {
        wrapper.style.paddingRight = 50 + (lw - rw) + "px";
      } else if (rw > lw) {
        wrapper.style.paddingLeft = 50 + (rw - lw) + "px";
      }
    };

    this.clear = function () {
      this.setWrap("", "");
      this.setWord("   ", "");
    };
  }

  view.Reader = Reader;

  // we only need one instance of Reader now.
  var readerSingleton;

  view.__defineGetter__("reader", function () {
    if (!readerSingleton) readerSingleton = new Reader();

    return readerSingleton;
  });


  var overlaidElems = [];

  /**
   * Makes an overlay for the given element.
   * Returns false if the overlay is off the bottom of the screen,
   * otherwise returns true;
   */
  view.addOverlay = function (elem) {
    var rect = elem.getBoundingClientRect();

    var overlay = H.div("sr-overlay");
    overlay.style.top = (H.getScrollTop() + rect.top) + "px";
    overlay.style.left = (H.getScrollLeft() + rect.left) + "px";
    overlay.style.width = rect.width + "px";
    overlay.style.height = rect.height + "px";
    overlay.style.backgroundColor = config("selection_color");
    document.body.appendChild(overlay);
    elem.___jetztOverlay = overlay;

    overlaidElems.push(elem);

    return rect.top < window.innerHeight;
  };

  view.removeOverlay = function (elem) {
    if (elem.___jetztOverlay) {
      elem.___jetztOverlay.remove();
      delete elem.___jetztOverlay;
      H.removeFromArray(overlaidElems, elem);
    }
  };

  view.removeAllOverlays = function () {
    for (var i = overlaidElems.length; i--;) {
      var elem = overlaidElems[i];
      elem.___jetztOverlay.remove();
      delete elem.___jetztOverlay;
    }
    overlaidElems = [];
  };



  var highlight;

  view.highlightRange = function (range) {
    // todo
  };


})(this);
