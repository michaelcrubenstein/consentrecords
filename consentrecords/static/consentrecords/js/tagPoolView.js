var ServiceFlagController = (function() {
	ServiceFlagController.prototype.service = null;
	
	ServiceFlagController.prototype.textDetailLeftMargin = 4.5; /* textLeftMargin; */
	ServiceFlagController.prototype.flagLineOneDY = '1.4em';
	ServiceFlagController.prototype.flagHeightEM = 2.333;
	ServiceFlagController.prototype.emToPX = 11;
	
	ServiceFlagController.prototype._getStage = function()
	{
		var service = this.service;
		return service && service.id() && crp.getInstance(service.id()).stage()
	}

	ServiceFlagController.prototype.stageColumns = {
		Housing: 0,
		Studying: 1,
		Certificate: 1,
		Training: 2,
		Whatever: 2,
		Working: 3,
		Teaching: 3,
		Expert: 3,
		Skills: 4,
		Mentoring: 5,
		Tutoring: 5,
		Coaching: 5,
		Volunteering: 5,
		Wellness: 6,
	};
	
	ServiceFlagController.prototype.getStageDescription = function(stage)
	{
		return stage in this.stageColumns && stage;
	}
	
	ServiceFlagController.prototype.getColumn = function()
	{
		var stage = this._getStage();
		var stageDescription = this.getStageDescription(stage);
		if (stageDescription)
			return this.stageColumns[stageDescription];
		var _this = this;
			
		if (this.service && this.service.id())
		{
			var services = crp.getInstance(this.service.id()).serviceImplications();
			/* services may be null if the service has been deleted */
			var s = services && services.find(function(s)
				{
					var stage =  s.service() && s.service().stage();
					return _this.getStageDescription(stage);
				});
			if (s)
				return this.stageColumns[
					this.getStageDescription(s.service().stage())
				];
		}

		/* Other */
		return 7;
	}
	
	ServiceFlagController.prototype.getColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].color;
	}
	
	ServiceFlagController.prototype.fontColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].fontColor;
	}
	
	ServiceFlagController.prototype.flagColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].flagColor;
	}
	
	ServiceFlagController.prototype.poleColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].poleColor;
	}
	
	ServiceFlagController.prototype.description = function()
	{
		return this.service.description();
	}
	
	/* Returns True if the service contains the specified text. */
	ServiceFlagController.prototype.descriptionContains = function(s, prefix)
	{
		return this.service && this.service.descriptionContains(s, prefix);
	}
	
	ServiceFlagController.prototype.colorElement = function(r)
	{
		var colorText = this.getColor();
		r.setAttribute("fill", colorText);
		r.setAttribute("stroke", colorText);
	}
	
	ServiceFlagController.prototype.setFlagText = function(node)
	{
		var g = d3.select(node);
		g.selectAll('text>tspan:nth-child(1)')
			.text(this.description())
	}

	function ServiceFlagController(dataObject) {
		this.service = dataObject;
	}
	
	return ServiceFlagController;
})();

