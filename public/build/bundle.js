
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.43.1' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.43.1 */

    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let div;
    	let svg1;
    	let svg0;
    	let defs;
    	let style;
    	let t0;
    	let linearGradient0;
    	let stop0;
    	let stop1;
    	let stop2;
    	let stop3;
    	let stop4;
    	let stop5;
    	let stop6;
    	let stop7;
    	let linearGradient1;
    	let stop8;
    	let stop9;
    	let path0;
    	let path1;
    	let path2;
    	let path3;
    	let path4;
    	let path5;
    	let path6;
    	let path7;
    	let path8;
    	let path9;
    	let path10;
    	let path11;
    	let t1;
    	let main;
    	let p;

    	const block = {
    		c: function create() {
    			div = element("div");
    			svg1 = svg_element("svg");
    			svg0 = svg_element("svg");
    			defs = svg_element("defs");
    			style = svg_element("style");
    			t0 = text(".cls-1{fill:url(#linear-gradient);}.cls-2{fill:url(#linear-gradient-2);}");
    			linearGradient0 = svg_element("linearGradient");
    			stop0 = svg_element("stop");
    			stop1 = svg_element("stop");
    			stop2 = svg_element("stop");
    			stop3 = svg_element("stop");
    			stop4 = svg_element("stop");
    			stop5 = svg_element("stop");
    			stop6 = svg_element("stop");
    			stop7 = svg_element("stop");
    			linearGradient1 = svg_element("linearGradient");
    			stop8 = svg_element("stop");
    			stop9 = svg_element("stop");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			path4 = svg_element("path");
    			path5 = svg_element("path");
    			path6 = svg_element("path");
    			path7 = svg_element("path");
    			path8 = svg_element("path");
    			path9 = svg_element("path");
    			path10 = svg_element("path");
    			path11 = svg_element("path");
    			t1 = space();
    			main = element("main");
    			p = element("p");
    			p.textContent = "Updating...";
    			add_location(style, file, 4, 153, 182);
    			attr_dev(stop0, "offset", "0.04");
    			attr_dev(stop0, "stop-color", "#07f4c1");
    			add_location(stop0, file, 4, 354, 383);
    			attr_dev(stop1, "offset", "0.11");
    			attr_dev(stop1, "stop-color", "#07efbe");
    			add_location(stop1, file, 4, 396, 425);
    			attr_dev(stop2, "offset", "0.19");
    			attr_dev(stop2, "stop-color", "#09e0b7");
    			add_location(stop2, file, 4, 438, 467);
    			attr_dev(stop3, "offset", "0.28");
    			attr_dev(stop3, "stop-color", "#0ac8aa");
    			add_location(stop3, file, 4, 480, 509);
    			attr_dev(stop4, "offset", "0.37");
    			attr_dev(stop4, "stop-color", "#0da698");
    			add_location(stop4, file, 4, 522, 551);
    			attr_dev(stop5, "offset", "0.47");
    			attr_dev(stop5, "stop-color", "#107a81");
    			add_location(stop5, file, 4, 564, 593);
    			attr_dev(stop6, "offset", "0.57");
    			attr_dev(stop6, "stop-color", "#144565");
    			add_location(stop6, file, 4, 606, 635);
    			attr_dev(stop7, "offset", "0.63");
    			attr_dev(stop7, "stop-color", "#172252");
    			add_location(stop7, file, 4, 648, 677);
    			attr_dev(linearGradient0, "id", "linear-gradient");
    			attr_dev(linearGradient0, "x1", "67.74");
    			attr_dev(linearGradient0, "y1", "209.8");
    			attr_dev(linearGradient0, "x2", "445.23");
    			attr_dev(linearGradient0, "y2", "276.36");
    			attr_dev(linearGradient0, "gradientUnits", "userSpaceOnUse");
    			add_location(linearGradient0, file, 4, 240, 269);
    			attr_dev(stop8, "offset", "0.35");
    			attr_dev(stop8, "stop-color", "#172252");
    			add_location(stop8, file, 4, 825, 854);
    			attr_dev(stop9, "offset", "1");
    			attr_dev(stop9, "stop-color", "#07f4c1");
    			add_location(stop9, file, 4, 867, 896);
    			attr_dev(linearGradient1, "id", "linear-gradient-2");
    			attr_dev(linearGradient1, "x1", "476.1");
    			attr_dev(linearGradient1, "y1", "307.59");
    			attr_dev(linearGradient1, "x2", "1455.47");
    			attr_dev(linearGradient1, "y2", "307.59");
    			attr_dev(linearGradient1, "gradientUnits", "userSpaceOnUse");
    			add_location(linearGradient1, file, 4, 707, 736);
    			add_location(defs, file, 4, 147, 176);
    			attr_dev(path0, "class", "cls-1");
    			attr_dev(path0, "d", "M236.56,98.09l1.7,0,82.24-.86s70.08,5.23,70.08,73.33c0,48.65-50.57,72.62-50.57,72.62L428.63,370.5H376.48s-68.57-98.58-75.68-108-28.64-32.82-28.64-32.82,4,.06,14.68-1.66,35.92-14.16,35.92-14.16,22.17-8.59,22.17-42.29c0-31.55-37.09-35.7-37.09-35.7l-6.22-.35-36.75-.94s-.34-1.28-.75-2.57a134.14,134.14,0,0,0-9.45-16.31c-3.43-4.82-17.11-16.17-17.11-16.17ZM219.69,223.37s30.44-20.52,30.44-64.35c0-47.48-54.7-61.74-77.74-61.74-22.09,0-85.39,3.31-85.39,3.31V370.5l105.39-2.43s75.82-12.61,75.82-79.66C268.21,234.85,219.69,223.37,219.69,223.37ZM133.43,331.2V135.72s69-13.39,69,37.74-54.27,56.17-54.27,56.17l-.39.41.36.33s71.51-.39,71.51,55.44S133.43,331.2,133.43,331.2Z");
    			attr_dev(path0, "transform", "translate(-87 -97.28)");
    			add_location(path0, file, 4, 930, 959);
    			attr_dev(path1, "class", "cls-2");
    			attr_dev(path1, "d", "M476.1,242h54.36c21.59,0,41.21,7.56,41.21,31.49,0,13.5-9,25.92-22.31,28.8v.36c16.55,2.16,27.17,14.58,27.17,31.32,0,12.24-4.32,36.54-46.07,36.54H476.1Zm12.24,56.33h42.12c19.62,0,29-9.72,29-21.78,0-16-9.89-24.11-29-24.11H488.34Zm0,61.74h42.12c18.17.18,33.83-5.94,33.83-26.46,0-16.38-12.41-24.84-33.83-24.84H488.34Z");
    			attr_dev(path1, "transform", "translate(-87 -97.28)");
    			add_location(path1, file, 4, 1650, 1679);
    			attr_dev(path2, "class", "cls-2");
    			attr_dev(path2, "d", "M594.18,242h11.34V370.5H594.18Z");
    			attr_dev(path2, "transform", "translate(-87 -97.28)");
    			add_location(path2, file, 4, 2022, 2051);
    			attr_dev(path3, "class", "cls-2");
    			attr_dev(path3, "d", "M710.45,324.06c0,26.64-15.48,49.14-43.91,49.14s-43.92-22.5-43.92-49.14,15.48-49.14,43.92-49.14S710.45,297.42,710.45,324.06Zm-76.49,0c0,19.8,10.8,39.6,32.58,39.6s32.57-19.8,32.57-39.6-10.8-39.6-32.57-39.6S634,304.26,634,324.06Z");
    			attr_dev(path3, "transform", "translate(-87 -97.28)");
    			add_location(path3, file, 4, 2113, 2142);
    			attr_dev(path4, "class", "cls-2");
    			attr_dev(path4, "d", "M792.89,306.78c-3.06-13.86-11.51-22.32-26.27-22.32-21.78,0-32.58,19.8-32.58,39.6s10.8,39.6,32.58,39.6c14,0,25.55-11,27-26.46H805c-3.06,22.32-17.64,36-38.33,36-28.44,0-43.92-22.5-43.92-49.14s15.48-49.14,43.92-49.14c19.79,0,35.09,10.62,37.61,31.86Z");
    			attr_dev(path4, "transform", "translate(-87 -97.28)");
    			add_location(path4, file, 4, 2399, 2428);
    			attr_dev(path5, "class", "cls-2");
    			attr_dev(path5, "d", "M820.8,242h11.33v80.63l51.48-45h15.12L859.13,312l42.3,58.5H887.21l-36.72-50.58-18.36,15.3V370.5H820.8Z");
    			attr_dev(path5, "transform", "translate(-87 -97.28)");
    			add_location(path5, file, 4, 2705, 2734);
    			attr_dev(path6, "class", "cls-2");
    			attr_dev(path6, "d", "M913,242h58.85c21.24,0,39.06,10.26,39.06,33.47,0,16.2-8.46,29.52-25,32.76v.36c16.74,2.16,21.6,13.68,22.5,29,.54,8.82.54,26.46,5.94,32.94h-13.5c-3.06-5-3.06-14.58-3.42-20-1.08-18-2.52-38-25.74-37.08H925.2V370.5H913Zm12.24,61h45.71c14.94,0,27.72-9.36,27.72-25s-9.36-25.55-27.72-25.55H925.2Z");
    			attr_dev(path6, "transform", "translate(-87 -97.28)");
    			add_location(path6, file, 4, 2867, 2896);
    			attr_dev(path7, "class", "cls-2");
    			attr_dev(path7, "d", "M1037.51,327.12c.18,16.56,8.82,36.54,30.6,36.54,16.56,0,25.56-9.72,29.16-23.76h11.34c-4.86,21.06-17.1,33.3-40.5,33.3-29.52,0-41.94-22.68-41.94-49.14,0-24.48,12.42-49.14,41.94-49.14,29.88,0,41.76,26.1,40.86,52.2Zm60.12-9.54c-.54-17.1-11.16-33.12-29.52-33.12-18.54,0-28.8,16.2-30.6,33.12Z");
    			attr_dev(path7, "transform", "translate(-87 -97.28)");
    			add_location(path7, file, 4, 3215, 3244);
    			attr_dev(path8, "class", "cls-2");
    			attr_dev(path8, "d", "M1113.83,277.63h12.6l29.16,81.53h.36l28.8-81.53h11.7l-34.74,92.87h-12.06Z");
    			attr_dev(path8, "transform", "translate(-87 -97.28)");
    			add_location(path8, file, 4, 3561, 3590);
    			attr_dev(path9, "class", "cls-2");
    			attr_dev(path9, "d", "M1207.79,242h11.34v18.18h-11.34Zm0,35.64h11.34V370.5h-11.34Z");
    			attr_dev(path9, "transform", "translate(-87 -97.28)");
    			add_location(path9, file, 4, 3694, 3723);
    			attr_dev(path10, "class", "cls-2");
    			attr_dev(path10, "d", "M1247.57,327.12c.18,16.56,8.82,36.54,30.6,36.54,16.56,0,25.56-9.72,29.16-23.76h11.34c-4.86,21.06-17.1,33.3-40.5,33.3-29.52,0-41.94-22.68-41.94-49.14,0-24.48,12.42-49.14,41.94-49.14,29.88,0,41.76,26.1,40.86,52.2Zm60.12-9.54c-.54-17.1-11.16-33.12-29.52-33.12-18.54,0-28.8,16.2-30.6,33.12Z");
    			attr_dev(path10, "transform", "translate(-87 -97.28)");
    			add_location(path10, file, 4, 3814, 3843);
    			attr_dev(path11, "class", "cls-2");
    			attr_dev(path11, "d", "M1325,277.63H1337l23.76,79.55h.36l22.68-79.55h12.78l22.68,79.55h.36l23.76-79.55h12.06l-29.88,92.87h-12.42l-22.86-78.12H1390l-22.68,78.12h-12.42Z");
    			attr_dev(path11, "transform", "translate(-87 -97.28)");
    			add_location(path11, file, 4, 4160, 4189);
    			attr_dev(svg0, "id", "Layer_1");
    			attr_dev(svg0, "data-name", "Layer 1");
    			attr_dev(svg0, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg0, "xmlns:xlink", "http://www.w3.org/1999/xlink");
    			attr_dev(svg0, "viewBox", "0 0 1368.47 175.92");
    			add_location(svg0, file, 4, 2, 31);
    			add_location(svg1, file, 3, 1, 23);
    			attr_dev(div, "class", "image svelte-4lfv5s");
    			add_location(div, file, 2, 0, 2);
    			add_location(p, file, 10, 1, 4426);
    			attr_dev(main, "class", "svelte-4lfv5s");
    			add_location(main, file, 8, 0, 4416);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, svg1);
    			append_dev(svg1, svg0);
    			append_dev(svg0, defs);
    			append_dev(defs, style);
    			append_dev(style, t0);
    			append_dev(defs, linearGradient0);
    			append_dev(linearGradient0, stop0);
    			append_dev(linearGradient0, stop1);
    			append_dev(linearGradient0, stop2);
    			append_dev(linearGradient0, stop3);
    			append_dev(linearGradient0, stop4);
    			append_dev(linearGradient0, stop5);
    			append_dev(linearGradient0, stop6);
    			append_dev(linearGradient0, stop7);
    			append_dev(defs, linearGradient1);
    			append_dev(linearGradient1, stop8);
    			append_dev(linearGradient1, stop9);
    			append_dev(svg0, path0);
    			append_dev(svg0, path1);
    			append_dev(svg0, path2);
    			append_dev(svg0, path3);
    			append_dev(svg0, path4);
    			append_dev(svg0, path5);
    			append_dev(svg0, path6);
    			append_dev(svg0, path7);
    			append_dev(svg0, path8);
    			append_dev(svg0, path9);
    			append_dev(svg0, path10);
    			append_dev(svg0, path11);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, p);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(main);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
