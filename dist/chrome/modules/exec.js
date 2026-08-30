/*
   Licensed under the Apache License v2.0.
            
   A copy of which can be found at the root of this distrubution in 
   the file LICENSE-2.0 or at http://www.apache.org/licenses/LICENSE-2.0
*/

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