var VerticalReveal = (function() {
	VerticalReveal.prototype.node = null;
	VerticalReveal.prototype._isVisible = true;

	VerticalReveal.prototype.isVisible = function(newValue)
	{
		if (newValue === undefined)
			return this._isVisible;
		else
		{
			this._isVisible = newValue;
			return this;
		}
	}
	
	VerticalReveal.prototype.show = function(args, duration, step, done)
	{
		var jNode = $(this.node);

		if (!args)
			args = {};
		if (args.newHeight === undefined)
			args.newHeight = 'auto';
		if (args.children === undefined)
			args.children = jNode.children();
		duration = args.duration || duration;

		args.children.css('display', '');
		this._isVisible = true;
		var oldHeight = jNode.height();
		jNode.height(args.newHeight);
		if (args.before)
			args.before();
			
		if (!duration)
		{
			if (step) step();
			if (done) done();
			jNode.css('padding-top', "0px")
				 .css('padding-bottom', "0px");
		}
		else if (args.newHeight == 'auto')
		{
			/* This hack smells bad, but it seems to work. The problem occurs in that the code
				below doesn't do the right thing if this item has padding on the bottom. (and maybe the top,
				but I didn't test that. */
			var outerHeight = jNode.outerHeight(false);
			jNode.height(oldHeight);
			jNode.stop().animate({height: outerHeight, "padding-top": "0px", "padding-bottom": "0px"}, {duration: duration, easing: 'swing', step: step, done: done});
			
		}
		else
		{
			var height = jNode.height();
			jNode.height(oldHeight);
			jNode.stop().animate({height: height, "padding-top": "0px", "padding-bottom": "0px"}, {duration: duration, easing: 'swing', step: step, done: done});
		}
	}
	
	VerticalReveal.prototype.hide = function(args)
	{
		var duration = (args && args.duration) ? args.duration : 0;
		var step = (args && args.step) ? args.step : null;
		var done = (args && args.done) ? args.done : null;
		var before = (args && args.before) ? args.before : null;
		
		var jNode = $(this.node);

		var oldHeight = jNode.height();
		var oldPaddingTop = jNode.css('padding-top');
		var oldPaddingBottom = jNode.css('padding-bottom');
		jNode.css('padding-top', '0px')
			 .css('padding-bottom', '0px')
			 .height(0);
		if (before)
			before();
			
		if (!duration)
		{
			if (step) step();
			if (done) done();
			jNode.children().css('display', 'none');
			this._isVisible = false;
		}
		else
		{
			var _this = this;
			jNode.css('padding-top', oldPaddingTop)
				 .css('padding-bottom', oldPaddingBottom)
				 .height(oldHeight)
				 .animate({height: '0px', 'padding-top': '0px', 'padding-bottom': '0px'}, {duration: duration, easing: 'swing', step: step, done: 
				function() {
					jNode.children().css('display', 'none');
					_this._isVisible = false;
					if (done) done();
				}});
		}
	}
			
	function VerticalReveal(node)
	{
		this.node = node;
		this._isVisible = true;
	}
	
	return VerticalReveal;
})();

