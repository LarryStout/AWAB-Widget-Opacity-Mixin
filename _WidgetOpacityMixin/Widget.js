///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
  'dojo/_base/declare',
  'dojo/_base/array',
  'dojo/_base/lang',
  'dojo/_base/fx',
  'dojo/aspect',
  'dojo/dom',
  'dojo/dom-construct', 
  'dojo/dom-geometry',
  'dojo/dom-style',
  'dojo/fx',
  'dojo/i18n',
  'dojo/json',
  'dojo/on',
  'dojo/parser',
  'dijit/form/HorizontalRule',
  'dijit/form/HorizontalRuleLabels',
  'dijit/form/HorizontalSlider',
  'dijit/form/ToggleButton',
  'dijit/registry',
  'dijit/Tooltip',
  // 'dijit/_WidgetBase',
  'dojo/text!./widget.html',
  'dojo/text!./config.json',
  'dojo/query',
  'dojo/NodeList-traverse',
  'xstyle/css!./css/style.css'
], function(
  declare,
  array,
  lang,
  fx,
  aspect,
  dom,
  domConstruct,
  domGeometry,
  domStyle,
  dojoFx,
  i18n,
  JSON,
  on, 
  parser,
  HorizontalRule,
  HorizontalRuleLabels,
  HorizontalSlider,
  ToggleButton,
  registry,
  Tooltip,
  // _WidgetBase,
  _womTemplate,
  _womConfig,
  query
) {
  var clazz = declare([], {
    _womConfig: JSON.parse(_womConfig),
    _womTemplateString: _womTemplate,
    _womStartupHasRun: false,
    
    postMixInProperties:function() {
      // There may be a better way to do this...
      if (window.jimuConfig && window.jimuConfig.nls && window.jimuConfig.nls.$locale) {
        this._womNls = i18n.getLocalization('.MapViewer1-DEV/widgets/_WidgetOpacityMixin', 'strings', window.jimuConfig.nls.$locale);
      } else if (navigator.language) {
        this._womNls = i18n.getLocalization('.MapViewer1-DEV/widgets/_WidgetOpacityMixin', 'strings', navigator.language);
      } else {
        this._womNls = i18n.getLocalization('.MapViewer1-DEV/widgets/_WidgetOpacityMixin', 'strings');
      }
      
      // Set these variables in using this priority: host widget config; _WidgetOpacityMixin config; default value
      // _womConfig = JSON.parse(_womConfig);
      this._womResizeDelay = this.config.resizeDelay || this._womConfig.resizeDelay || 100;
      this._womOpacityOver = this.config.widgetOpacityOver || this._womConfig.widgetOpacityOver || 1.0;
      this._womOpacityOut = this.config.widgetOpacityOut || this._womConfig.widgetOpacityOut || 0.9;
      
      // Give the template tags unique IDs for each widget that uses this module.
      this._womTemplateString = lang.replace(this._womTemplateString, {
        _womParentWidget: {
          id:this.id.toString()
        },
        _womNls: {
          max: this._womNls.max,
          min: this._womNls.min,
          widgetOpacity: this._womNls.widgetOpacity,
          showSlider: this._womNls.showSlider
        },
        _womInitialSliderValue: this._womOpacityOut.toString()
      });
    },
    
    startup: function() {
      // if (this._womStartupHasRun) { return; }
      // this._womStartupHasRun = true;
      
      this.inherited(arguments);
      
      // We can ignore this mixin with a "showOpacitySlider": false in a widget's config.json file.
      // This mixin doesn't make sense on widgets not in a panel.
      if (this.config.showOpacitySlider === false || !this.inPanel) { return; }

      // Get the widget panel and title node
      this._womWidgetPanel = this._womGetAncestorWithBaseClass(this, 'jimu-widget-panel');
      this._womTitleNode = this._womWidgetPanel.titleNode;
      this._womWidgetContentNode = this._womGetAncestorWithBaseClass(this, 'jimu-widget-frame').domNode;
      var titleColor = domStyle.get(this._womWidgetPanel.titleLabelNode, 'color');
      
      // Create a new node on the Widget tite bar, insert the template into it, and initiate (parse) the dijits.
      var titleLabelNode = this._womWidgetPanel.titleLabelNode;
      var widgetOpacityNode = domConstruct.place('<div id="widgetOpacity' + this.id + '" style="display:inline-block"></div>', titleLabelNode, 'after');
      widgetOpacityNode.innerHTML = this._womTemplateString;
      parser.parse(widgetOpacityNode);  // Parse only this specific mixin

      // Set variables for the dijits and nodes
      this._womToggleButton = registry.byId('opacityToggleButton' + this.id);
      this._womSlider = registry.byId('opacitySlider' + this.id);
      this._womTooltip = registry.byId('opacityTooltip' + this.id);
      this._womSliderNode = dom.byId('opacitySliderNode' + this.id);
      this._womSliderRule = registry.byId('opacitySliderRule' + this.id);
      this._womSliderLabels = registry.byId('opacitySliderLabels' + this.id);
      
      // Set up the event handlers for the dijits  (because data-dojo-attach-event in the template isn't recognized)
      this._womToggleButton.on('click', lang.hitch(this, '_womOnClick'));
      this._womToggleButton.on('change', lang.hitch(this, '_womToggleSlider'));
      this._womSlider.on('click', lang.hitch(this, '_womOnClick'));
      this._womSlider.on('change', lang.hitch(this, '_womSliderChange'));

      this._womHandlers = [];
      
      // Set the position and display of the toggle button 
      // (setting the display here keeps the position setting from causing a visual movement)
      var availableHeaderArea = this._womGetAvailableHeaderArea();
      domStyle.set(this._womToggleButton.domNode, {
        'marginTop': (availableHeaderArea.h - 24) / 2 + 'px',
        'display': 'inline-block'
      });
      
      // Set the initial opacity of the widget
      domStyle.set(this._womWidgetContentNode, 'opacity', this._womOpacityOut);
      
      // Set the color of the slider labels and ticks
      domStyle.set(this._womSliderLabels.domNode, 'color', titleColor);
      array.forEach(this._womSliderRule.domNode.childNodes, function(child) {
        domStyle.set(child, { 'borderLeftColor': titleColor, 'borderRightColor': titleColor });
      });
      
      // Set the event handlers to run after the open, close, and resize events
      aspect.after(this, 'onOpen', lang.hitch(this, '_womOnOpen'));
      aspect.after(this, 'onClose', lang.hitch(this, '_womOnClose'));
      aspect.after(this, 'resize', lang.hitch(this, '_womResize'));
      
      // Set the docked status, position and initial size of the slider
      this._womResize();
    },

    _womOnOpen: function() {
      // Show the widget opacity button and slider (if enabled)
      domStyle.set(this._womToggleButton.domNode, 'display', 'inline-block');
      domStyle.set(this._womSliderNode, 'display', 'inline-block');
      
      // Set up the event handler to control the widget opacity as the mouse enters and leaves the widget
      var widgetMouseEnterLeaveHandler = on(this._womWidgetContentNode, 'mouseenter, mouseleave', lang.hitch(this, function(evt) {
        this._womSetWidgetOpacity(evt);
      }));
      this._womHandlers.push(widgetMouseEnterLeaveHandler);
      
      // Set up the event handler to hide/show the widget opacity button and slider when the widget is minimized/maximized
      var titleClickHandler = on(this._womTitleNode, 'click', lang.hitch(this, function() {
        var minimized = this.domNode.clientHeight === 0 || this._womWidgetPanel.folded === true;
        domStyle.set(this._womToggleButton.domNode, 'display', minimized ? 'none' : 'inline-block');
        domStyle.set(this._womSliderNode, 'display', minimized ? 'none' : 'inline-block');
      }));
      this._womHandlers.push(titleClickHandler);
    },
    
    _womOnClose: function() {
      // Remove the widget opacity event handlers
      array.forEach(this._womHandlers, lang.hitch(this, function(handler) {
        handler.remove();
        handler = null;
      }));
    },
    
    _womResize: function() {
      // If the widget docked, its panel will have the same width as the innerWidth of the browser window.
      // Delay for a brief time to allow the panel to attain its full size.
      setTimeout(lang.hitch(this, function() {
        this._womIsDocked = this._womIsWidgetDocked();
        
        // Center the opacity slider
        var availableHeaderArea = this._womGetAvailableHeaderArea();
        this._womSetOpacitySliderParameters(availableHeaderArea);
      }), this.resizeDelay);
    },
    
    _womOnClick: function(evt) {
      // This keeps the widget from minimizing.
      evt.stopImmediatePropagation();
    },
    
    _womToggleSlider: function(val) {
      var toggleFadeOut = fx.animateProperty({
        node: this._womToggleButton.domNode, 
        duration: 500,
        properties: { opacity: { start: "1", end: "0" } },
        onEnd: lang.hitch(this, function() {
          this._womTooltip.close();
          this._womToggleButton.set('iconClass', val ? 'opacityToggleOn' : 'opacityToggleOff');
          this._womTooltip.set('label', val ? this._womNls.hideSlider : this._womNls.showSlider);
        })
      });
      var toggleFadeIn = fx.animateProperty({
        node: this._womToggleButton.domNode, 
        duration: 500,
        properties: { opacity: { start: "0", end: "1" } }
      });
      var buttonFade = dojoFx.chain([toggleFadeOut, toggleFadeIn]);
      var sliderFade = fx.animateProperty({
        node: this._womSliderNode, 
        duration: 500,
        properties: { opacity: { start: val ? "0" : "1", end: val ? "1" : "0" } }
      });
      dojoFx.combine([buttonFade, sliderFade]).play();
    },
    
    _womSliderChange: function(value) {
      this._womOpacityOut = value;
      this._womSetWidgetOpacity();
    },

    _womGetAncestorWithBaseClass: function(ancestor, baseClass) {
      if (!ancestor) {
        return null;
      } else if (ancestor.baseClass && ancestor.baseClass.indexOf(baseClass) !== -1) {
        return ancestor;
      } else {
        var newAncestor = ancestor.getParent();
        return this._womGetAncestorWithBaseClass(newAncestor, baseClass);
      }
    },
    
    _womGetAvailableHeaderArea: function() {
      var node, computedStyle, titleLabelBox, toggleBox, nextBox, l, w;
      
      // Get the margin box for the widget title
      node = this._womWidgetPanel.titleLabelNode;
      computedStyle = domStyle.getComputedStyle(node);
      titleLabelBox = domGeometry.getMarginBox(node, computedStyle);
      
      node = this._womToggleButton.domNode;
      computedStyle = domStyle.getComputedStyle(node);
      toggleBox = domGeometry.getMarginBox(node, computedStyle);

      // Get the margin box for the widget close "X"
      // node = this._womWidgetPanel.closeNode;
      // computedStyle = domStyle.getComputedStyle(node);
      // closeBox = domGeometry.getMarginBox(node, computedStyle);
      
      // Get the node after the widget opacity node
      node = query(this._womWidgetPanel.titleLabelNode).next().next()[0];
      computedStyle = domStyle.getComputedStyle(node);
      nextBox = domGeometry.getMarginBox(node, computedStyle);

      // Return the left, width, and height of the available space between the toggle button and the widget close "X"
      l = titleLabelBox.l + titleLabelBox.w + toggleBox.w;
      w = nextBox.l - l - 8;
      return { l: 1, w: w, h: nextBox.h };
    },
    
    _womSetOpacitySliderParameters: function(availableBox) {
      var sliderWidth, sliderLeft, fontSize, labelsLeft;
      
      // Slider width & location
      sliderWidth = Math.min(255, availableBox.w);
      sliderLeft = availableBox.l;
      domStyle.set(this._womSliderNode, {
        width: sliderWidth + 'px',
        left: sliderLeft + 'px'
      });
      
      // Label height & offsets
      // Set the fontSize so the this._womNls.widgetOpacity string doesn't wrap.
      // 156 is the exact threshold for 'Widget Opacity' in English to not wrap.
      if (sliderWidth > 160) {
        fontSize = 9;
        labelsLeft = 6;
      } else if (sliderWidth > 125) {
        fontSize = 8;
        labelsLeft = 8;
      } else if (sliderWidth > 50) {
        fontSize = 7;
        labelsLeft = 13;
      } else {
        fontSize = 0;
        domStyle.set(this._womSliderNode, 'display', 'none');
      }
      
      if (fontSize > 0) {
        domStyle.set(this._womSliderNode, 'display', 'inline-block');
        domStyle.set(this._womSliderLabels.domNode, 'fontSize', fontSize + 'px');
      }
    },
    
    _womSetWidgetOpacity: function(evt) {
      var opacity;
      var hover = evt && evt.type === 'mouseenter';
      if (this._womWidgetContentNode) {
        if (this._womIsDocked) {
          opacity = this._womOpacityOut;
        } else if (hover) {
          opacity = this._womOpacityOver;
        } else {
          opacity = this._womOpacityOut;
        }
        domStyle.set(this._womWidgetContentNode, 'opacity', opacity);
      }
    },
    
    _womIsWidgetDocked: function() {
      if (this._womWidgetContentNode) {
        var computedStyle = domStyle.getComputedStyle(this._womWidgetContentNode);
        var output = domGeometry.getMarginBox(this._womWidgetContentNode, computedStyle);
        return Math.abs(window.innerWidth - output.w) <= 1;
      } else {
        return true;  //Err on the side of docked for smart phones
      }
    }

  });

  return clazz;
});
