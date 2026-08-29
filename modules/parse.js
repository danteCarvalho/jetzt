/*
   Licensed under the Apache License v2.0.
            
   A copy of which can be found at the root of this distrubution in 
   the file LICENSE-2.0 or at http://www.apache.org/licenses/LICENSE-2.0
*/

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