var TagPoolView = (function () {
	TagPoolView.prototype.container = null;
	TagPoolView.prototype.div = null;
	
	TagPoolView.prototype.flagHSpacing = 15;
	TagPoolView.prototype.flagVSpacing = 1.0;
	TagPoolView.prototype.flagHeightEM = 2.333;
	TagPoolView.prototype.emToPX = 11;

	TagPoolView.prototype.node = function()
	{
		return this.div.node();
	}
	
	TagPoolView.prototype.flags = function()
	{
		return this.div.selectAll('span.flag');
	}
	
	TagPoolView.prototype.$flags = function()
	{
		return $(this.div.node()).children('span.flag');
	}
	
	/* Sets the x, y and y2 coordinates of each flag. */
	TagPoolView.prototype._setFlagCoordinates = function(g, maxX)
	{
		var _this = this;

		var deltaY = this.flagHeightEM + this.flagVSpacing;
		var startX = 0;
		var nextY = 0;
		var nextX = 0;
		g.each(function(fd, i)
			{
				fd.x = nextX;
				if (fd.visible === undefined || fd.visible)
				{
					var thisSpacing = $(this).outerWidth();
					nextX += thisSpacing;
					if (nextX >= maxX && fd.x > startX)
					{
						nextY += deltaY;
						nextX = startX;
						fd.x = nextX;
						nextX += thisSpacing;
					}
					nextX += _this.flagHSpacing;
				}
				
				fd.y = nextY;
				fd.y2 = fd.y + fd.flagHeightEM;
			});
		
		return (nextY + this.flagHeightEM) * this.emToPX;
	}
	
	/* Lay out all of the contents within the div object. */
	TagPoolView.prototype.layoutFlags = function(maxX, duration)
	{
		maxX = maxX !== undefined ? maxX : $(this.div.node()).width();
		duration = duration !== undefined ? duration : 700;
		
		var g = this.flags();
		
		var height = this._setFlagCoordinates(g, maxX);
		
		/* If it wasn't visible, transform instantly and animate its opacity to 1. */
		/* If it was visible and it is still visible, animate its position. */
		/* If it was visible and is not visible, animate opacity to 0 */
		/* Calculate all of the groups before moving any of them so that subsequent sets are properly calculated. */
		
		var hiddenG = g.filter(function(fd) { return parseFloat($(this).css('opacity')) < 1; });
		var movingG = g.filter(function(fd) { return parseInt($(this).css('opacity')) != 0 && 
									   (fd.visible === undefined || fd.visible); });
		var hidingG = g.filter(function(fd) { return parseInt($(this).css('opacity')) != 0 && 
									   !(fd.visible === undefined || fd.visible); });
		var $g = this.$flags();
		$g.stop();
		
		var promises = [];
		hiddenG.each(function(fd)
			{
				var showing = fd.visible === undefined || fd.visible;
				var styles = {left: fd.x, top: fd.y * fd.emToPX, 
					opacity: showing ? 1.0 : 0.0};
				if (!showing &&
					parseFloat($(this).css('opacity')) == 0)
				{
					$(this).css(styles);
				}
				else if (duration == 0)
				{
					styles.display = showing ? '' : 'none';
					$(this).css(styles);
				}
				else
				{
					var _thisFlag = this;
					if (showing)
						$(this).css('display', '');
					promises.push($(this).animate(styles, {duration: duration})
							.promise()
							.done(function() { 
								if (!showing)
									$(_thisFlag).css({display: 'none'}); })
						);
				}
			});
			
		movingG.each(function(fd)
			{
				var styles = {left: fd.x, top: fd.y * fd.emToPX, opacity: 1.0};
				if (duration == 0)
					$(this).css(styles);
				else
					promises.push($(this).animate(styles,
						{duration: duration})
							.promise());
			});
		 
		hidingG.each(function(fd)
			{
				var styles = {left: fd.x, top: fd.y * fd.emToPX, display: 'none'};
				if (duration == 0)
				{
					styles.opacity = 0.0;
					$(this).css(styles);
				}
				else
				{
					promises.push($(this).animate({opacity: 0.0},
						{duration: duration,
						 complete: function()
							{
								$(this).css(styles);
							}})
						.promise());
				}
			});
			
		return $.when.apply(null, promises);
	}
	
	TagPoolView.prototype.setFlagVisibles = function()
	{
		var g = this.flags();
		g.each(function(fs) { fs.visible = undefined; });
	}
	
	TagPoolView.prototype.filterFlags = function(filterText)
	{
		this.setFlagVisibles();
			
		var inputTexts = filterText.toLocaleUpperCase().split(' ');
		var prefix;
		if (inputTexts.length == 1 &&
			inputTexts[0].length == 1)
			prefix = "^";
		else
			prefix = "\\b";
			
		var inputRegExps = inputTexts.map(function(s)
			{
				return new RegExp(prefix + s.replace(/([\.\\\/\^\+])/, "\\$1"), "i");
			});
			
		if (inputTexts.length > 0)
		{
			this.flags().each(function(fs)
				{
					if (!fs.descriptionContains(filterText.toLocaleUpperCase(), prefix) &&
						!inputRegExps.reduce(function(a, b)
							{
								return a && b.test(fs.description());
							}, true))
						fs.visible = false;
				});
		}
	}
	
	TagPoolView.prototype.appendFlag = function(g)
	{
		g.classed('flag', true)
			.style('opacity', 0)
			.style('display', 'none');
		
		g.style('border-left-color',
			function(d)
				{
					return d.poleColor();
				})
			.style('background-color',
			function(d)
				{
					return d.flagColor();
				})
			.style('color',
			function(d)
				{
					return d.fontColor();
				})
			.text(function(d)
				{
					return d.description();
				});
	}
	
	/* Remove all of the existing flags displayed and add all of the specified flags
		to the flag pool.
	 */
	TagPoolView.prototype.appendFlags = function(data)
	{
		var _this = this;
		this.flags().remove();
		
		var g = this.div.selectAll('span')
			.data(data)
			.enter()
			.append('span');
			
		this.appendFlag(g);
		return g;
	}
	
	TagPoolView.prototype.hasNamedService = function(compareText)
	{
		if (compareText.length === 0)
			return true;
		var data = this.flags().data();
		var sd = data.find(function(sd) {
				var d = sd.service;
				return d.names().find(
					function(d) { return d.description().toLocaleLowerCase() === compareText;}) ||
					(d.description && d.description().toLocaleLowerCase() === compareText);
			});
		return sd && sd.service;
	}
	
	function TagPoolView(container, divClass)
	{
		console.assert(container);
		this.container = container;
		this.div = container.append('div')
			.classed(divClass, true);
	}
	
	return TagPoolView;
})();

