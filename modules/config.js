/*
   Licensed under the Apache License v2.0.

   A copy of which can be found at the root of this distrubution in
   the file LICENSE-2.0 or at http://www.apache.org/licenses/LICENSE-2.0
*/

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
