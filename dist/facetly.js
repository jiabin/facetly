/*! Facetly - v0.1.0 - 2013-06-26
* https://github.com/jiabin/facetly
* Copyright (c) 2013 Eymen Gunay; Licensed MIT */

var Facetly = Facetly || (function($) {

    var Utils     = {}, // Toolbox
        Ajax      = {}, // Ajax Wrapper
        Events    = {}, // Event-based Actions
        Templates = {}, // Handlebar Templates
        UI        = {}, // App Interface
        Query     = {}, // Elasticsearch Query Helper
        App       = {}, // Global Logic and Initializer
        Public    = {}; // Public Functions

    /* -----------------------------------------
       UTILS
    ----------------------------------------- */
    Utils = {
        settings: {
            debug: false,
            selector: '#facetly',
            elasticsearch: 'http://localhost:9200',
            perPage: 25,
            currentPage: 1,
            excludedFields: [],
            meta: {},
            onSerialize: function(str, obj) {},
            init: function(settings) {
                _log('Initializing Settings');
                $('meta[name^="facetly-"]').each(function(){
                    Utils.settings.meta[ this.name.replace('facetly-','') ] = this.content;
                });
                Utils.settings = Utils.extend(Utils.settings, settings);
                element = $(Utils.settings.selector);
                _log('Initialized Settings');
            }
        },
        cache: {
            window: window,
            document: document
        },
        extend: function(obj1, obj2) {
            return $.extend(obj1, obj2);
        },
        deepExtend: function(obj1, obj2) {
            return Object.deepExtend({}, obj1, obj2);
        },
        merge: function(arr1, arr2) {
            return $.merge(arr1, arr2);
        },
        elastic_url: function() {
            return Utils.settings.elasticsearch;
        },
        elastic_search_url: function() {
            return Utils.elastic_url();
        },
        log: function(what) {
            if (Utils.settings.debug) {
                console.log(what);
            }
        },
        parseRoute: function(input) {

            var delimiter = input.delimiter || '/',
                paths = input.path.split(delimiter),
                check = input.target[paths.shift()],
                exists = typeof check != 'undefined',
                isLast = paths.length == 0;
            input.inits = input.inits || [];

            if (exists) {
                if(typeof check.init == 'function'){
                    input.inits.push(check.init);
                }
                if (isLast) {
                    input.parsed.call(undefined, {
                        exists: true,
                        type: typeof check,
                        obj: check,
                        inits: input.inits
                    });
                } else {
                    Utils.parseRoute({
                        path: paths.join(delimiter),
                        target: check,
                        delimiter: delimiter,
                        parsed: input.parsed,
                        inits: input.inits
                    });
                }
            } else {
                input.parsed.call(undefined, {
                    exists: false
                });
            }
        },
        route: function(){

            Utils.parseRoute({
                path: Utils.settings.meta.route,
                target: Routes,
                delimiter: '/',
                parsed: function(res) {
                    if(res.exists && res.type=='function'){
                        if(res.inits.length!=0){
                            for(var i in res.inits){
                                res.inits[i].call();
                            }
                        }
                        res.obj.call();
                    }
                }
            });

        }
    };
    var _log = Utils.log;

    /* -----------------------------------------
       AJAX
    ----------------------------------------- */
    Ajax = {
        send: function(type, url, data, returnFunc){
            $.ajax({
                type: type,
                url: url,
                dataType: 'json',
                data: data,
                success: returnFunc
            });
        },
        call: function(url, data, returnFunc) {
            Ajax.send('POST', url, data, returnFunc);
        },
        get: function(url, data, returnFunc) {
            Ajax.send('GET', url, data, returnFunc);
        }
    };

    /* -----------------------------------------
       EVENTS
    ----------------------------------------- */
    Events = {
        endpoints: {
            serializeTerms: function(e) {
                var name = $(this).attr('data-name');
                var query = $("#facetly-form ul#facet-"+name+" :input").serializeObject();
                Query.holder[name] = {};
                var i = 0;
                for (q in query[name]) {

                    var operator = query[name][q].operator;
                    var value = query[name][q].value;

                    if (operator != '' && value != '') {

                        if (Query.holder[name][operator] == undefined) Query.holder[name][operator] = [];

                        var object = {};
                        object['wildcard'] = {};
                        object['wildcard'][name] = query[name][q].value;
                        Query.holder[name][query[name][q].operator].push(object);
                        i++;
                    }
                }
                App.loadResults();
            },
            serializeNested: function(e) {
                var name = $(this).attr('data-name');
                var query = $("#facetly-form ul#facet-"+name+" :input").serializeObject();
                var path = Utils.settings.facets[name].nested;
                var field = Utils.settings.facets[name].terms.field ? Utils.settings.facets[name].terms.field : Utils.settings.facets[name].terms.script_field;
                Query.holder[name] = {};
                var i = 0;
                for (q in query[name]) {

                    var operator = query[name][q].operator;
                    var value = query[name][q].value;

                    if (query[name][q].operator != '' && query[name][q].value != '') {

                        if (Query.holder[name][query[name][q].operator] == undefined) {
                            Query.holder[name][query[name][q].operator] = [];
                        }

                        var object = {};
                        object['nested'] = {
                            path: path,
                            query: {
                                wildcard: {}
                            }
                        };
                        object['nested']['query']['wildcard'][field] = query[name][q].value;
                        Query.holder[name][query[name][q].operator].push(object);
                        i++;
                    }
                }
                App.loadResults();
            },
            clone: function(e) {
                var li = $(this).closest('li');
                var clone = $(li).clone();
                var name = $(this).attr('data-name');
                // Remove bound information
                clone.find('*').removeAttr('data-bound');
                // Change index number
                var length = Utils.cache.window.tmp[name];

                length === undefined ? Utils.cache.window.tmp[name] = $("ul#facet-"+name+" select").length : Utils.cache.window.tmp[name]++;

                var inputName = clone.find('input').attr('name').replace(/[0-9]+/, Utils.cache.window.tmp[name]);
                clone.find('input').attr('name', inputName);
                var selectName = clone.find('select').attr('name').replace(/[0-9]+/, Utils.cache.window.tmp[name]);
                clone.find('select').attr('name', selectName);
                // Put clone after the current elem
                $(li).after(clone);
                // Rebind events
                Events.bindEvents();
            },
            remove: function(e) {
                var li = $(this).closest('li');
                var ul = $(li).parent();

                // Check custom count
                if ($('li.custom', ul).length == 1) {
                    return false;
                }

                $(li).remove();
                Events.bindEvents();
            }
        },
        serialize: function() {
            var query = {bool: {}};

            query.bool['must'] = [];
            query.bool['should'] = [];
            query.bool['must_not'] = [];

            var inc = 0;
            for (i in Query.holder) {
                for (ii in Query.holder[i]) {
                    for (iii in Query.holder[i][ii]) {
                        query.bool[ii].push(Query.holder[i][ii][iii]);
                        inc++;
                    }
                }
            }
            var query = inc == 0 ? Query.matchAllQuery() : query;
            var object = {query: query, size: Utils.settings.perPage};
            var string = Query.create(query);
            if (Utils.settings.onSerialize) Utils.settings.onSerialize(object, string);
            return object;
        },
        bindEvents: function(){
            _log('Binding Events');
            $('[data-event]').each(function(){
                var _this = this,
                    method = _this.dataset.method || 'click',
                    name = _this.dataset.event,
                    bound = _this.dataset.bound;

                if(!bound){
                    Utils.parseRoute({
                        path: name,
                        target: Events.endpoints,
                        delimiter: '.',
                        parsed: function(res) {
                            if(res.exists){
                                _this.dataset.bound = true;
                                $(_this).on(method, function(e){
                                    res.obj.call(_this, e);
                                });
                           }
                        }
                    });
                }
            });
            _log('Events Bound');
        },
        init: function(){
            Events.bindEvents();
        }
    };

    /* -----------------------------------------
       TEMPLATES
    ----------------------------------------- */
    Templates = {
        init: function() {
            _log('Compiling templates');
            Templates.types.terms = Handlebars.compile(Templates.types.terms);
            Templates.types.nested = Handlebars.compile(Templates.types.nested);
            // Random helper
            Handlebars.registerHelper('random', function() {
                var randLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
                var uniqid = randLetter + Date.now();
                return uniqid;
            });
            // Increment helper
            Handlebars.registerHelper('inc', function(val) {
                return val + 1;
            });
            // Type helper
            Handlebars.registerHelper('type', function(facet, name) {
                var template = Templates.types[facet._type];
                if (Utils.settings.facets[name].nested != undefined) template = Templates.types['nested'];
                return new Handlebars.SafeString(template({facet: facet, name: name}));
            });
            // Facets helper
            Handlebars.registerHelper('facets', function(name, options) {
                return options.fn(Utils.settings.facets[name]);
            });
            // Thead helper
            Handlebars.registerHelper('thead', function(results) {
                var html = '<tr>';
                for (i in results.hits.hits) {
                    for (key in results.hits.hits[i]._source) {
                        html += '<th>'+key+'</th>';
                    }
                    break;
                }
                html += '</tr>';
                return new Handlebars.SafeString(html);
            });
            // JSON helper
            Handlebars.registerHelper('json', function(context) {
                if (typeof context == 'object') {
                    return JSON.stringify(context);
                } else {
                    return context;
                }
            });
            Templates.facets = Handlebars.compile(Templates.facets);
            Templates.results = Handlebars.compile(Templates.results);
            _log('Templates Compiled');
        },
        types: {
            nested: '<ul id="facet-{{name}}"> \
                <li class="custom"> \
                    <select class="input-small" name="{{name}}[0][operator]" data-type="operator" data-name="{{name}}" data-event="serializeNested" data-method="change"> \
                        <option value=""></option> \
                        <option value="must">Must</option> \
                        <option value="should">Should</option> \
                        <option value="must_not">Must Not</option> \
                    </select> \
                    <div class="input-append"> \
                        <input class="input-medium" name="{{name}}[0][value]" type="text" data-name="{{name}}" data-type="value" data-event="serializeNested" data-method="keyup"> \
                        <a href="javascript:void()" class="add-on" data-event="clone" data-name="{{name}}" data-method="click"><i class="icon-plus"></i></a> \
                        <a href="javascript:void()" class="add-on" data-event="remove" data-name="{{name}}" data-method="click"><i class="icon-remove"></i></a> \
                    </div> \
                </li> \
                {{#each facet.terms}} \
                    <li> \
                        <select class="input-small" name="{{../name}}[{{inc @index}}][operator]" data-name="{{../name}}" data-event="serializeNested" data-method="change"> \
                            <option value=""></option> \
                            <option value="must">Must</option> \
                            <option value="should">Should</option> \
                            <option value="must_not">Must Not</option> \
                        </select> \
                        <input class="input-medium" type="text" value="{{this.term}}" name="{{../name}}[{{inc @index}}][value]" readonly="readonly" data-event="serializeNested" data-method="keyup"> \
                        <small>({{this.count}})</small> \
                    </li> \
                {{/each}} \
            </ul>',
            terms: '<ul id="facet-{{name}}"> \
                <li class="custom"> \
                    <div class="form-inline"> \
                        <select class="input-small" name="{{name}}[0][operator]" data-type="operator" data-name="{{name}}" data-event="serializeTerms" data-method="change"> \
                            <option value=""></option> \
                            <option value="must">Must</option> \
                            <option value="should">Should</option> \
                            <option value="must_not">Must Not</option> \
                        </select> \
                        <div class="input-append"> \
                            <input class="input-medium" name="{{name}}[0][value]" type="text" data-name="{{name}}" data-type="value" data-event="serializeTerms" data-method="keyup"> \
                            <a href="javascript:void()" class="add-on" data-event="clone" data-name="{{name}}" data-method="click"><i class="icon-plus"></i></a> \
                            <a href="javascript:void()" class="add-on" data-event="remove" data-name="{{name}}" data-method="click"><i class="icon-remove"></i></a> \
                        </div> \
                    </div> \
                </li> \
                {{#each facet.terms}} \
                    <li> \
                        <div class="form-inline"> \
                            <select class="input-small" name="{{../name}}[{{inc @index}}][operator]" data-name="{{../name}}" data-event="serializeTerms" data-method="change"> \
                                <option value=""></option> \
                                <option value="must">Must</option> \
                                <option value="should">Should</option> \
                                <option value="must_not">Must Not</option> \
                            </select> \
                            <input class="input-medium" type="text" value="{{this.term}}" name="{{../name}}[{{inc @index}}][value]" readonly="readonly" data-event="serializeTerms" data-method="keyup"> \
                            <small>({{this.count}})</small> \
                        </div> \
                    </li> \
                {{/each}} \
            </ul>'
        },
        results: '<div class="box-scrollable"> \
            <table class="table table-striped table-bordered"> \
                <thead> \
                    {{thead results}} \
                </thead> \
                <tbody> \
                    {{#each results.hits.hits}} \
                    <tr> \
                        {{#each this._source}} \
                            <td>{{json this}}</td> \
                        {{/each}} \
                    </tr> \
                    {{else}} \
                    <tr> \
                        <td>No results found</td> \
                    </tr> \
                    {{/each}} \
                </tbody> \
            </table> \
        </div> \
        <p>{{results.hits.total}} results found</p>',
        facets: '<form id="facetly-form"> \
            <ul> \
                {{#each facets}} \
                    <li> \
                        <div class="header"> \
                            {{@key}} \
                            <small>Total: {{this.total}}</small> \
                            <small>Other: {{this.other}}</small> \
                        </div> \
                        <div class="content"> \
                            {{type this @key}} \
                        </div> \
                    </li> \
                {{/each}} \
            </ul> \
        </form> \
        <script> \
        $( "'+Utils.settings.selector+' ul" ).accordion({ \
            header: "> li > .header", \
            heightStyle: "content" \
        }); \
        </script>'
    };

    /* -----------------------------------------
       INTERFACE
    ----------------------------------------- */
    UI = {
        init: function() {
            UI.container = Handlebars.compile(UI.container);
            UI.container = $(UI.container());

            UI.sidebar   = Handlebars.compile(UI.sidebar);
            UI.sidebar   = $(UI.sidebar());

            UI.results   = Handlebars.compile(UI.results);
            UI.results   = $(UI.results());

            element.append(UI.container);
            UI.container.append(UI.sidebar);
            UI.container.append(UI.results);
        },
        container: '<div class="row-fluid"></div>',
        sidebar: '<div class="sidebar span4"></div>',
        results: '<div class="results span8"></div>'
    };

    /* -----------------------------------------
       QUERY
    ----------------------------------------- */
    Query = {
        create: function(query) {
            return JSON.stringify(query)
        },
        matchAllQuery: function() {
            var query = {};
            query['match_all'] = {};
            return query;
        },
        holder: {},
    };

    /* -----------------------------------------
       APP
    ----------------------------------------- */
    App = {
        logic: {},
        init: function(settings) {
            _log('Initializing Facetly');
            Utils.settings.init(settings);
            UI.init();
            Templates.init();
            _log('Initialized Facetly');

            // Dirty hack for cache
            Utils.cache.window.tmp = {};

            // Get facets
            App.loadFacets(function() {
                Events.init();
            });
            App.loadResults(function() {
                Events.init();
            });
        },
        loadFacets: function(callback) {
            _log('Getting Facets');
            Ajax.call(Utils.elastic_search_url(), Query.create({facets: Utils.settings.facets, query: Query.matchAllQuery}), function(data) {
                UI.sidebar.html(Templates.facets({facets: data.facets }));
                _log('Facets Loaded');
                if (callback) callback();
            });
        },
        loadResults: function(callback) {
            _log('Loading Results');
            Ajax.call(Utils.elastic_search_url(), Query.create(Events.serialize()), function(data) {
                UI.results.html(Templates.results({results: data}));
                _log('Results Loaded');
                if (callback) callback();
            });
        }
    };
    var element;

    /* -----------------------------------------
       PUBLIC
    ----------------------------------------- */
    Public = {
        init: function(settings) {
            App.init(settings);
        },
        loadFacets: App.loadFacets,
        templates: App.Templates
    };

    return Public;

})(window.jQuery);