/* Displays Services. Since the services are taken from the global Services list, this
	search view should never need to interact with the server.
 */
var TagSearchView = (function() {
	TagSearchView.prototype = Object.create(TagPoolView.prototype);
	TagSearchView.prototype.constructor = TagSearchView;

	TagSearchView.prototype.reveal = null;
	TagSearchView.prototype.focusNode = null;
	TagSearchView.prototype.poolSection = null;
	TagSearchView.prototype.controller = null;
	
	TagSearchView.prototype.minRevealedHeight = 118;
	
	TagSearchView.prototype.onTagAdded = function()
	{
	}
	
	TagSearchView.prototype.hideSearch = function(done)
	{
		this.reveal.hide({duration: 200,
						  before: done});
	}
	
	/* Expand this object view so that it fills as much of the window as possible without
		scrolling other elements off screen.
	 */
	TagSearchView.prototype.showSearch = function(duration, step, done)
	{
		duration = duration !== undefined ? duration : 400;
		var parent = $(this.reveal.node).parent();
		var oldHeight = $(this.reveal.node).height();
		//$(this.reveal.node).height(0);
		var newHeight = parent.getFillHeight() - 
						parent.outerHeight(true) + oldHeight;

		if (this.minRevealedHeight > newHeight)
			newHeight = this.minRevealedHeight;
			
		//$(this.reveal.node).height(oldHeight);
		var _this = this;
		if (oldHeight != newHeight)
		{
			this.reveal.show(
				/* To calculate the new height, get the fill height of the parent (the height of its parent minus the height of all other nodes)
					and subtract the parent's height and add back the reveal node's height. */
				{newHeight: newHeight,
				 before: function()
				 	{
				 		_this.layoutFlags(undefined, 0);
				 	}},
				duration, step, done);
		}
		else
			this.layoutFlags(undefined, duration);
	}
	
	TagSearchView.prototype.firstTagInputNode = function()
	{
		return this.poolSection.section.select('.tags-container>input.tag').node();
	}
	
	/* Set the visible flags for each of the services associated with this flags. */
	TagSearchView.prototype.setFlagVisibles = function()
	{
		if (this.focusNode.value)
			TagPoolView.prototype.setFlagVisibles.call(this);
		else if (this.focusNode != this.firstTagInputNode() ||
				 this.controller.hasPrimaryService())
		{
			this.flags().each(function(fs)
				{
					fs.visible = (fs.service.serviceImplications().length > 1) ? false : undefined;
				});
		}
		else
		{
			var types = ["Job", 
						 "School",
						 "Class", 
						 "Interest", 
						 "Skills", 
						 "Internship", 
						 "Volunteer", 
						 "Exercise", 
						 "Housing", 
						 "Travel"];
			this.flags().each(function(fs)
				{
					fs.visible = (types.indexOf(fs.description()) < 0 ? false : undefined);
				});
		}
	}

	TagSearchView.prototype.filterFlags = function(filterText)
	{
		TagPoolView.prototype.filterFlags.call(this, filterText);
		
		if (filterText)
		{
			var flags = this.flags().filter(function(fs) { return fs.visible || fs.visible === undefined; });
			var flagData = flags.data();
			var flagDescriptions = flagData.map(function(fs) { return fs.description().toLocaleUpperCase(); });
			
			var flagIndexOf = function(s)
			{
				var min, mid, max;
				min = 0; 
				max = flagData.length - 1;
				
				var t = s;
				while (max >= min)
				{
					mid = Math.floor((min + max) / 2);
					var target = flagDescriptions[mid];
					if (target < t)
						min = mid + 1;
					else if (target > t)
						max = mid - 1;
					else
						return mid;
				}
				return -1;
			}
			
			var flagIndex = flagIndexOf(filterText.toLocaleUpperCase());
			if (flagIndex >= 0)
			{
				var rootService = flagData[flagIndex];
				// Add to the visible list any item that contains the root service as a sub service.
				this.flags().each(function(fs)
					{
						if (!fs.visible && fs.service.serviceImplications().find(function(subService)
							{
								return subService.service().id() == rootService.service.id();
							}))
							fs.visible = true;
					});
				flags = this.flags().filter(function(fs) { return fs.visible || fs.visible === undefined; });
				flagData = flags.data();
				flagDescriptions = flagData.map(function(fs) { return fs.description().toLocaleUpperCase(); });
			}
			
			var levels = {};
			var levelCount = 1;
			var flagServices = {};
			
			// Fill flagServices with all of the subServices associated with each flag that are
			// in the set of visible flags except for the service itself.
			flags.each(function(fs)
			{
				flagServices[fs.service.id()] = fs.service.serviceImplications()
					.map(function(serviceImplication) { return serviceImplication.service(); })
					.filter(function(s) {
						return flagIndexOf(s.description().toLocaleUpperCase()) >= 0 && 
										   s.id() != fs.service.id();
					});
			});
			
			for (levelCount = 1; 
			     (Object.keys(levels).length < flagData.length &&
				   levelCount <= 3);
				 ++levelCount)
			{
				flags.each(function(fs)
				{
					var thisID = fs.service.id();
					
					if (!(thisID in levels))
					{
						// Add a service into the levels list if all of its visible flags 
						// are already in the levels except for itself.
						var f = function(s)
							{
								return s.id() in levels && levels[s.id()] < levelCount;
							};
						
						if (flagServices[thisID].filter(f).length == flagServices[thisID].length)
							levels[thisID] = levelCount;
					}
				});
			}
			
			flags.each(function(fs)
				{
					fs.visible = fs.service.id() in levels;
				});
		}
	}
	
	TagSearchView.prototype.constrainTagFlags = function(duration)
	{
		this.filterFlags(this.focusNode.value);
		this.layoutFlags(undefined, duration);
	}
	
	TagSearchView.prototype.hasSubService = function(service)
	{
		serviceID = service.id();
		
		return this.poolSection.allServices.find(function(s)
			{
				if (s.id() == serviceID)
					return false;
				return s.serviceImplications().find(function(subS)
					{
						return subS.service().id() == serviceID;
					});
			});
	}
	
	TagSearchView.prototype.onClickButton = function(d) {
		if (prepareClick('click', 'service: ' + d.description()))
		{
			try
			{
				/* If the user clicks a flag that is the same as the flag already there, then move on. 
					If the user clicks a flag that has no sub-flags other than itself, then move on.
					Otherwise, stay there.
				 */	
				var d3Focus = this.focusNode && this.focusNode.parentNode && d3.select(this.focusNode);
				var newDatum;
				
				var moveToNewInput = !this.hasSubService(d.service) ||
					(this.focusNode && 
					 this.focusNode.value.toLocaleUpperCase() == d.description().toLocaleUpperCase());
					
				if (d3Focus && d3Focus.datum())
				{
					var oldService = d3Focus.datum();
					if (oldService instanceof this.controller.serviceLinkType())
					{
						/* Replace the old service link with a new one. */
						if (this.controller.serviceLinks().indexOf(oldService) >= 0)
						{
							oldService.service(d.service)
							     .description(d.service.description())
							     .id(null);
						}
						else
						{
							oldService = this.controller.addService(d.service);
						}
					}
					else if (this.controller.customServiceType() &&
							 oldService instanceof this.controller.customServiceType())
					{
						this.controller.removeCustomService(oldService);
						oldService = this.controller.addService(d.service);
					}
					else
					{
						// This can occur if the datum is null, in which case it
						// May be the datum of the parent.
						oldService = this.controller.addService(d.service);
					}
					this.focusNode.value = d.description();
				}
				else
				{
					this.controller.addService(d.service);
				}
				newDatum = d.service;
				
				$(this.poolSection).trigger('tagsChanged.cr');
				this.poolSection.showTags();

				var container = this.poolSection.section.select('.tags-container');
				var _this = this;
				
				var node;
				if (moveToNewInput)
					node = null;
				else
					node = container
						.selectAll('input.tag')
						.filter(function(d)	
							{ return d instanceof _this.controller.serviceLinkType() &&
									 d.service() == newDatum; })
						.node();
				/* Node can be null if you have just selected a service that is part of
					an offering's services.
				 */
				if (!node)
				{
					var newInput = this.poolSection.appendTag(container, null);
					newInput.node().focus();
				}
				else
					node.focus();
				unblockClick();
			}
			catch(err)
			{
				cr.syncFail(err);
			}
		}

		d3.event.preventDefault();
	}
	
	function TagSearchView(container, poolSection, controller)
	{
		TagPoolView.call(this, container, 'pool-container');
		
		this.poolSection = poolSection;
		this.controller = controller;
		
		this.reveal = new VerticalReveal(container.node());
	}
	
	return TagSearchView;
})();

