/*
 * jQuery textarea suggest plugin
 *
 * Copyright (c) 2009-2010 Roman Imankulov
 *
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 *
 * Requires:
 *   - jQuery (tested with 1.3.x and 1.4.x)
 *   - jquery.a-tools >= 1.4.1 (http://plugins.jquery.com/project/a-tools)
 *
 * Mitch Mahan, 7/8/2014:
 *   - Added cycleOnUpArrow option
 *   - Integrated AJAX query to retrieve suggestions from external server
 *
 */

/*globals jQuery,document */

(function ($) {
    // workaround for Opera browser
    if (navigator.userAgent.match(/opera/i)) {
        $(document).keypress(function (e) {
            if ($.asuggestFocused) {
                $.asuggestFocused.focus();
                $.asuggestFocused = null;
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }

    $.asuggestKeys = {
        UNKNOWN: 0,
        SHIFT: 16,
        CTRL: 17,
        ALT: 18,
        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        DOWN: 40,
        DEL: 46,
        TAB: 9,
        RETURN: 13,
        ESC: 27,
        COMMA: 188,
        PAGEUP: 33,
        PAGEDOWN: 34,
        BACKSPACE: 8,
        SPACE: 32
    };
    $.asuggestFocused = null;

    $.fn.asuggest = function (options) {
        return this.each(function () {
            $.makeSuggest(this, options);
        });
    };

    $.fn.asuggest.defaults = {
        'delimiters': '\n ',
        'minChunkSize': 2,
        'cycleOnUpArrow': true,
        'cycleOnDownArrow': true,
        'cycleOnTab': true,
        'autoComplete': true,
        'endingSymbols': ' ',
        'stopSuggestionKeys': [$.asuggestKeys.RETURN, $.asuggestKeys.SPACE],
        'ignoreCase': false,
        'url': '/api/',
        'ajaxGetVar': 'search='
    };

    /* Make suggest:
     *
     * create and return jQuery object on the top of DOM object
     * and store AJAX suggestions as part of this object
     *
     * By default this will send an AJAX GET request to /api/?search=<text from textarea>
     *
     * @param area: HTML DOM element to add suggests to
     * @param url: URL of your AJAX/API AutoComplete Server
     * @param suggests: A holder for suggestions returned from AJAX
     * @param cycleCount: Allows us to move up and down in suggestions
     * @param options: The options object
     */
    $.makeSuggest = function (area, options) {
        options = $.extend({}, $.fn.asuggest.defaults, options);

        var KEY = $.asuggestKeys,
        $area = $(area);
        $area.options = options;

        var suggests;

        var cycleCount  = 0;

        /* Internal method: get the chunk of text before the cursor */
        $area.getChunk = function () {
            var delimiters = this.options.delimiters.split(''), // array of chars
                textBeforeCursor = this.val().substr(0, this.getSelection().start),
                indexOfDelimiter = -1,
                i,
                d,
                idx;
            for (i = 0; i < delimiters.length; i++) {
                d = delimiters[i];
                idx = textBeforeCursor.lastIndexOf(d);
                if (idx > indexOfDelimiter) {
                    indexOfDelimiter = idx;
                }
            }
            if (indexOfDelimiter < 0) {
                return textBeforeCursor;
            } else {
                return textBeforeCursor.substr(indexOfDelimiter + 1);
            }
        };

        /* Internal method: get completion.
         * If performCycle is true then analyze getChunk() and and getSelection()
         */
        $area.getCompletion = function (performCycle) {
            var text = this.getChunk(),
                selectionText = this.getSelection().text,
                suggest;

            // Get AutoComplete dictionary from AJAX request
            if(!performCycle){
                    $.ajax({
                        async: false,
                        url: this.options.url,
                        data: this.options.ajaxGetVar + text,
                        success: function(response){
                                // Put all suggestions into suggests variable
                                suggests = response;

                                if( suggests.length > 0){
                                    // Update text selection with the first result immediately
                                    $area.updateSelection(suggests[0].substr(text.length));
                                }
                            }
                    });
            }

            if(performCycle){
                // Use the cycleCount of up/down arrows to return the cached results
                $area.updateSelection(suggests[cycleCount].substr(text.length));
            }
        };

        $area.updateSelection = function (completion) {
            if (completion) {
                var _selectionStart = $area.getSelection().start,
                    _selectionEnd = _selectionStart + completion.length;
                if ($area.getSelection().text === "") {
                    if ($area.val().length === _selectionStart) { // Weird IE workaround, I really have no idea why it works
                        $area.setCaretPos(_selectionStart + 10000);
                    }
                    $area.insertAtCaretPos(completion);
                } else {
                    $area.replaceSelection(completion);
                }
                $area.setSelection(_selectionStart, _selectionEnd);
            }
        };

        $area.bind('keydown.asuggest', function (e) {
            // Choose which keys will cycle our suggestion results
            if (e.keyCode === KEY.TAB && $area.options.cycleOnTab ||
                e.keyCode === KEY.UP && $area.options.cycleOnUpArrow ||
                e.keyCode === KEY.DOWN && $area.options.cycleOnDownArrow ) {
                    var chunk = $area.getChunk();

                    // If there is only one AutoComplete entry go ahead and choose it
                    if ( suggests.length == 1 ){
                        $area.cleanupSelection();
                        return false;
                    }

                    if ( chunk.length >= $area.options.minChunkSize ) {
                        // Cycle through options (TAB, UP or DOWN)
                        if ( e.keyCode === KEY.DOWN && cycleCount > 0 ||
                             e.keyCode === KEY.TAB && cycleCount  == suggests.length - 1){
                            cycleCount--;
                            $area.updateSelection($area.getCompletion(true));
                        } else if ( (e.keyCode === KEY.TAB  || e.keyCode === KEY.UP) &&
                                    cycleCount < suggests.length -1){
                            cycleCount++;
                            $area.updateSelection($area.getCompletion(true));
                        }
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    $area.focus();
                    $.asuggestFocused = this;
                    return false;
            }

            // Check for conditions to stop suggestion
            if ( $area.getSelection().length && $.inArray(e.keyCode, $area.options.stopSuggestionKeys) !== -1 ){
                $area.cleanupSelection();
                e.preventDefault();
                e.stopPropagation();
            }

        $area.cleanupSelection = function () {
                // apply suggestion then clean up selection and insert a space
                var _selectionEnd = $area.getSelection().end +
                        $area.options.endingSymbols.length;
                var _text = $area.getSelection().text + $area.options.endingSymbols;
                $area.replaceSelection(_text);
                $area.setSelection(_selectionEnd, _selectionEnd);

                this.focus();
                $.asuggestFocused = this;
                return false;
            }
        });

        $area.unbind('keyup.asuggest').bind('keyup.asuggest', function (e) {
            var hasSpecialKeys = e.altKey || e.metaKey || e.ctrlKey,
                hasSpecialKeysOrShift = hasSpecialKeys || e.shiftKey;
            switch (e.keyCode) {
            case KEY.UNKNOWN: // Special key released
            case KEY.SHIFT:
            case KEY.CTRL:
            case KEY.ALT:
            case KEY.RETURN: // we don't want to suggest when RETURN key has pressed (another IE workaround)
                break;
            case KEY.TAB:
                if (!hasSpecialKeysOrShift && $area.options.cycleOnTab) {
                    break;
                }
            case KEY.ESC:
            case KEY.BACKSPACE:
            case KEY.DEL:
            case KEY.UP:
                if (!hasSpecialKeysOrShift && $area.options.cycleOnUpArrow) {
                    break;
                }
            case KEY.DOWN:
                if (!hasSpecialKeysOrShift && $area.options.cycleOnDownArrow) {
                    break;
                }
            case KEY.LEFT:
            case KEY.RIGHT:
                if (!hasSpecialKeysOrShift && $area.options.autoComplete) {
                    $area.replaceSelection("");
                }
                break;
            default:
                if (!hasSpecialKeys && $area.options.autoComplete) {
                    var chunk = $area.getChunk();
                    if (chunk.length >= $area.options.minChunkSize) {
                        cycleCount = 0;
                        $area.updateSelection($area.getCompletion(false));
                    }
                }
                break;
            }
        });
        return $area;
    };
}(jQuery));