// Serialize Object
// https://github.com/macek/jquery-serialize-object
(function(e){e.fn.serializeObject=function(){var t=this,n={},r={},i={validate:/^[a-zA-Z][a-zA-Z0-9_]*(?:\[(?:\d*|[a-zA-Z0-9_]+)\])*$/,key:/[a-zA-Z0-9_]+|(?=\[\])/g,push:/^$/,fixed:/^\d+$/,named:/^[a-zA-Z0-9_]+$/};this.build=function(e,t,n){e[t]=n;return e};this.push_counter=function(e){if(r[e]===undefined){r[e]=0}return r[e]++};e.each(e(this).serializeArray(),function(){if(!i.validate.test(this.name)){return}var r,s=this.name.match(i.key),o=this.value,u=this.name;while((r=s.pop())!==undefined){u=u.replace(new RegExp("\\["+r+"\\]$"),"");if(r.match(i.push)){o=t.build([],t.push_counter(u),o)}else if(r.match(i.fixed)){o=t.build([],r,o)}else if(r.match(i.named)){o=t.build({},r,o)}}n=e.extend(true,n,o)});return n}})(jQuery)

// Deep extend
// http://andrewdupont.net/2009/08/28/deep-extending-objects-in-javascript/
Object.deepExtend=function(e,t){for(var n in t){if(t[n]&&t[n].constructor&&t[n].constructor===Object){e[n]=e[n]||{};arguments.callee(e[n],t[n])}else{e[n]=t[n]}}return e};