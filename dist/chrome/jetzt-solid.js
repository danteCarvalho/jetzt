/*! jetzt 2026-09-14
* https://github.com/danteCarvalho/jetzt/
* Copyright (c) 2026 David Sheldrick and contributors; Licensed Apache 2.0 */
(function (window) {
  
  if (typeof window.jetzt !== 'undefined') {
    console.warn("jetzt unable to initialize, window.jetzt already set");
    return;
  } else {
    window.jetzt = {};
    document.jetzt = window.jetzt;
  }

})(this);
(function (window) {

  var jetzt = window.jetzt;
  var H = {};

  jetzt.helpers = H;

  H.removeFromArray = function (arr, item) {
    var pos = arr.indexOf(item);
    if (pos > -1) arr.splice(pos, 1);
  };

  // TODO: Move dom specific stuff into separate helpers module for testing
  //       purposes
  H.getScrollTop = function () {
    return document.body.scrollTop || document.documentElement.scrollTop;
  };

  H.getScrollLeft = function () {
    return document.body.scrollLeft || document.documentElement.scrollLeft;
  };


  // make an element of the specified tag and class
  H.elem = function (tagName, className, kids) {
    var result = document.createElement(tagName);
    result.className = className || "";
    if (kids) {
      kids.forEach(function (kid) {result.appendChild(kid);})
    }
    return result;
  };

  H.div = function (className, kids) {
    return H.elem('div', className, kids);
  };

  H.span = function (className, kids) {
    return H.elem('span', className, kids);
  };

  function _modClass (elem, classes, cb) {
    var elemClasses = [];
    if (elem.className.trim().length >= 0) {
      elemClasses = elem.className.split(/\s+/)
    }

    classes.split(/\s+/).forEach(function (klass) {
      cb(elemClasses, klass);
    });

    elem.className = elemClasses.join(" ");
  }

  H.addClass = function (elem, classesToAdd) {
    _modClass(elem, classesToAdd, function (acc, klass) {
      H.removeFromArray(acc, klass);
      acc.push(klass);
    });
  };

  H.removeClass = function (elem, classesToRemove) {
    _modClass(elem, classesToRemove, H.removeFromArray);
  };

  H.hasClass = function (elem, classesToFind) {
    var found = true;
    _modClass(elem, classesToFind, function (elemClassses, klass) {
      found = found && elemClassses.indexOf(klass) > -1;
    });
    return found;
  };

  H.realTypeOf = function (thing) {
    return Object.prototype.toString.call(thing).slice(8, -1);
  };

  // flatten possibly nested array
  H.flatten = function (arr) {
    var result = [];
    var flat = function flat (thing) {
      if (Object.prototype.toString.call(thing) === '[object Array]')
        thing.forEach(flat);
      else
        result.push(thing);
    };
    flat(arr);
    return result;
  };

  H.clamp = function (min, num, max) {
    return Math.min(Math.max(num, min), max);
  };

  // merge objects together and so forth. don't rely on child object
  // references being preserved.
  H.recursiveExtend = function () {
    var result = arguments[0];
    for (var i=1; i<arguments.length; i++) {
      var uber = arguments[i];
      for (var prop in uber) {
        if (uber.hasOwnProperty(prop)) {
          if (result.hasOwnProperty(prop)) {
            var resultVal = result[prop];
            var uberVal = uber[prop];
            if (H.realTypeOf(resultVal) === 'Object'
                 && H.realTypeOf(uberVal) === 'Object') {
              result[prop] = H.recursiveExtend({}, resultVal, uberVal);
            } else {
              result[prop] = uberVal;
            }
          } else {
            result[prop] = uber[prop];
          }
        }
      }
    }
    return result;
  };

  H.keys = function (obj) {
    var result = [];
    for (var prop in obj) { if (obj.hasOwnProperty(prop)) result.push(prop); }
    return result;
  };

  H.clone = function (obj) {
    return JSON.parse(JSON.stringify(obj));
  };

  H.isMobile = function () {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           (window.innerWidth <= 800) || 
           ('ontouchstart' in window);
  };

})(this);



/*
   Licensed under the Apache License v2.0.

   A copy of which can be found at the root of this distribution in
   the file LICENSE-2.0 or at http://www.apache.org/licenses/LICENSE-2.0
*/

/**
 * @file modules/config.js
 * @description Manages options, themes, and configuration state of the Jetzt reader.
 * Handles loading, saving, syncing, and custom configurations for user preferences
 * like reading speed (WPM), layouts, scaling, and color themes.
 */

