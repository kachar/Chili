/*!
 * Chili - the jQuery plugin for highlighting code
 * http://noteslog.com/chili/
 * 
 * Copyright 2010 Andrea Ercolino
 * Dual licensed under the MIT and GPL licenses.
 * http://docs.jquery.com/License
 * 
 * VERSION: @VERSION - @DATE
 */

(function( $ ) 
{
    Chili = //implied global
    { 
        automatic:          true,
        automaticSelector:  "code",
        lineNumbers:        !true,
        recipeLoading:      true,
        recipeFolder:       "", // used like: recipeFolder + recipeName + '.js'
        codeLanguage: function( el ) 
        {
            var recipeName = $( el ).attr( "class" );
            return recipeName ? recipeName : '';
        },
        selectionStyle:     
        [ 
            "position:absolute; z-index:3000; overflow:scroll;",
            "width:16em;",
            "height:9em;",
            "border:1px solid gray;",
            "padding:15px;",
            "background-color:yellow;"
        ].join( ' ' )
    };
    
    
    $(function() 
    {
        if (Chili.automatic) 
        {
            $(Chili.automaticSelector).chili();
        }
    });
    
    
    /**
     * Highlights currently selected elements according to the given options
     * 
     * @param {Object} options
     */
    $.fn.chili = function( options ) 
    {
        var system = {
            version: "next", // 2010-01-06
            queue: {}
        };
        var book = $.extend( {}, Chili, options || {}, system );
        this.each(function() 
        {
            askDish( this );
        });
        return this;
        
        /**
         * Returns the recipe path from the given recipeName
         * 
         * @param {String} recipeName
         * 
         * @return String
         */
        function getRecipePath( recipeName ) 
        {
        	var result = book.recipeFolder + recipeName + '.js';
            return result;
        }
        
        /**
         * Returns the recipe name from the given recipePath
         * 
         * @param {String} recipePath
         * 
         * @return String
         */
        function getRecipeName( recipePath )
        {
        	var matches = recipePath.match(/([^\/]+)\.js$/i);
        	var result = matches[1];
        	return result;
        }
        
        /**
         * Returns all the steps of the given blockName of the given recipe
         * 
         * @param {String} recipe
         * @param {String} blockName
         * 
         * @return Array<Object>
         */
        function prepareBlock( recipe, blockName ) 
        {
            var steps = [];
            var block = recipe[ blockName ];
            for( var stepName in block ) 
            {
                var prepared = prepareStep( recipe, blockName, stepName );
                steps.push( prepared );
            }
            return steps;
        }
        
        /**
         * Returns the number of sub matches in the given regular expression (as
         * a string)
         * 
         * @param {String} re
         * 
         * @return integer
         */
        function numberOfSubmatches( re )
        {
            var submatches = re
                .replace( /\\./g, "%" )     // disable any escaped character
                .replace( /\[.*?\]/g, "%" ) // disable any character class
                .match( /\((?!\?)/g )       // match any open parenthesis, not followed by a ?
            ;
            var result = (submatches || []).length;
            return result;
        }
        
        /**
         * Returns a step built from the given stepName of the given blockName 
         * of the given recipe
         * 
         * @param {String} recipe
         * @param {String} blockName
         * @param {String} stepName
         * 
         * @return Object
         */
        function prepareStep( recipe, blockName, stepName ) 
        {
            var step = recipe[ blockName ][ stepName ];
            var exp = ( typeof step._match == "string" ) 
                ? step._match 
                : step._match.source;
            var replacement = step._replace 
                ? step._replace 
                : '<span class="$0">$$</span>';
            var result = {
                recipe:      recipe,
                blockName:   blockName,
                stepName:    stepName,
                exp:         '(' + exp + ')', // new exp will have 1 more submatch
                length:      numberOfSubmatches( exp ) + 1,
                replacement: replacement
            };
            return result;
        }
        
        /**
         * Returns the given steps, with back references in the regular 
         * expression of each step renumbered according to the number of back 
         * references found in any previous step
         *
         * @param {Array} steps
         * 
         * @return Array
         */
        function adjustBackReferences( steps )
        {
            var prevLength = 1;
            var exps = [];
            for (var i = 0, iTop = steps.length; i < iTop; i++) {
                var exp = steps[ i ].exp;
                exp = exp.replace( /\\\\|\\(\d+)/g, 
                    function( m, aNum ) 
                    {
                        return !aNum ? m : "\\" + ( prevLength + 1 + parseInt( aNum, 10 ) );
                    } 
                );
                exps.push( exp );
                prevLength += steps[ i ].length;
            }
            return exps;
        }
        
        /**
         * Returns a regular expression built from all the given steps
         * 
         * @param {Array} steps
         * 
         * @return RegExp
         */
        function knowHow( steps, flags ) 
        {
            var prolog = '((?:\\s|\\S)*?)';
            var epilog = '((?:\\s|\\S)+)';
            var exps = adjustBackReferences( steps );
            var source = '(?:' + exps.join( '|' ) + ')';
            source = prolog + source + '|' + epilog;
            return new RegExp( source, flags );
        }
        
        /**
         * Returns the given replacement, after adding the given prefix to all 
         * classes of all SPANs
         * 
         * @param {String} prefix
         * @param {String} replacement
         * 
         * @return String
         */
        function addPrefix( prefix, replacement ) 
        {
            var lookFor = /(<span\s+class\s*=\s*(["']))((?:(?!__)\w)+\2\s*>)/ig;
            var replaceWith = '$1' + prefix + '__$3';
            var aux = replacement.replace( lookFor, replaceWith );
            return aux;
        }
        
        /**
         * Returns the step in the given steps and its matches in the given
         * allMatches
         * 
         * @param {Object} steps       the steps of a recipe
         * @param {Array}  allMatches  the corresponding matches
         * 
         * @return Object
         */
        function locateStepMatches( steps, allMatches )
        {
            var matchesIndex = 2;
            for (var i = 0, iTop = steps.length; i < iTop; i++)
            {
                var step = steps[ i ];
                var stepMatches = allMatches[ matchesIndex ];
                if (stepMatches) break;
                matchesIndex += step.length;
            }
            var matches  = allMatches.slice(matchesIndex, matchesIndex + step.length);
            var offset   = allMatches[ allMatches.length - 2 ];
            var original = allMatches[ allMatches.length - 1 ];
            matches.push( offset );
            matches.push( original );
            return {step: step, matches: matches};
        }
        
        /**
         * Returns the replacement for the given stepMatches, based on the
         * function in stepMatches.step.replacement
         * 
         * @param {Object} stepMatches
         * 
         * @return String
         */
        function functionReplacement( stepMatches ) 
        {
            var that = 
            { 
                x: function( subject, module ) 
                { 
                    var result = applyModule( subject, module, stepMatches.step );
                    return result;
                } 
            };
            var result = stepMatches.step.replacement.apply(that, stepMatches.matches);
            return result;
        }	
        
        /**
         * Returns the replacement for the given stepMatches, based on the
         * template in stepMatches.step.replacement
         * 
         * @param {Object} stepMatches
         * 
         * @return String
         */
        function templateReplacement( stepMatches )
        {
            var re = /(\\\$)|(?:\$\$)|(?:\$(\d+))/g;
            var substitution = function( m, escaped, K ) 
            {
                var result = '';
                if ( escaped )        /* \$ */ 
                {
                    result = "$";
                }
                else if ( !K )        /* $$ */ 
                {
                    result = filter( stepMatches.matches[ 0 ] ); //stepMatches
                }
                else if ( K == "0" )  /* $0 */ 
                {
                    result = stepMatches.step.stepName;
                }
                else                  /* $K */
                {
                    result = filter( stepMatches.matches[ K ] );
                }
                return result;
            };
            var result = stepMatches.step.replacement.replace(re, substitution);
            return result;
        }
        
        /**
         * Returns the replacement for any match found. This is a callback 
         * function passed to String.replace()
         * 
         * @return String
         */
        function chef( steps, replaceArgs ) 
        {
            var result = '';
            var anyMatch = replaceArgs[ 0 ];
            if (! anyMatch) return result;
            
            var epilog = replaceArgs[ replaceArgs.length - 3 ];
            if (epilog) {
                result = filter( epilog );
                return result;
            }
            var stepMatches = locateStepMatches( steps, replaceArgs );
            result = $.isFunction(stepMatches.step.replacement)
                ? functionReplacement(stepMatches)
                : templateReplacement(stepMatches)
            ;
            var prolog = replaceArgs[ 1 ];
            prolog = filter( prolog );
            result = addPrefix( stepMatches.step.recipe._name, result );
            result = prolog + result;
            return result;
        }
        
        /**
         * Returns the given ingredients, after applying the given blockName of 
         * the given recipe to it
         * 
         * @param {String} ingredients
         * @param {Object} recipe
         * @param {String} blockName
         * 
         * @return String
         */
        function cook( ingredients, recipe, blockName ) 
        {
            if (! blockName) 
            {
                blockName = '_main';
                checkSpices( recipe );
            }
            if (! blockName in recipe) return filter( ingredients );
            var replaceSpace = book.replaceSpace;
            var steps = prepareBlock( recipe, blockName );
            var flags = recipe._case 
                ? "g" 
                : "gi";
            var kh = knowHow( steps, flags );
            var perfect = ingredients.replace( kh, 
                function() 
                {
                    var args = Array.prototype.slice.call(arguments);
                    var result = chef(steps, args);
                    return result;
                } 
            );
            return perfect;
        }
        
        /**
         * Returns the given text, with all &, <, and > replaced by their HTML
         * entities
         * 
         * @param {String} text
         * 
         * @return String
         */
        function escapeHtmlSpecialChars( text ) 
        {
            var result = text
                .replace( /&/g, "&amp;" )
                .replace( /</g, "&lt;" )
                .replace( />/g, "&gt;" )
            ;
            return result;
        }
        
        /**
         * Returns the given text, with all spaces replaced by the 
         * replaceSpace string
         * 
         * @param {String} text
         * 
         * @return String
         */
        function escapeSpaces( text ) 
        {
            var result = text
                .replace(/ /g, book.replaceSpace)
            ;
            return result;
        }
        
        /**
         * Returns the given text, escaped for HTML and with spaces replaced 
         * by the replaceSpace string
         * 
         * @param {String} text
         * 
         * @return String
         */
        function filter( text ) 
        {
            var result = escapeHtmlSpecialChars( text );
            if ( book.replaceSpace ) 
            {
                result = escapeSpaces( result );
            }
            return result;
        }
        
        /**
         * Returns the result of applying the given recipe to the given subject
         * 
         * @param {String} subject
         * @param {Object} recipe
         * 
         * @return String
         */
        function applyRecipe( subject, recipe ) 
        {
            return cook( subject, recipe );
        }

        /**
         * Returns the result of applying the given blockName of the given 
         * recipe to the given subject
         * 
         * @param {String} subject
         * @param {Object} recipe
         * @param {String} blockName
         * 
         * @return String
         */
        function applyBlock( subject, recipe, blockName ) 
        {
            return cook( subject, recipe, blockName );
        }

        /**
         * Returns the result of applying the given stepName of the given 
         * blockName of the given recipe to the given subject
         * 
         * @param {String} subject
         * @param {Object} recipe
         * @param {String} blockName
         * @param {String} stepName
         * 
         * @return String
         */
        function applyStep( subject, recipe, blockName, stepName ) 
        {
            var replaceSpace = book.replaceSpace;
            var step = prepareStep( recipe, blockName, stepName );
            var steps = [step];
            var flags = recipe._case 
                ? "g" 
                : "gi";
            var perfect = subject.replace( knowHow( steps, flags ), 
                function() 
                {
                    var args = Array.prototype.slice.call(arguments);
                    return chef(steps, args);
                } 
            );
            return perfect;
        }
        
        /**
         * Returns the requested action according to the empty configuration of 
         * the given values
         * 
         * @param {String} recipeName
         * @param {String} blockName
         * @param {String} stepName
         * 
         * @return String
         */
        function requestedAction( recipeName, blockName, stepName ) 
        {
            if ( '' != stepName )   return 'applyStep';
            if ( '' != blockName )  return 'applyBlock';
            if ( '' != recipeName ) return 'applyRecipe';
            return '';
        }
        
        /**
         * Returns the interpretation of the given module into the given context
         * 
         * @param {String} module
         * @param {Object} context
         * 
         * @return Object
         */
        function detectAction( module, context )
        {
            if (! module)   return;
            var re = new RegExp('^(?!(?:/$|.+/$|.+//$|.+//.))([^/]*)(?:/([^/]*)(?:/([^/]+))?)?$');
            var matches = (module || '').match(re);
            if (! matches)  return; // Expected recipe[/block[/step]] module format
            var recipeName = matches[1] || '';
            var blockName  = matches[2] || '';
            var stepName   = matches[3] || '';
            var action = requestedAction( recipeName, blockName, stepName );
            var recipe = getRecipe( recipeName, context );
            var result = {
                  action:     action
                , recipeName: recipeName 
                , blockName:  blockName
                , stepName:   stepName
                , recipe:     recipe
                , context:    context
            };
            return result;
        }
        
        /**
         * Returns the cached recipe with the given recipeName if recipeName is 
         * not empty, else the recipe from context
         * 
         * @param {String} recipeName
         * @param {Object} context
         * 
         * @return Object
         */
        function getRecipe( recipeName, context ) 
        {
            var recipe = null;
            if ( '' == recipeName )
            {
                recipe = context.recipe;
            }
            else 
            {
                var path = getRecipePath( recipeName );
                recipe = book.recipes[ path ];
            }
            return recipe;
        }
        
        /**
         * Downloads a recipe by means of a JSON ajax call and, on success, 
         * applies the cbFunction callback, passing it all cbData array elements
         * as arguments, to any element waiting for being highlighted on the 
         * queue of the recipe identified by path
         *
         * @param {String} path
         * @param {Function} cbFunction
         * @param {Array} cbData
         */
        function downloadRecipe( path, cbFunction, cbData )
        {
            book.queue[ path ] = [];
            $.getJSON( path, function( recipeLoaded ) 
    		{
                book.recipes[ path ] = recipeLoaded;
                var q = book.queue[ path ];
                for( var i = 0, iTop = q.length; i < iTop; i++ )
                {
                    var el = q[ i ];
                    if ('undefined' == typeof el.nodeType) 
                    {
                        el = $(el.selector)[0];
                    }
                    var recipeName = recipeLoaded._name;
                    $(el).trigger( 'chili.before_coloring', [recipeName] );
                    cbFunction.apply(q[ i ], cbData);
                    $(el).trigger( 'chili.after_coloring', [recipeName] );
                }
            } );
        }
        
        /**
         * Returns the result of applying the given detected action to the given
         * subject
         * 
         * @param {String} subject
         * @param {Object} detected
         * 
         * @return String
         */
        function applyAction( subject, detected )
        {
            var action     = detected['action'];
            var recipeName = detected['recipeName'];
            var blockName  = detected['blockName'];
            var stepName   = detected['stepName'];
            var recipe     = detected['recipe'];
            var context    = detected['context'];
            switch (action)
            {
                case 'applyRecipe':
                    return applyRecipe( subject, recipe );
                break;
                case 'applyBlock':
                    if (! (blockName in recipe))            return filter( subject );
                    return applyBlock( subject, recipe, blockName );
                break;
                case 'applyStep':
                    if ('' == blockName) 
                    {
                        blockName = context.blockName;
                    }
                    if (! (blockName in recipe))            return filter( subject );
                    if (! (stepName  in recipe[blockName])) return filter( subject );
                    return applyStep( subject, recipe, blockName, stepName );
                break;
                default:
                    //nothing to do
                break;
            }
        }

        /**
         * Returns the result of applying the given module to the given subject 
         * into the given context
         * 
         * @param {String} subject
         * @param {String} module
         * @param {Object} context
         * 
         * @return String
         */
        function applyModule( subject, module, context ) 
        {
            var result = filter( subject );
            var detected = detectAction( module, context );
            if (typeof detected == 'undefined') return result;
            if (detected['recipe'])
            {
                result = applyAction(subject, detected);
                return result;
            }
            var path = getRecipePath( detected['recipeName'] );
            if ( book.recipeLoading ) 
            {
                // dynamic setups come here too
                if (! book.queue[ path ]) 
                {
                    downloadRecipe(path, replaceElement);
                }
                var cue = 'chili_' + unique();
                book.queue[ path ].push( {
                    selector: '#' + cue, 
                    subject:  subject, 
                    module:   module, 
                    context:  context
                } );
                result = '<span id="' + cue + '">' + result + '</span>';
                return result;
            }
            return result;
        }
        
        /**
         * Loads the given CSS code as a new style element of head
         * 
         * @param {string} sourceCode
         */
        function loadStylesheetInline( sourceCode ) 
        { 
            if ( document.createElement ) 
            { 
                var style_element = document.createElement( "style" ); 
                style_element.type = "text/css"; 
                if ( style_element.styleSheet ) 
                {
                    style_element.styleSheet.cssText = sourceCode; // IE
                }  
                else 
                { 
                    var t = document.createTextNode( sourceCode ); 
                    style_element.appendChild( t ); 
                } 
                var head = document.getElementsByTagName( "head" )[0];
                head.appendChild( style_element ); 
            } 
        }
        
        /**
         * Returns a CSS class definition with the given className and the given
         * classStyle
         *
         * @param {String} className
         * @param {String} classStyle
         * 
         * @return String
         */
        function cssClassDefinition( className, classStyle )
        {
            var result = ''
                + '.' + className + '\n'
                + '{\n' 
                + '\t' + classStyle + '\n'
                + '}\n'
            ;
            return result;
        }
        
        /**
         * Returns the style sheet of the given recipe
         *
         * @param {Object} recipe
         * 
         * @return string
         */
        function makeStylesheet( recipe )
        {
            var name = recipe._name;
            var content = ['/* Chili -- ' + name + ' */'];
            for (var blockName in recipe) 
            {
                if ( blockName.search( /^_(?!main\b)/ ) >= 0 ) 
                    continue; // if _bar but not _main nor foo
                var block = recipe[ blockName ];
                for (var stepName in block) 
                {
                    var step = block[ stepName ];
                    if (! '_style' in step) 
                        continue;
                    var style_def = step[ '_style' ];
                    if ( typeof style_def == 'string' ) 
                    {
                        var oStyle = {};
                        oStyle[ stepName ] = style_def;
                        style_def = oStyle;
                    }
                    for (var className in style_def) 
                    {
                        var stepClass = name + '__' + className;
                        var stepStyle = style_def[ className ];
                        var def = cssClassDefinition( stepClass, stepStyle );
                        content.push(def);
                    }
                }
            }
            var result = content.join('\n');
            return result;
        }
        
        /**
         * If needed, generates and loads the style sheet of the given recipe 
         * into the current page
         * 
         * @param {Object} recipe
         */
        function checkSpices( recipe ) 
        {
            var name = recipe._name;
            if ( ! book.queue[ name ] ) 
            {
                var stylesheet = makeStylesheet(recipe);
                loadStylesheetInline(stylesheet);
                book.queue[ name ] = true;
            }
        }
        
        /**
         * Detects the recipe to use for highlighting the given DOM element and 
         * makes it happen, for static and dynamic setups
         * 
         * @param {Element} dom_element
         */
        function askDish( dom_element ) 
        {
            var recipeName = book.codeLanguage( dom_element );
            if ( '' == recipeName )
                return;
            var path = getRecipePath( recipeName );
            if ( book.recipeLoading ) 
            {
                // dynamic setups come here
                if ( ! book.queue[ path ] ) 
                {
                    downloadRecipe(path, makeDish, [path]);
                }
                book.queue[ path ].push( dom_element );
            }
            else 
            {
                // static setups come here
                $(dom_element).trigger( 'chili.before_coloring', [recipeName] );
                makeDish.apply( dom_element, [path] );
                $(dom_element).trigger( 'chili.after_coloring', [recipeName] );
            }
        }
        
        /**
         * Replaces source code in the given DOM element with its highlighted 
         * version
         */
        function replaceElement()
        {
            var replacement = applyModule( this.subject, this.module, this.context );
            if ( book.replaceTab ) 
            {
                replacement = replacement.replace( /\t/g, book.replaceTab );
            }
            if ( book.replaceNewLine ) 
            {
                replacement = replacement.replace( /\n/g, book.replaceNewLine );
            }
            var dom_element = $( this.selector )[0];
            dom_element.innerHTML = replacement;
        }
        
        /**
         * Returns the given ingredients after making new lines uniform across 
         * all browsers
         *
         * @param {String} ingredients
         * 
         * @return Element dom_element
         */
        function fixNewLines( ingredients, dom_element )
        {
            //fix for msie: \r (13) is used instead of \n (10)
            //fix for opera: \r\n is used instead of \n
            ingredients = ingredients.replace(/\r\n?/g, '\n');
            //reverse fix for safari: msie, mozilla and opera render the initial \n
            if ( $(dom_element).parent().is('pre') ) 
            {
                if ( ! $.browser.safari ) 
                {
                    ingredients = ingredients.replace(/^\n/g, '');
                }
            }
            return ingredients;
        }
        
        /**
         * Sets the start of the ol tag of the current DOM element
         * 
         * @param {String} groupStart
         * @param {String} groupId
         * @param {String} start
         */
        function setLineNumbersStart( groupStart, groupId, start )
        {
            if ( groupStart ) 
            {
                start = parseInt( groupStart, 10 );
                var $pieces = $( '.ln-' + groupStart + '-' + groupId );
                var $that = $(this).parent();
                var pos = $pieces.index( $that[0] );
                $pieces
                    .slice( 0, pos )
                    .each( 
                        function() 
                        {
                            start += $( this ).find( 'li' ).length;
                        } 
                    )
                ;
            }
            else if ( start ) 
            {
                start = parseInt( start, 10 );
            }
            else 
            {
                start = 1;
            }
            $(this).find( 'ol' )[0].start = start;
            // the following should refresh the window
            $('body')
                .width( $('body').width() - 1 )
                .width( $('body').width() + 1 )
            ;
        }
        
        /**
         * If needed, adds line numbers with a proper start to the given 
         * dom_element
         * 
         * @param {Element} dom_element
         */
        function checkLineNumbers( dom_element )
        {
            var $that = $(dom_element).parent();
            var classes = $that.attr( 'class' );
            var ln = /ln-(\d+)-([\w][\w\-]*)|ln-(\d+)|ln-/.exec( classes );
            if ( ln ) 
            {
                addLineNumbers( dom_element );
                setLineNumbersStart.apply( dom_element, ln );
            }
            else if ( book.lineNumbers ) 
            {
                addLineNumbers(dom_element);
            }
        }
        
        /**
         * Highlights the current DOM element using the recipe identified by the
         * given recipePath
         */
        function makeDish( recipePath ) 
        {
            var recipe = book.recipes[ recipePath ];
            if (! recipe) 
                return;
            var ingredients = $( this ).text();
            if (! ingredients) 
                return;
            ingredients = fixNewLines( ingredients, this );
            var recipeName = getRecipeName(recipePath);
            replaceElement.apply({
                selector: this, 
                subject:  ingredients, 
                module:   recipeName, 
                context:  {}
            });
            fixTextSelection(this);
            checkLineNumbers(this);
        }
        
        /**
         * Converts lines inside the given dom_element to list items
         * 
         * @param {Element} dom_element
         */
        function addLineNumbers( dom_element ) 
        {
            var result = $( dom_element ).html();
            result = extractImmediateBreaksInsideSpans(result);
            result = convertLinesInsideSpans(result);
            result = convertRemainingLines(result);
            result = fillEmptyListItems(result);
            result = '<ol>' + result + '</ol>';
            dom_element.innerHTML = result;
            
            /**
             * Returns a list item that wraps he given textBeforeLastLine or 
             * lastLine
             * 
             * @param {String} lineBeforeLastLine
             * @param {String} textBeforeLastLine
             * @param {String} lastLine
             * @param {String} openSpan
             * 
             * @return String
             */
            function makeListItem( lineBeforeLastLine, textBeforeLastLine, lastLine, openSpan ) 
            {
                var closeSpan = openSpan ? '</span>' : '';
                var result = '';
                if (lineBeforeLastLine) 
                {
                    result = '<li>' + openSpan + textBeforeLastLine + closeSpan + '</li>';
                }
                else if (lastLine) 
                {
                    result = '<li>' + openSpan + lastLine + closeSpan + '</li>';
                }
                return result;
            }
            
            /**
             * Returns the given html, after moving out of the spans their immediate
             * breaks, if any
             * 
             * @param {String} html
             * 
             * @return String
             */
            function extractImmediateBreaksInsideSpans( html )
            {
                var expr = /(<span [^>]+>)((?:(?:&nbsp;|\xA0)<br>)+)(.*?)(<\/span>)/ig;
                var repl = '$2$1$3$4';
                var result = html.replace( expr, repl );
                return result;
            }
            
            /**
             * Returns the given html, after wrapping each line inside spans with an
             * <li> element
             * 
             * @param {String} html
             * 
             * @return String
             */
            function convertLinesInsideSpans( html )
            {
                var expr = /(.*?)(<span .*?>)(.*?)(?:<\/span>(?:&nbsp;|\xA0)<br>|<\/span>)/ig;
                var repl = function( all, anythingBeforeSpan, openSpan, anythingInsideSpan ) 
                {
                    if (! /<br>/i.test(anythingInsideSpan)) 
                    {
                        return all;
                    }
                    var expr = /((.*?)(?:&nbsp;|\xA0)<br>)|(.*)/ig;
                    var repl = function( all, lineBeforeLastLine, textBeforeLastLine, lastLine ) 
                    {
                        var result = makeListItem(lineBeforeLastLine, textBeforeLastLine, lastLine, openSpan);
                        return result;
                    };
                    var result = anythingBeforeSpan + anythingInsideSpan.replace(expr, repl);
                    return result;
                };
                var result = html.replace(expr, repl);
                return result;
            }
            
            /**
             * Returns the given html, after wrapping each remaining line with an
             * <li> element
             * 
             * @param {String} html
             * 
             * @return String
             */
            function convertRemainingLines( html ) 
            {
                var expr = /(<li>.*?<\/li>)|((.*?)(?:&nbsp;|\xA0)<br>)|(.+)/ig;
                var repl = function( all, prev_li, lineBeforeLastLine, textBeforeLastLine, lastLine ) 
                {
                    if (prev_li) 
                    {
                        return all;
                    }
                    var result = makeListItem(lineBeforeLastLine, textBeforeLastLine, lastLine, '');
                    return result;
                };
                var result = html.replace(expr, repl);
                return result;
            }
            
            /**
             * Returns the given html, after filling each empty <li> element with a
             * space replacement
             * 
             * @param {String} html
             * 
             * @return String
             */
            function fillEmptyListItems( html )
            {
                var expr = /<li><\/li>/ig;
                var repl = '<li>' + book.replaceSpace + '</li>';
                var result = html.replace( expr, repl );
                return result;
            }
        }
        
        /**
         * When a user selects highlighted text, IE and FF returns a mess: this
         * function displays a minimal dialog with the selected text, cleaned up 
         */
        function fixTextSelection( dom_element )
        {
            //opera and safari select PRE text correctly 
            if ($.browser.msie || $.browser.mozilla) 
            {
                var element = null;
                $(dom_element)
                    .parents()
                    .filter("pre")
                    .bind("mousedown", resetSelectedTextElement)
                    .bind("mouseup", displaySelectedTextDialog)
                ;
            }
            
            /**
             * Clears anything that was selected before
             */
            function clearPreviousSelection()
            {
            	if ($.browser.msie) 
                {
                    document.selection.empty();
                }
                else
                {
                    window.getSelection().removeAllRanges();
                }
            }
            
            /**
             * Resets the currently selected element
             * 
             * This is later used to check that the user selected text from
             * the same element
             */
            function resetSelectedTextElement() 
            {
                element = this;
                clearPreviousSelection();
            }
            
            /**
             * Returns the text selected by the user
             */
            function getSelectedText()
            {
            	var result = $.browser.msie 
            		? document.selection.createRange().htmlText
    				: window.getSelection().toString();
        		return result;
            }
            
            /**
             * Returns the given html after replacing any HTML break and block by a 
             * new line
             *
             * @param {String} html
             * 
             * @return String 
             */
            function preserveNewLines( html )
            {
                var newline_flag = unique(html);
                var text = '';
                if (/<br/i.test(html) || /<li/i.test(html)) 
                {
                    if (/<br/i.test(html)) 
                    {
                        html = html.replace( /\<br[^>]*?\>/ig, newline_flag );
                    }
                    else if (/<li/i.test(html)) 
                    {
                        html = html.replace( /<ol[^>]*?>|<\/ol>|<li[^>]*?>/ig, '' ).replace( /<\/li>/ig, newline_flag );
                    }
                    var el = $( '<pre>' ).appendTo( 'body' ).hide()[0];
                    el.innerHTML = html;
                    text = $( el ).text().replace( new RegExp( newline_flag, "g" ), '\r\n' );
                    $( el ).remove();
                }
                return text;
            }
            
            /**
             * Returns the given text, after removing garbage characters
             */
            function cleanText( text )
            {
            	var result = $.browser.msie
            		? preserveNewLines(text)
    				: text
	                    .replace( /\r/g, '' )
	                    .replace( /^# ?/g, '' )
	                    .replace( /\n# ?/g, '\n' );
        		return result;
            }
            
            /**
             * Shows a dialog containing the given text
             */
            function makeDialog( selected, event )
            {
            	var container_tag = $.browser.msie
            		? ('<textarea style="' + Chili.selectionStyle + '">')
    				: ('<pre style="' + Chili.selectionStyle + '">');
            		
        		var result = $(container_tag)
                    .appendTo( 'body' )
                    .text( selected )
                    .attr( 'id', 'chili_selection' )
                    .click( function() { $(this).remove(); } )
                ;
                var top  = event.pageY - Math.round( result.height() / 2 ) + "px";
                var left = event.pageX - Math.round( result.width() / 2 ) + "px";
                result.css( { top: top, left: left } );
                    
            	return result;
            }
            
            /**
             * Selects the text in the given $container
             */
            function selectTextAgain($container)
            {
            	if ($.browser.msie) 
                {
                    $container[0].focus();
                    $container[0].select();
                }
                else 
                {
                    var s = window.getSelection();
                    s.removeAllRanges();
                    var r = document.createRange();
                    r.selectNodeContents( $container[0] );
                    s.addRange( r );
                }
            }
            
            /**
             * Shows a dialog containing the text selected by the user
             */
            function displaySelectedTextDialog( event ) 
            {
                if (! (element && element == this)) 
                {
                	return;
                }
                element = null;
                
                var selectedText = getSelectedText();
                if ( '' == selectedText ) 
                { 
                    return;
                }
                selectedText = cleanText(selectedText);
                
                var $container = makeDialog(selectedText, event);
                selectTextAgain($container);
            }
        }
        
        /**
         * Returns a unique number. If the given text is not undefined the 
         * return value is guaranteed to be unique inside text
         * 
         * @param {String} text
         * 
         * @return int
         */
        function unique( text ) 
        {
            var result = (new Date()).valueOf();
            while( text && text.indexOf( result ) > -1 );
            { 
                result = (new Date()).valueOf();
            }
            return result;
        }
    };
    
    $.extend(Chili, 
    {
        /**
         * Returns the codes of any character of the given text
         * 
         * @param {String} text
         * 
         * @return String
         */
        revealChars: function ( text ) 
        {
            var result = [];
            for (var i=0, iTop=text.length; i<iTop; i++)
            {
                result.push(text[i] + ' <- ' + text.charCodeAt(i));
            }
            result = result.join('\n');
            return result;
        },
        replaceSpace:   "&#160;", // IE and FF convert &#160; to "&nbsp;", Safari and Opera do not
        replaceTab:     "&#160;&#160;&#160;&#160;",
        replaceNewLine: "&#160;<br />",
        recipes:        {} //repository
    });
}
)(jQuery);