var TagPoolSection = (function () {
	TagPoolSection.prototype.controller = null;
	TagPoolSection.prototype.section = null;
	TagPoolSection.prototype.tagHelp = null;
	TagPoolSection.prototype.searchView = null;
	TagPoolSection.prototype.allServices = null;

	TagPoolSection.prototype.getInputTextWidth = function(inputNode)
	{
		var div = document.createElement('span');
		$(div).addClass('textWidth')
			.text(inputNode.value || $(inputNode).attr('placeholder'));
		$(inputNode).parent().append(div);
		var width = $(div).outerWidth();
		$(div).remove();
		return width;
	}
	
	TagPoolSection.prototype.setTagColor = function(node)
	{
		if (node == document.activeElement)
		{
			d3.select(node)
				.style('background-color', null)
				.style('border-color', null)
				.style('color', null);
		}
		else
		{
			var pathGuide;
			var d = d3.select(node).datum();
			var service = null;
			
			if (d)
			{
				if (d instanceof cr.Service)
					service = d;
				else if (d instanceof this.controller.serviceLinkType())
					service = d.service();
			}
			
			if (service)
			{
				pathGuide = PathGuides.data[service.getColumn()];
		
				d3.select(node)
					.style('background-color', pathGuide.flagColor)
					.style('border-color', pathGuide.poleColor)
					.style('color', pathGuide.fontColor);
			}
			else if (d && node.value)
			{
				pathGuide = PathGuides.data[PathGuides.data.length - 1];
		
				d3.select(node)
					.style('background-color', pathGuide.flagColor)
					.style('border-color', pathGuide.poleColor)
					.style('color', pathGuide.fontColor);
			}
			else
			{
				d3.select(node)
					.style('background-color', null)
					.style('border-color', null)
					.style('color', null);
			}
		}
	}
	
	TagPoolSection.prototype.setTagInputWidth = function(inputNode)
	{
		var newWidth = this.getInputTextWidth(inputNode) + 18;
		$(inputNode).outerWidth(newWidth);
		
		this.setTagColor(inputNode);
	}
	
	TagPoolSection.prototype.checkTagInput = function(exceptNode)
	{
		var tagsContainer = this.section.select('.tags-container');
		var _this = this;
		tagsContainer.selectAll('input.tag').each(function(d, i)
			{
				/* Skip the exceptNode */
				if (this == exceptNode)
					return;
					
				var newText = this.value.trim();
				var newService = newText && _this.searchView.hasNamedService(newText.toLocaleLowerCase());
				if (!newText ||
					(!newService && !_this.controller.customServiceType()))
				{
					if (d instanceof _this.controller.serviceLinkType())
					{
						/* Remove a standard service */
						_this.controller.removeService(d);
					}
					else if (_this.controller.customServiceType() &&
							 d instanceof _this.controller.customServiceType())
					{
						/* Remove a custom service */
						_this.controller.removeCustomService(d);
					}
					else if (d)
					{
						// This may be the datum associated with the container.
						// In this case, do nothing.
						;
					}
					$(this).remove();
				}
				else if (d instanceof _this.controller.serviceLinkType())
				{
					if (!newService)
					{
						/* Replace standard service with a custom service */
						_this.controller.removeService(d);
						var newValue = _this.controller.addService(newText);
						d3.select(this).datum(newValue);
						$(this).trigger('input');
					}
					else if (newService != d.service())
					{
						/* Replace standard service with a different standard service */
						d.service(newService)
						 .description(newService.description());
						this.value = newService.description();
						$(this).trigger('input');
					}
					else
						{	/* No change */ }
				}
				else if (_this.controller.customServiceType() &&
						 d instanceof _this.controller.customServiceType())
				{
					if (!newService)
					{
						if (newText != d.name())
						{
							/* Replace custom service with a different custom service */
							d.name(newText)
							 .description(newText);
							this.value = newText;
							$(this).trigger('input');
						}
					}
					else
					{
						/* Replace a custom service with a standard service */
						_this.controller.removeCustomService(d);
						var newValue = _this.controller.addService(newService);
						d3.select(this).datum(newValue);
						this.value = newService.description();
						$(this).trigger('input');
					}
				}
				else
				{
					/* The blank tag. */
					_this.controller.addService(newService || newText);
					_this.showTags();
					this.value = "";
					$(this).attr('placeholder', $(this).attr('placeholder'));
				}
			});
		
		$(this).trigger('tagsChanged.cr');	
	}
	
	TagPoolSection.prototype.appendTag = function(container, instance)
	{
		var _this = this;
		
		var input = container.insert('input', 'button')
			.datum(instance)
			.classed('tag', true)
			.attr('placeholder', 'Tag')
			.attr('value', instance && instance.description());
		
		var startFocus;	
		$(input.node())
			.on('mousedown', function(e)
			{
				startFocus = (this != document.activeElement);
			})
			.on('click', function(e)
			{
				if (startFocus && this.selectionStart == this.selectionEnd)
					this.setSelectionRange(0, this.value.length);
				e.preventDefault();
			});
		
		var _this = this;	
		
		$(input.node()).on('input', function()
			{
				/* Check for text changes for all input boxes.  */
				if (this == document.activeElement)
				{
					if (!document.activeElement.value)
						_this.hideAddTagButton();
					else
						_this.showAddTagButton();
					_this.searchView.constrainTagFlags();
				}
				_this.setTagInputWidth(this);
			})
			.on('focusin', function()
			{
				try
				{
					_this.searchView.focusNode = this;
					$(_this).trigger('tagsFocused.cr', this);
				}
				catch (err)
				{
					cr.asyncFail(err);
				}
			})
			.on('focusout', function()
			{
				_this.setTagInputWidth(this);
				$(_this).trigger('tagsChanged.cr', this);
			})
			.keypress(function(e) {
				if (e.which == 13)
				{
					_this.hideReveal();
					e.preventDefault();
				}
			})
			.keydown( function(event) {
				if (event.keyCode == 9) {
					/* If this is an empty node with no instance to remove, then don't handle here. */
					if (!input.node().value && !instance)
						return;
					/* If this is a node whose value matches the previous value, then don't handle here. */
					else if (instance && input.node().value == instance.description())
						return;
					else if (instance && input.node().value != instance.description())
					{
						_this.checkTagInput();
						_this.showAddTagButton();
						/* Do not prevent default. */
					}
					else
					{
						_this.checkTagInput();
						_this.showAddTagButton();
						_this.searchView.constrainTagFlags();
						event.preventDefault();
					}
				}
			});

		this.setTagInputWidth(input.node());
		
		return input;
	}
	
	TagPoolSection.prototype.showTags = function()
	{
		var offeringTags = this.controller.primaryServices() || [];
		var tags = [];
		var _this = this;
		
		var container = this.section.select('.tags-container');
		var tagDivs = container.selectAll('input.tag');
		tags = tags.concat(this.controller.serviceLinks()
			.filter(function(s) 
			{
				var sDescription = s.description();
				return !offeringTags.find(function(d)
					{
						return d.description() === sDescription;
					})
			}));
			
		if (this.controller.customServiceType())
		{
			tags = tags.concat(this.controller.customServices()
				.filter(function(s) 
				{
					var sDescription = s.description();
					return !offeringTags.find(function(d)
						{
							return d.description() === sDescription;
						}) &&
						!tags.find(function(d) 
						{ 
							return d.description() === sDescription; 
						})
				}));
		}
		
		tagDivs.filter(function(d) { return d == null || tags.indexOf(d) < 0; } ).remove();
		
		var ds = tagDivs.data();
		for (var i = 0; i < tags.length; ++i)
		{
			if (ds.indexOf(tags[i]) < 0)
			{
				this.appendTag(container, tags[i]);
			}
			else
			{
				var input = tagDivs.filter(function(d) { return d == tags[i]; });
				input.node().value = tags[i].description();
				this.setTagInputWidth(input.node());
			}
		}
	}
	
	TagPoolSection.prototype.setTagHelp = function()
	{
		if (this.searchView.focusNode == this.searchView.firstTagInputNode() &&
			!this.controller.hasPrimaryService())
			this.tagHelp.text(this.firstTagHelp);
		else
			this.tagHelp.text(this.otherTagHelp);
	}
	
	TagPoolSection.prototype.hideAddTagButton = function(duration)
	{
		var button = this.section.select('.tags-container>button');
		if (duration === 0)
			button.style('opacity', 0)
				  .style('display', 'none');
		else
		{
			if (button.style('display') != 'none')
			{
				button.interrupt().transition()
					.style('opacity', 0)
					.each('end', function()
						{
							button.style('display', 'none');
						});
			}
		}
	}
	
	TagPoolSection.prototype.showAddTagButton = function()
	{
		var button = this.section.select('.tags-container>button');
		if (button.style('display') == 'none')
		{
			button.style('display', null);
			button.interrupt().transition()
				.style('opacity', 1)
				.each('end', function()
					{
						button.style('display', null);
					});
		}
	}
	
	TagPoolSection.prototype.reveal = function()
	{
		return this.searchView.reveal;
	}
	
	TagPoolSection.prototype.hideReveal = function(done)
	{
		this.checkTagInput();
		this.showAddTagButton();
		this.searchView.hideSearch(done);
	}
	
	TagPoolSection.prototype.revealSearchView = function(inputNode, ensureVisible)
	{
		this.setTagHelp();
		var duration = this.searchView.reveal.isVisible() ? undefined : 0;
		this.searchView.constrainTagFlags(duration);
		if (!inputNode.value)
			this.hideAddTagButton(duration);
		else
			this.showAddTagButton();
		
		var _this = this;
		if (ensureVisible)
		{
			this.searchView.showSearch(200, undefined, function()
				{
					var oldTop = $(_this.section.node()).offset().top;
					if (oldTop < $(window).scrollTop())
					{
						var body = $("html, body");
						body.animate({scrollTop: "{0}px".format(oldTop)}, {duration: 200});
					}
				});
		}
		else if (!this.searchView.reveal.isVisible())
		{
			this.searchView.showSearch();
		}
	}
	
	TagPoolSection.prototype.resizeVisibleSearch = function(duration)
	{
		if (this.searchView && this.searchView.reveal.isVisible())
		{
			this.searchView.showSearch(duration);
			return true;
		}
		else
			return false;
	}
	
	TagPoolSection.prototype.fillTags = function()
	{
		var _this = this;
		return cr.Service.servicesPromise()
			.then(function(services)
				{
					_this.allServices = services;
					var controllers = services.map(function(s) { return new ServiceFlagController(s); });
					_this.searchView.appendFlags(controllers)
						.on('click', function(s)
							{
								if (s.visible === undefined || s.visible)
									_this.searchView.onClickButton(s);
								else
									d3.event.preventDefault();
							});
							
					_this.showTags();
				},
				cr.chainFail);
	}
	
	function TagPoolSection(panel, controller, sectionLabel)
	{
		this.controller = controller;
		
		this.section = panel.mainDiv.append('section')
			.classed('cell tags custom', true);
		var tagsTopContainer = this.section.append('div');
		label = tagsTopContainer.append('label')
			.text("{0}:".format(sectionLabel));
		
		var tagsContainer = tagsTopContainer.append('span')
			.classed('tags-container', true);
			
		var _this = this;
		tagsContainer.append('button')
			.classed('site-active-text', true)
			.text('Add Tag')
			.on('click', function()
				{
					var _thisButton = this;
					$(this).stop()
						.animate({opacity: 0}, {duration: 200})
						.promise()
						.then(function()
							{
								$(_thisButton).css('display', 'none');
								_this.checkTagInput(null);
								var tagInput = _this.appendTag(tagsContainer, null);
								tagInput.node().focus();
							});
				});
		
		searchContainer = this.section.append('div');
		
		this.tagHelp = searchContainer.append('div').classed('tag-help', true);
		this.tagHelp.text(this.firstTagHelp);
			
		this.searchView = new TagSearchView(searchContainer, this, controller);
		/* Mark the reveal as not visible or the metrics aren't calculated. */
		this.searchView.reveal.isVisible(false);
	}
	
	return TagPoolSection;
})();