(function (window) {

  var jetzt = window.jetzt
    , H = jetzt.helpers;

  // Configuration schema version. If schema changes in new releases, bump this.
  var CONFIG_VERSION = 0;

  // Default color schemes (classic light/dark themes)
  var DEFAULT_THEMES = [
    {
      "name": "Classic",
      "dark": {
        "backdrop_opacity": "0.86",
        "colors": {
          "backdrop": "#000000",
          "background": "#303030",
          "foreground": "#E0E0E0",
          "message": "#909090",
          "pivot": "#73b5ee",
          "progress_bar_background": "#000000",
          "progress_bar_foreground": "#3a5566",
          "reticle": "#656565",
          "wrap_background": "#404040",
          "wrap_foreground": "#a1a1a1"
        }
      },
      "light": {
        "backdrop_opacity": "0.07",
        "colors": {
          "backdrop": "black",
          "background": "#fbfbfb",
          "foreground": "#333333",
          "message": "#929292",
          "pivot": "#E01000",
          "progress_bar_background": "black",
          "progress_bar_foreground": "#00c00a",
          "reticle": "#efefef",
          "wrap_background": "#f1f1f1",
          "wrap_foreground": "#666"
        }
      }
    }
  ];

  // Modifiers define the relative delay applied to words based on grammar/layout structures.
  // E.g., short/long sentences and paragraph transitions slow down reading pace for better comprehension.
  var DEFAULT_MODIFIERS = {
    normal: 1,
    start_clause: 1,
    end_clause: 1.8,
    start_sentence: 1.3,
    end_sentence: 2.2,
    start_paragraph: 2.0,
    end_paragraph: 2.8,
    short_space: 1.5,
    long_space: 2.2
  }

  // Default user settings for the Jetzt RSVP reader.
  var DEFAULT_OPTIONS = {
    config_version: CONFIG_VERSION,
    target_wpm: 400, // Words per minute default speed
    scale: 1,        // Text scale multiplier
    dark: false,     // Dark mode toggle
    selected_theme: 0,
    show_message: false,
    strip_citation: false, // Strips citation brackets or in-text citations if true
    tts_enabled: true,  // Enable/disable Text-to-Speech (read-aloud) synchronized reading
    tts_lang: "auto",    // Default reading language ("auto", "pt", "en", "es", "fr", "it", "de", etc.)
    selection_color: "#FF0000",
    modifiers: DEFAULT_MODIFIERS,
    font_family: "Menlo, Monaco, Consolas, monospace",
    font_weight: "normal",
    custom_themes: []
  };


  /*** STATE ***/

  // Current session configuration options, initialized with default values.
  var options = H.clone(DEFAULT_OPTIONS);

  // Array of change listener callbacks
  var listeners = [];

  // Triggers checking and notifying all registered change listeners when config updates
  function announce () {
    listeners.forEach(function (cb) { cb(); });
  }

  /**
   * Recursive lookup function. Like Clojure's get-in.
   * Traverses a deep object path to read a nested option.
   */
  function lookup (map, keyPath) {
    if (keyPath.length === 0) throw new Error("No keys specified.");

    var key = keyPath[0];
    if (keyPath.length === 1) {
      if (!map.hasOwnProperty(key)) {
        console.warn("config lookup: no key '"+key+"'");
      }
      return map[key];
    } else {
      var submap = map[key];
      if (H.realTypeOf(submap) !== 'Object') {
        console.warn("config lookup: no key '"+key+"'");
        return;
      } else {
        return lookup(submap, keyPath.slice(1));
      }
    }
  }

  // recursive put. Like clojure's assoc-in. Writes a value at a deep nested path of an object.
  function put (map, keyPath, val) {
    if (keyPath.length === 0) throw new Error("No keys specified.");

    var key = keyPath[0];
    if (keyPath.length === 1) {
      map[key] = val;
    } else {
      var submap = map[key];
      if (H.realTypeOf(submap) !== 'Object') {
        submap = {};
        map[key] = submap;
      }
      _put(submap, keyPath.slice(1), val);
    }
  }

  /*** BACKEND ***/

  // The configBackend defines the storage system used to read/write settings.
  // It is a swappable interface with get and set methods.
  // get: takes a callback and retrieves serialized JSON representing the stored options.
  // set: accepts serialized JSON and persists it.
  // Defaults to a localStorage-based backend, useful for bookmarklets and standalone demo pages.
  var KEY = "jetzt_options";

  var configBackend = {
    /**
     * Retrieves the stored configuration.
     * @param {function} cb Callback invoked with the options JSON string (or falsey if non-existent).
     */
    get: function (cb) {
      var json = localStorage.getItem(KEY);
      if(json) {
        cb("{}");
      } else {
        cb(json);
      }
    },
    /**
     * Persists the given configuration JSON string inside localStorage.
     * @param {string} json Serialized options.
     */
    set: function (json) {
      localStorage.setItem(KEY, json);
    }
  };

  /*** (DE)SERIALISATION ***/

  /**
   * Serializes the current active options object and writes it to the config backend.
   */
  function persist () {
    configBackend.set(JSON.stringify(options));
  }

  /**
   * Deserializes a config JSON string into active options.
   * Handles migrations for legacy configuration versions and notifies listeners of changes.
   * @param {string} json Configuration JSON to load.
   */
  function unpersist (json) {
    try {
      var opts = JSON.parse(json || "{}")
        , repersist = false;

      // Migrate obsolete structures if user's saved config version does not match CONFIG_VERSION.
      if (opts.config_version != CONFIG_VERSION) {

        // update custom themes
        if (opts.custom_themes) {
          H.keys(opts.custom_themes).forEach(function (id) {
            var customTheme = opts.custom_themes[id];
            opts.custom_themes[id] =
                    H.recursiveExtend(DEFAULT_THEMES.Classic, customTheme);
          });
        }

        opts.config_version = CONFIG_VERSION;
        repersist = true;
      }

      H.recursiveExtend(options, opts);

      // Expose globally for sandbox debugging/access
      window.jazz = options;

      repersist && persist();
      announce();
    } catch (e) {
      throw new Error("corrupt config json", e);
    }
  }


  /**
   * jetzt.config
   * get and set config variables.
   *
   * e.g.
   *      jetzt.config("cheese", "Edam")
   * 
   * sets the "cheese" option to the string "Edam"
   *
   *      jetzt.config("cheese")
   *
   *      => "edam"
   *
   * It also has support for key paths
   *
   *      jetzt.config(["cheese", "color"], "blue")
   *      jetzt.config(["cheese", "name"], "Stilton")
   *
   *      jetzt.config(["cheese", "name"])
   *
   *      => "Stilton"
   *
   *      jetzt.config("cheese")
   * 
   *      => {color: "blue", name: "Stilton"}
   */
  var config = function (keyPath, val) {
    if (typeof keyPath === 'string') keyPath = [keyPath];

    if (arguments.length === 1) {
      return lookup(options, keyPath);
    } else {
      put(options, keyPath, val);
      persist();
      announce();
    }
  };

  jetzt.config = config;

  config.DEFAULTS = H.clone(DEFAULT_OPTIONS);
  config.DEFAULT_THEMES = H.clone(DEFAULT_THEMES);

  /**
   * Registers a change listener callback to be run whenever options list is updated.
   * Returns an unregister handle function.
   * @param {function} cb Callback function
   * @returns {function} Unregister function
   */
  config.onChange = function (cb) {
    listeners.push(cb);
    return function () { H.removeFromArray(listeners, cb); };
  };

  /**
   * Swaps the config storage backend, pulls updated options from it, and broadcasts the event.
   * @param {object} backend Storage backend object implementing get(cb) and set(val) methods.
   */
  config.setBackend = function (backend) {
    configBackend = backend;
    this.refresh();
    announce();
  };

  /**
   * Force refreshes the configuration options from the active storage backend.
   * @param {function} [cb] Optional callback executed after unpersist finishes.
   */
  config.refresh = function (cb) {
    configBackend.get(function (json) {
      unpersist(json);
      cb && cb();
    });
  };

  /**
   * Retrieves the currently selected reader UI color and opacity theme.
   * @returns {object} Selected theme dictionary.
   */
  config.getSelectedTheme = function () {
    return DEFAULT_THEMES[options.selected_theme] || DEFAULT_THEMES[0];
  };

  /**
   * Compares two speed modifiers and returns the one representing a larger delay.
   * @param {string} a Modifier key A
   * @param {string} b Modifier key B
   * @returns {string} The modifier key with the higher delay multiplier
   */
  config.maxModifier = function (a, b) {
    return this(["modifiers", a]) > this(["modifiers", b]) ? a : b;
  };

  /**
   * Adjusts the words-per-minute target speed by a delta value. Clamps to bounds.
   * @param {number} diff Speed difference (e.g., +25 or -25).
   */
  config.adjustWPM = function (diff) {
    options.target_wpm = H.clamp(100, options.target_wpm + diff, 1500);
    announce();
    persist();
  };

  /**
   * Adjusts the interface / text scale size. Clamps scale factor between 0 and 1.
   * @param {number} diff Change delta for scale factor.
   */
  config.adjustScale = function (diff) {
    this("scale", H.clamp(0, options.scale + diff, 1));
  };


  /**
   * Manually persists current active configuration options into the storage backend.
   */
  config.save = function () {
    persist();
  };

  // load the options from the default config backend to get the ball rolling
  config.refresh();

})(this);

/**
 * @file modules/parse.js
 * @description Core text parsing engine for Jetzt.
 * Translates DOM elements and plain text strings into sequential visual instruction sets.
 * Dissects sentences, paragraphs, isOL/UL/heading blocks, breaks down long words,
 * and optional cleans out academic citations (e.g., APA/MLA/IEEE).
 */

(function (window) {

  var jetzt = window.jetzt;
  var H = jetzt.helpers;
  var config = jetzt.config;


  // splitting long words. Used by the Instructionator.

  /**
   * Determines if a word is long enough to require splitting for readability in the reader viewport.
   * @param {string} word The word to evaluate.
   * @returns {boolean} true if split-up is needed.
   */
  function wordShouldBeSplitUp(word) {
    return word.length > 13 || word.length > 9 && word.indexOf("-") > -1;
  }

  /**
   * Splits a long word (or hyphenated expression) into multiple chunks.
   * Keeps hyphen fragments or segments under 8 characters deep.
   * @param {string} word The input word.
   * @returns {string[]} An array of word segments/syllables.
   */
  function splitLongWord (word) {
    if (wordShouldBeSplitUp(word)) {
      var result = [];

      var dashIdx = word.indexOf("-");
      if (dashIdx > 0 && dashIdx < word.length - 1) {
        result.push(word.substr(0, dashIdx));
        result.push(word.substr(dashIdx + 1));
        return H.flatten(result.map(splitLongWord));
      } else {
        var partitions = Math.ceil(word.length / 8);
        var partitionLength = Math.ceil(word.length / partitions);
        while (partitions--) {
          result.push(word.substr(0, partitionLength));
          word = word.substr(partitionLength);
        }
        return result;
      }
    } else {
      return [word];
    }
  }

  // regexp that matches in-text citations (APA, Chicago, MLA, IEEE, etc.)
  var _reInTextCitation = (function () {
    var au = "((\\S\\.\\s)?(\\S+\\s)?\\S+?)";          // author
    var et = "(,?\\set\\sal\\.?)";                     // et al.

    var yr = "((16|17|18|19|20)\\d{2}[a-z]?)";         // year restricted in 17c.-21c.
    var pt = "([a-z]{1,4}\\.\\s\\d+)";                 // part: p. 199, chap. 5, etc.
    var yp = "(" + yr + "|" + pt + ")";                // year and part
    var pp = "(" + pt + "|\\d+)";                      // part and page

    var as = "((" + au + ",\\s)*" + au +
             ",?\\s(and|&)\\s)?" + au + et;            // multiple authors
    var ml = as + "?\\s\\d+(,\\s\\d+)*";               // MLA author-page (disabled)
    var ap = "(" + as + "?,?\\s)?" + yp +
             "((,\\s|:)" + pp + ")*";                  // APA/CMS/ASA author-year-page

    var hs = "(" + as + "|" + ap + ")";                // humanist single citation
    var hm = "\\((" + hs + "(;|,|,?\\s(and|&))\\s)*" +
             hs + "\\)";                               // humanist multiple citations
    var ie = "\\[\\d+\\]";                             // IEEE

    return new RegExp("\\s?(" + hm + "|" + ie + ")", "g");
  })();

  /**
   * Strips out academic parenthetical or bracketed citation markers from a text body.
   * @param {string} text Text string potentially containing citations.
   * @returns {string} Sanitized string.
   */
  function stripInTextCitation (text) {
    return text.replace(_reInTextCitation, "");
  }

  /**
   * Helper class for generating jetz instruction sets.
   * Aggregates token items, updates layout wrappers, and calculates delay speed/modifiers.
   * @class Instructionator
   */
  function Instructionator () {
    // state
    var instructions = []
      , modifier = "normal"
      , wraps = []
      , spacerInstruction = null
      , done = false;

    /**
     * Flags the subsequent token to carry a specific delay/speed modifier.
     * @param {string} mod Modifier type (e.g., 'start_clause').
     */
    this.modNext = function (mod) {
      modifier = config.maxModifier(modifier, mod);
    };

    /**
     * Updates the immediately preceding token to carry a specific delay/speed modifier.
     * @param {string} mod Modifier type.
     */
    this.modPrev = function (mod) {
      if (instructions.length > 0) {
        var current = instructions[instructions.length-1].modifier;
        instructions[instructions.length-1].modifier = config.maxModifier(current, mod);
      }
    };

    /**
     * Adds an end-of-token decorator string to the last parsed instruction.
     * @param {string} dec Decorator text.
     */
    this.decPrev = function (dec) {
      if (instructions.length > 0) {
        var current = instructions[instructions.length-1].decorator;
        instructions[instructions.length-1].decorator += dec;
      }
    };

    /**
     * Pushes a lexical visual enclosing wrap (like quotes or parentheses) onto the next token.
     * @param {object} wrap Object with keys 'left' and 'right' enclosing characters.
     */
    this.pushWrap = function (wrap) {
      wraps.push(wrap);
    };

    /**
     * Removes/stops the specified wrap before the next token.
     * Pops everything down to the matching wrap.
     * @param {object} wrap The wrap object to pop.
     */
    this.popWrap = function (wrap) {
      var idx = wraps.lastIndexOf(wrap);
      if (idx > -1)
        wraps.splice(wraps.lastIndexOf(wrap), wraps.length);
    };

    /**
     * Clears all visual wraps.
     */
    this.clearWrap = function (wrap) {
      wraps = [];
    };

    // Attaches the prefix (left) and suffix (right) visual wraps to a given instruction object.
    var _addWraps = function (instr) {
      instr.leftWrap = wraps.map(function (w) { return w.left; }).join("");
      instr.rightWrap = wraps.map(function (w) { return w.right; }).reverse().join("");
      return instr;
    }

    /**
     * Injects a visual space/separator before the next token is presented (e.g. at clause/sentence borders).
     */
    this.spacer = function () {
      if (spacerInstruction) {
        spacerInstruction.modifier = "long_space";
      } else {
        spacerInstruction = _addWraps({
          token: "   ",
          modifier: "short_space",
          decorator: ""
         });
      }
    };

    /**
     * Registers a text word token into the list of reader instructions.
     * Breaks down the token into smaller segments internally if its character length is too high.
     * @param {string} token Word token.
     */
    this.token = function (token) {
      if (spacerInstruction) {
        instructions.push(spacerInstruction);
      }

      var trunks = wordShouldBeSplitUp(token) ? splitLongWord(token) : [token]
        , last = trunks.pop();
      trunks.forEach(function (t) {
        instructions.push(_addWraps({
          token: t,
          modifier: "normal",
          decorator: "-"
        }));
      });
      instructions.push(_addWraps({
        token: last,
        modifier: modifier,
        decorator: ""
      }));

      modifier = "normal";
      spacerInstruction = null;
    };

    /**
     * Retrieves the final processed instruction array.
     * @returns {object[]} Array of compiled instruction dictionaries.
     */
    this.getInstructions = function () {
      return instructions;
    };
  }

  // Predefined visual boundary characters mapped to wrapper contexts.
  var wraps = {
    guillemot: {left: "«", right: "»"},
    double_quote: {left: "“", right: "”"},
    parens: {left: "(", right: ")"},
    heading: {left: "#", right: ""},
    blockquote: {left: "›", right: ""}  // U+203A
  };

  /**
   * Recursively parses DOM nodes, translating HTML block tags (H1-H6, P, BLOCKQUOTE, UL, etc.)
   * and inline text tags into formatted speed reading instructions.
   * @param {Node|Node[]} topnode The root DOM Element or Node list.
   * @param {Instructionator} [$instructionator] Optional aggregator instance.
   * @returns {object[]} Combined list of instructions.
   */
  function parseDom(topnode,$instructionator) {
    var inst =  ($instructionator) ? $instructionator :  new Instructionator();

    var nodes = null;
    if (H.realTypeOf(topnode) === "Array") {
      nodes = topnode;
    } else {
      nodes = topnode.childNodes;

      var all_inline = [].reduce.call(
        nodes,
        function(val, node) {
          return val && (node.nodeType !== 1 ||
            !!window.getComputedStyle(node).display.match(/^inline/));
        },
        true
      );
      if (all_inline) {
        var text = topnode.textContent.trim();
        if (text.length > 0) parseText(text, inst);
        return inst.getInstructions();
      }
    }

    var node=null;
    for(var i=0;i<nodes.length;i++) {
        node = nodes[i];

        // Apply distinct formatting modifiers or wrappers depending on type of HTML tag
        switch(node.nodeName) {
          case "H1":
          case "H2":
          case "H3":
          case "H4":
          case "H5":
          case "H6":
            inst.clearWrap();
            inst.pushWrap(wraps.heading);
            inst.modNext("start_paragraph");
            parseDom(node,inst);
            inst.spacer();
            inst.popWrap(wraps.heading);
            inst.modPrev("end_paragraph");
            break;
          case "BLOCKQUOTE":
            inst.pushWrap(wraps.blockquote);
            inst.modNext("start_paragraph");
            parseDom(node,inst);
            inst.popWrap(wraps.blockquote);
            inst.modPrev("end_paragraph");
            break;
          case "SCRIPT":
            break;
          case "#text":
            if(node.textContent.trim().length > 0) parseText(node.textContent.trim(),inst);
            break;
          case "DL":
          case "OL":
          case "UL":
          case "SECTION":
          case "P":
            inst.modNext("start_paragraph");
            parseDom(node, inst)
            inst.modPrev("end_paragraph");
            break;
          case "#comment":
            break;
          default:
            parseDom(node,inst);
        }
    }

    return inst.getInstructions();
  }

  /**
   * Tokenizes and parses plain-text strings into RSVP visual reading instructions.
   * Recognizes nested markers like double quotes, brackets, guillemots and maps pause delays
   * according to trailing/leading punctuation marks.
   * @param {string} text Plain-text code to process.
   * @param {Instructionator} [$instructionator] Optional aggregator instance.
   * @returns {object[]} List of instructions.
   */
  function parseText (text,$instructionator) {
    if (config("strip_citation")) text = stripInTextCitation(text);
                        // long dashes ↓
    var tokens = text.match(/["«»“”\(\)\/–—]|--+|\n+|[^\s"“«»”\(\)\/–—]+/g);
    if (tokens === null) tokens = [];

    var $ = ($instructionator) ? $instructionator :  new Instructionator();

    // doesn't handle nested double quotes, but that junk is *rare*;
    var double_quote_state = false;

    for (var i=0; i<tokens.length; i++) {
      var tkn = tokens[i];

      switch (tkn) {
        case "“":
          $.spacer();
          $.pushWrap(wraps.double_quote);
          $.modNext("start_clause");
          break;
        case "”":
          $.popWrap(wraps.double_quote);
          $.modPrev("end_clause");
          $.spacer();
          break;
        case "«":
          $.spacer();
          $.pushWrap(wraps.guillemot);
          $.modNext("start_clause");
          break;
        case "»":
          $.popWrap(wraps.guillemot);
          $.modPrev("end_clause");
          $.spacer();
          break;
        case "\"":
          if (double_quote_state) {
            $.popWrap(wraps.double_quote)
            $.spacer();
            $.modNext("start_clause");
          } else {
            $.spacer();
            $.pushWrap(wraps.double_quote);
            $.modPrev("end_clause");
          }
          double_quote_state = !double_quote_state;
          break;
        case "(":
          $.spacer();
          $.pushWrap(wraps.parens);
          $.modNext("start_clause");
          break;
        case ")":
          $.popWrap(wraps.parens);
          $.modPrev("end_clause");
          $.spacer();
          break;
        default:
          if (tkn.match(/^(\/|--+|—|–)$/)) {
            $.modNext("start_clause");
            $.token(tkn);
            $.modNext("start_clause");
          } else if (tkn.match(/^[.?!…]+$/)) {
            $.decPrev(tkn);
            $.modPrev("end_sentence");
          } else if (tkn.match(/[.?!…]+$/)) {
            $.modNext("end_sentence");
            $.token(tkn);
            $.modNext("start_sentence");
          } else if (tkn.match(/^[,;:]$/)) {
            $.decPrev(tkn);
            $.modPrev("end_clause");
          } else if (tkn.match(/[,;:]$/)) {
            $.modNext("end_clause");
            $.token(tkn);
            $.modNext("start_clause");
          } else if (tkn.match(/\n+/)) {
            if (tkn.length > 1
                // hack for linefeed-based word wrapping. Ugly. So ugly.
                || (i > 0 && tokens[i - 1].match(/[.?!…'"”]+$/))) {

              $.clearWrap();
              $.modPrev("end_paragraph");
              $.spacer();
              $.modNext("start_paragraph");
              double_quote_state = false;
            }
          } else if (tkn.match(/^".+$/)) {
            double_quote_state = true;
            $.modNext("start_clause");
            $.token(tkn.substr(1));
          } else {
            $.token(tkn);
          }
      }
    }

    return $.getInstructions();
  }

  /**
   * Simple orchestrator that kicks off a specific parser on raw content using a fresh Instructionator.
   * @param {function} parser The parser function (e.g. parseText).
   * @param {*} content The content to parse.
   * @returns {object[]} Combined RSVP instructions.
   */
  function parseStuff (parser, content) {
    var instr = new Instructionator();
    parser(content, instr);

    return instr.getInstructions();
  }

  jetzt.parse = {
    /**
     * Read the given string, or array of strings.
     */
    string: function (str) {
      return parseStuff(parseText, str);
    },

    /**
     * Read the given DOM element, or array of DOM elements.
     */
    dom: function (dom) {
      return parseStuff(parseDom, dom);
    }
  };

})(this);


(function (window) {

  var jetzt  = window.jetzt
    , config = jetzt.config;

  function calculateDelay(instr) {
    var interval = 60 * 1000 / config("target_wpm");
    if (instr.modifier !== "normal") {
      return interval * config(["modifiers", instr.modifier]);
    } else {
      var len = instr.token.length;
      var mul = 1;
      switch (len) {
        case 6:
        case 7:
          mul = 1.2;
          break;
        case 8:
        case 9:
          mul = 1.4;
          break;
        case 10:
        case 11:
          mul = 1.8;
          break;
        case 12:
        case 13:
          mul = 2;
      }
      return interval * mul;
    }
    return interval;
  }

  var startModifiers = {
    "start_sentence": true,
    "start_paragraph": true
  };


  /**
   * Executor takes some instructions and a reader and updates the reader
   * based on the start/stop/naviation methods.
   */
  function Executor (instructions) {
    var reader = jetzt.view.reader;

    /*** STATE ***/
    var running = false // whether or not the reader is running
      , index = 0       // the index of the current instruction
      , runLoop;        // the run loop timeout

    function setRunning (val) {
      if (running !== val) {
        running = val;
        if (typeof reader.onPlayStateChange === "function") {
          reader.onPlayStateChange(running);
        }
      }
    }

    this.isRunning = function () {
      return running;
    };

    var activeUtterance = null; // speaks the remaining text synchronized with view
    var currentWpm = config("target_wpm");
    var currentTts = config("tts_enabled");
    var currentTtsLang = config("tts_lang");

    // Live configuration listener to handle real-time changes in TTS or speed settings
    var unregisterConfigListener = config.onChange(function () {
      var newTts = config("tts_enabled");
      var newWpm = config("target_wpm");
      var newTtsLang = config("tts_lang");
      
      if (running) {
        if (newTts !== currentTts || newWpm !== currentWpm || newTtsLang !== currentTtsLang) {
          if (newTts) {
            clearTimeout(runLoop);
            speakRemaining();
          } else {
            stopSpeech();
            defer(0);
          }
        }
      }
      
      currentTts = newTts;
      currentWpm = newWpm;
      currentTtsLang = newTtsLang;
    });

    /**
     * Synthesizes and plays the remainder of the text starting from the current index.
     * Captures word boundary events to visually advance index synchronously with the voice.
     */
    function speakRemaining() {
      if (!config("tts_enabled")) return;

      // Clean up previous event listeners on existing activeUtterance and cancel speech safely
      stopSpeech();

      if (index >= instructions.length) return;

      var remainingInstructions = instructions.slice(index);
      var fullText = "";
      var tempMap = []; // Character index mapped to instruction index in main array

      for (var i = 0; i < remainingInstructions.length; i++) {
        var realIdx = index + i;
        var instr = remainingInstructions[i];
        var token = instr.token || "";

        var startPos = fullText.length;
        fullText += token + " ";
        var endPos = fullText.length;

        for (var c = startPos; c < endPos; c++) {
          tempMap[c] = realIdx;
        }
      }

      if (!fullText.trim()) return;

      activeUtterance = new SpeechSynthesisUtterance(fullText);

      // Convert target RSVP WPM to TTS play rate (clamped between 0.5 and 10.0)
      var targetWpm = config("target_wpm") || 400;
      var isChrome = /Chrome|Chromium|CriOS/i.test(window.navigator.userAgent);
      // Chrome's default base speed factor for 1.0 rate represents around 140 WPM, whereas Firefox is faster around 160 WPM.
      // Additionally, we calibrate the divisor differently on Chrome so speed matches visual expectation.
      // Since 800 WPM on Chrome matches 400 WPM on Firefox, standardizing rates means halving the divisor (around 75) on Chrome
      // and raising the max rate limit appropriately (Chrome supports up to 10.0 for local/system voices).
      var rateDivisor = isChrome ? 75 : 160;
      var maxRateLimit = isChrome ? 10.0 : 3.0; // Chrome natively supports up to 10.0 for local offline voices
      activeUtterance.rate = Math.min(maxRateLimit, Math.max(0.5, targetWpm / rateDivisor));

      // Attempt to assign matching native language voice
      if (window.speechSynthesis.getVoices) {
        var voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          var targetLang = config("tts_lang") || "auto";
          if (targetLang === "auto") {
            targetLang = document.documentElement.lang || "pt";
          }
          var matchingVoices = voices.filter(function (v) {
            return v.lang.toLowerCase().indexOf(targetLang.toLowerCase()) > -1 ||
                   targetLang.toLowerCase().indexOf(v.lang.toLowerCase()) > -1;
          });

          // CRITICAL CHROME BUG FIX: Google's online cloud voices (localService = false)
          // in Chrome have extreme latency, cap playback rate strictly at 2.0, and fail to
          // fire onboundary events reliably. Prioritizing offline local voices (localService = true)
          // restores hyper-fast low-latency speech synthesis and precise word tracking on Chrome.
          var voice = matchingVoices.find(function (v) {
            return v.localService === true;
          }) || matchingVoices[0];

          if (voice) {
            activeUtterance.voice = voice;
            activeUtterance.lang = voice.lang;
          } else {
            activeUtterance.lang = targetLang;
          }
        }
      }

      // Synchronize visual display index on each spoken word boundary event
      activeUtterance.onboundary = function (event) {
        if (!running || !config("tts_enabled")) return;
        if (event.name === "word") {
          var charIndex = event.charIndex;
          var realIndex = tempMap[charIndex];
          if (typeof realIndex !== "undefined") {
            if (realIndex >= index) {
              index = realIndex;
              updateReader(instructions[index]);
            }
          }
        }
      };

      activeUtterance.onend = function () {
        if (running && config("tts_enabled")) {
          index = instructions.length;
          updateReader();
          setRunning(false);
          activeUtterance = null;
        }
      };

      activeUtterance.onerror = function (evt) {
        console.warn("Speech Synthesis interaction error: ", evt);
      };

      window.speechSynthesis.speak(activeUtterance);
    }

    /**
     * Halts/stops all TTS speech playback. Prevents asynchronous cancel events
     * from triggering unexpected state transitions by clearing active handlers.
     */
    function stopSpeech() {
      if (activeUtterance) {
        activeUtterance.onboundary = null;
        activeUtterance.onend = null;
        activeUtterance.onerror = null;
      }
      window.speechSynthesis.cancel();
      activeUtterance = null;
    }

    function updateReader (instr) {
      if (typeof instr === "undefined") {
        if (index < instructions.length) {
          instr = instructions[index];
        } else {
          instr = instructions[instructions.length - 1];
        }
      }
      reader.setWord(instr.token, instr.decorator);
      reader.setWrap(instr.leftWrap, instr.rightWrap);
      reader.setProgress(100 * (index / instructions.length));

      if (index === 1) {
        startedReading();
      } else if (index === instructions.length) {
        finishedReading();
      } else if (index % 5 === 0) {
        calculateRemaining();
      }
    }

    /**
     * Calculate and display the time remaining
     */
    function calculateRemaining () {
      var words = instructions.length;
      var timestamp = Math.round(new Date().getTime() / 1000);
      var elapsed = timestamp - reader.started;
      var remaining = (elapsed * (words - index)) / index;
      reader.setMessage(Math.round(remaining) + "s left");
    }

    
    function startedReading () {
      var timestamp = Math.round(new Date().getTime() / 1000);
      reader.started = timestamp;
    }
    
    function finishedReading () {
      var words = instructions.length;
      var timestamp = Math.round(new Date().getTime() / 1000);
      var elapsed = timestamp - reader.started;
      reader.setMessage(words + " words in " + elapsed + "s");
    }

    function handleInstruction (instr) {
      updateReader(instr);
      defer(calculateDelay(instr));
    }

    function defer (time) {
      runLoop = setTimeout(function (){
        if (running && index < instructions.length) {
          handleInstruction(instructions[index++]);
        } else {
          setRunning(false);
        }
      }, time);
    }

    /**
     * Start executing instructions
     */
    this.start = function () {
      if (index === instructions.length) {
        index = 0;
      }
      setRunning(true);
      if (config("tts_enabled")) {
        speakRemaining();
      } else {
        defer(0);
      }
    };

    /**
     * Stop executing instructions
     */
    this.stop = function () {
      clearTimeout(runLoop);
      setRunning(false);
      if (config("tts_enabled")) {
        stopSpeech();
      }
    };

    /**
     * cleanup listener bindings and stop interactions
     */
    this.destroy = function () {
      this.stop();
      if (unregisterConfigListener) {
        unregisterConfigListener();
      }
    };

    /**
     * start and stop the reader
     */
    this.toggleRunning = function (run) {
      if (run === running) return;

      running ? this.stop() : this.start();
    };
    
    /**
     * Navigate to the start of the sentence, or the start of the previous
     * sentence, if less than 5 words into current sentence.
     */
    this.prevSentence = function () {
      index = Math.max(0, index - 5);
      while (index > 0 && !startModifiers[instructions[index].modifier]) {
        index--;
      }
      if (!running) {
        updateReader();
      } else if (config("tts_enabled")) {
        speakRemaining();
      }
    };

    /**
     * Navigate to the start of the next sentence.
     */
    this.nextSentence = function () {
      index = Math.min(index+1, instructions.length - 1);
      while (index < instructions.length - 1
               && !startModifiers[instructions[index].modifier]) {
        index++;
      }
      if (!running) {
        updateReader();
      } else if (config("tts_enabled")) {
        speakRemaining();
      }
    };

    /**
     * Navigate to the start of the paragraph, or the start of the previous
     * paragraph, if less than 5 words into current paragraph
     */
    this.prevParagraph = function () {
      index = Math.max(0, index - 5);
      while (index > 0 && instructions[index].modifier != "start_paragraph") {
        index--;
      }
      if (!running) {
        updateReader();
      } else if (config("tts_enabled")) {
        speakRemaining();
      }
    };

    /**
     * Navigate to the start of the next paragraph.
     */
    this.nextParagraph = function () {
      index = Math.min(index+1, instructions.length - 1);
      while (index < instructions.length - 1
              && instructions[index].modifier != "start_paragraph") {
        index++;
      }
      if (!running) {
        updateReader();
      } else if (config("tts_enabled")) {
        speakRemaining();
      }
    };

    /**
     * Check if the reading index is at the very beginning of the instructions.
     * @returns {boolean}
     */
    this.isAtStart = function () {
      return index <= 1;
    };

    /**
     * Check if the reading index is at the very end of the instructions.
     * @returns {boolean}
     */
    this.isAtEnd = function () {
      return index >= instructions.length - 1;
    };
  }


  /**
   * jetzt.exec
   * creates an instruction execution interface for a given set of
   * instructions
   */
  jetzt.exec = function (instructions) {
    return new Executor(instructions);
  };

})(this);

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
