var ServiceFlagController = (function() {
	ServiceFlagController.prototype.service = null;
	
	ServiceFlagController.prototype.flagLineOneDY = '1.4em';
	ServiceFlagController.prototype.flagHeightEM = 2.333;
	ServiceFlagController.prototype.emToPX = 11;
	
	ServiceFlagController.prototype._getStage = function()
	{
		var service = this.service;
		return service && service.id() && crp.getInstance(service.id()).stage()
	}

	ServiceFlagController.prototype.getStageDescription = function(stage)
	{
		return stage in cr.Service.stageColumns && stage;
	}
	
	ServiceFlagController.prototype.getColumn = function()
	{
		var stage = this._getStage();
		var stageDescription = this.getStageDescription(stage);
		if (stageDescription)
			return cr.Service.stageColumns[stageDescription];
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
				return cr.Service.stageColumns[
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
	
	ServiceFlagController.prototype.description = function()
	{
		return this.service ? this.service.description() : "Other";
	}
	
	/* Returns True if the service contains the specified text. */
	ServiceFlagController.prototype.descriptionContains = function(s, prefix, service)
	{
		return this.service && this.service.descriptionContains(s, prefix, service);
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

    ServiceFlagController.controllersPromise = function()
    {
        if (ServiceFlagController._controllersPromise)
        	return ServiceFlagController._controllersPromise;
        
        ServiceFlagController._controllersPromise = cr.Service.servicesPromise()
        	.then(function(services)
        		{
        			var controllers = services.map(function(s) { return new ServiceFlagController(s); });
        			result = $.Deferred();
        			result.resolve(services, controllers);
        			return result;
        		},
        		cr.chainFail);
        		
        return ServiceFlagController._controllersPromise;
    }
    
	function ServiceFlagController(dataObject) {
		this.service = dataObject;
	}
	
	return ServiceFlagController;
})();
ServiceFlagController._controllersPromise = null;

ServiceFlagController.clearPromises = function()
{
	ServiceFlagController._controllersPromise = null;
}

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
		done = args.done || done;

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
	TagPoolView.prototype.flagsContainer = null;
	
	TagPoolView.prototype.flagHSpacing = 15;
	TagPoolView.prototype.flagVSpacing = 1.0;
	TagPoolView.prototype.flagHeightEM = 2.333;
	TagPoolView.prototype.emToPX = 11;

	TagPoolView.prototype.node = function()
	{
		return this.flagsContainer.node();
	}
	
	TagPoolView.prototype.flags = function()
	{
		return this.flagsContainer.selectAll('span.flag');
	}
	
	TagPoolView.prototype.$flags = function()
	{
		return $(this.flagsContainer.node()).children('span.flag');
	}
	
	/* Sets the x, y and y2 coordinates of each flag. */
	TagPoolView.prototype._setFlagCoordinates = function(g, maxX, filterText)
	{
		var _this = this;

		var upperText = filterText && filterText.toLocaleUpperCase();
		var filterService = upperText && this.hasNamedService(upperText);
		var flagSets = [[], [], [], []];
		if (filterService)
		{
			g.each(function(fd)
				{
					if (fd.visible === undefined || fd.visible)
					{
						if (fd.service == filterService)
							flagSets[1].push(fd);
						else if (this == _this.otherFlagNode)
						{
							d3.select(_this.otherFlagNode)
								.text("Other {0}".format(filterService.description()));
							fd.outerWidth = $(_this.otherFlagNode).outerWidth();
							PathGuides.fillNode(_this.otherFlagNode, filterService.getColumn());
							flagSets[2].push(fd);
						}
						else if (fd.service.serviceImplications().find(function(si)
							{
								return si.service() == filterService;
							}))
							flagSets[2].push(fd);
						else if (fd.service.impliedDirectlyBy().indexOf(filterService) >= 0)
							flagSets[0].push(fd);
						else
							flagSets[3].push(fd);
						if (fd.outerWidth === undefined)
							fd.outerWidth = $(this).outerWidth();
					}
				});
		}
		else
		{
			var margin = 0;
			g.each(function(fd)
				{
					if (fd.visible === undefined || fd.visible)
					{
						flagSets[3].push(fd);
						if (fd.outerWidth === undefined)
						{
							if (margin == 0)
								margin = $(this).outerWidth() - getTextWidth(this.textContent, $(this).css('font'));
							fd.outerWidth = getTextWidth(this.textContent, $(this).css('font')) + margin;
						}
					}
				});
		}
		
		var deltaY = this.flagHeightEM + this.flagVSpacing;
		var startX = 0;
		var nextY = 0;
		var nextX = 0;
		
		flagSets.forEach(function(fs)
			{
				if (fs.length)
				{
					fs.forEach(function(fd)
						{
							var thisSpacing = fd.outerWidth;
							fd.x = nextX;
							nextX += thisSpacing;
							if (nextX >= maxX && fd.x > startX)
							{
								nextY += deltaY;
								nextX = startX;
								fd.x = nextX;
								nextX += thisSpacing;
							}
							nextX += _this.flagHSpacing;
							fd.y = nextY;
						});
					nextX = startX;
					nextY += deltaY;
				}
			});
		
		return (nextY + this.flagHeightEM) * this.emToPX;
	}
		
	TagPoolView.prototype.moveFlags = function(duration)
	{
		duration = duration !== undefined ? duration : 700;
		var g = this.flags();
		
		function getTopEdge($flag)
		{
			var s = $flag.css('top');
			if (!s)
				return 0;
			else
				return parseFloat(s);
		}
		
		var startDate = new Date();
		function moveFlag(flag, fd)
		{
			var position = $(flag).position();
			var endX = fd.x;
			var endY = fd.y * fd.emToPX;
			
			var id = setInterval(frame, duration / 100);
			var r2 = $.Deferred();
			function frame()
			{
				var deltaTime = startDate.getElapsed();
				if (deltaTime >= duration)
				{
					clearInterval(id);
					$(flag).css({left: endX, top: endY});
					r2.resolve();
				}
				else
				{
					$(flag).css({left: position.left + ((endX - position.left) * deltaTime / duration),
								 top: position.top + ((endY - position.top) * deltaTime / duration)});
				}
			}
			
			return r2;
		}

		/* If it wasn't visible, transform instantly and animate its opacity to 1. */
		/* If it was visible and it is still visible, animate its position. */
		/* If it was visible and is not visible, animate opacity to 0 */
		/* Calculate all of the groups before moving any of them so that subsequent sets are properly calculated. */
		
		var hiddenG = g.filter(function(fd) { return parseFloat($(this).css('opacity')) < 1; });
		var movingG = g.filter(function(fd) { return $(this).css('opacity') != "0" && 
									   (fd.visible === undefined || fd.visible); });
		var hidingG = g.filter(function(fd) { return $(this).css('opacity') != "0" && 
									   !(fd.visible === undefined || fd.visible); });
		var $g = this.$flags();
		$g.stop(true, false);
		
		var promises = [];
		if ($(this.flagsContainer.node()).scrollTop() > 0)
		{
			if (duration == 0)
				$(this.flagsContainer.node()).scrollTop(0);
			else if ($(this.flagsContainer.node()).scrollTop() > 0)
				promises.push($(this.flagsContainer.node()).animate({scrollTop: 0}, {duration: duration})
					.promise());
		}
		
		var bottomEdge = $(this.flagsContainer.node()).height();

		var showingFlags = [];
		var settingFlags = [];	
		hiddenG.each(function(fd)
			{
				var showing = fd.visible === undefined || fd.visible;
				var styles;
				if (showing)
					styles = {left: fd.x, top: fd.y * fd.emToPX, opacity: 1.0};
				else
					styles = {opacity: 0.0};
					
				if (!showing &&
					$(this).css('opacity') == "0")
				{
					;
				}
				else if (duration == 0)
				{
					styles.display = showing ? '' : 'none';
					settingFlags.push({flag: this, styles: styles});
				}
				else if (showing)
				{
					
					if (fd.y * fd.emToPX > bottomEdge &&
						getTopEdge($(this)) > bottomEdge)
					{
						styles.display = '';
						settingFlags.push({flag: this, styles: styles});
					}
					else if ($(this).css('opacity') == '0')
					{
						if (fd.y * fd.emToPX > bottomEdge)
						{
							styles.display = '';
							settingFlags.push({flag: this, styles: styles});
						}
						else
						{
							$(this).css({display: '', left: fd.x, top: fd.y * fd.emToPX});
							showingFlags.push(this);
						}
					}
					else
					{
						$(this).css('display', '');
						promises.push($(this).animate(styles, {duration: duration})
											 .promise()
							);
					}
				}
				else
				{
					var _thisFlag = this;
					promises.push($(this).animate(styles, {duration: duration,
							complete: function() { 
								$(_thisFlag).css({display: 'none'}); }})
							.promise()
						);
				}
			});
		
		if (showingFlags.length)
			promises.push($(showingFlags).animate({opacity: 1}, {duration: duration})
						   .promise());
		
		movingFlags = [];
		movingG.each(function(fd)
			{
				var styles = {left: fd.x, top: fd.y * fd.emToPX};
				if ($(this).css('opacity') != "1")
					styles.opacity = 1;
					
				if (fd.y * fd.emToPX > bottomEdge &&
					getTopEdge($(this)) > bottomEdge)
					settingFlags.push({flag: this, styles: styles});
				else if (duration == 0)
					settingFlags.push({flag: this, styles: styles});
				else
				{
					if ($(this).css('opacity') != '1')
						$(this).css('opacity', 1);
					movingFlags.push({flag: this, fd: fd});
				}
			});
		
		var hidingFlags = [];
		hidingG.each(function(fd)
			{
				if (getTopEdge($(this)) > bottomEdge)
					settingFlags.push({flag: this, styles: {opacity: 0.0, display: 'none'}});
				else
					hidingFlags.push(this);
			});
		if (hidingFlags.length)
		{
			var $hidingFlags = $(hidingFlags);
			if (duration == 0)
				$hidingFlags.css({opacity: 0, display: 'none'});
			else
			{
				var p = $hidingFlags.animate({opacity: 0.0},
					{duration: duration,
					 complete: function()
						{
							$(this).css({display: 'none'});
						}})
					.promise();
				promises.push(p);
			}
		}
		
		promises = promises.concat(movingFlags.map(function(d)
				{
					return moveFlag(d.flag, d.fd);
				}));
		
		return $.when.apply(null, promises)
			.done(function()
				{
					for (var i = 0; i < settingFlags.length; ++i)
					{
						$(settingFlags[i].flag).css(settingFlags[i].styles);
					}
				});
	}
	
	
	/* Lay out all of the contents within the div object. */
	TagPoolView.prototype.layoutFlags = function(maxX, duration)
	{
		maxX = maxX !== undefined ? maxX : $(this.flagsContainer.node()).width();
		
		this._setFlagCoordinates(this.flags(), maxX, this.focusNode && this.focusNode.value);
		return this.moveFlags(duration);
	}
	
	TagPoolView.prototype.setFlagVisibles = function(inputNode)
	{
		var g = this.flags();
		g.each(function(fs) { fs.visible = undefined; });
	}
	
	TagPoolView.prototype.filterFlags = function(inputNode)
	{
		this.setFlagVisibles(inputNode);
		var filterText = inputNode.value;
		var upperText = filterText.toLocaleUpperCase();
		var filterService = upperText && this.hasNamedService(upperText);
		
		/* Split the filter text by word and eliminate null words. */	
		var inputTexts = upperText.split(' ')
			.filter(function(s) { return s; });
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
		
		/* Make the services that are directly implied by filterService visible. */
		var sis = filterService && filterService.serviceImplications().map(function(si) { return si.service(); })
			.filter(function(s) { return s != filterService && s.impliedDirectlyBy().indexOf(filterService) >= 0;});

		var _this = this;
		if (inputTexts.length > 0)
		{
			this.flags().each(function(fs)
				{
					if (this == _this.otherFlagNode) {
						if (!filterService)
							fs.visible = false;
					}
					else if (filterService) 
					{
						if (filterService == fs.service ||
							filterService.impliedDirectlyBy().indexOf(fs.service) >= 0 ||
							sis.indexOf(fs.service) >= 0)
						{
							/* Do nothing */
						}
						else
							fs.visible = false;
					}
					else
					{
						if (fs.descriptionContains(upperText, prefix, null) ||
							inputRegExps.reduce(function(a, b)
							{
								return a && b.test(fs.description());
							}, true))
						{
							/* Do nothing */
						}
						else
							fs.visible = false;
					}
				});
		}
		
	}
	
	TagPoolView.prototype.appendFlag = function(g)
	{
		g.classed('flag', true)
			.style('opacity', 0)
			.style('display', 'none')
			.text(function(d)
				{
					return d.description();
				})
			.each(function(d)
				{
					PathGuides.fillNode(this, d.getColumn());
				});
	}
	
	/* Remove all of the existing flags displayed and add all of the specified flags
		to the flag pool.
	 */
	TagPoolView.prototype.appendFlags = function(data)
	{
		var _this = this;
		this.flags().remove();
		
		var g = this.flagsContainer.selectAll('span')
			.data(data)
			.enter()
			.append('span');
			
		this.appendFlag(g);
		return g;
	}
	
	TagPoolView.prototype.addOtherFlagNode = function()
	{
		var otherFlag = this.flagsContainer.append('span')
			.datum(new ServiceFlagController(null));
		this.otherFlagNode = otherFlag.node();
		this.appendFlag(otherFlag);
	}
	
	TagPoolView.prototype.hasNamedService = function(compareText)
	{
		if (compareText.length === 0)
			return true;
		var data = this.flags().data();
		var sd = data.find(function(sd) {
				var d = sd.service;
				return d && 
						(d.names().find(
							function(d) { return d.description().toLocaleUpperCase() === compareText;}) ||
						 (d.description && d.description().toLocaleUpperCase() === compareText));
			});
		return sd && sd.service;
	}
	
	function TagPoolView(container, divClass)
	{
		console.assert(container);
		this.container = container;
		this.flagsContainer = container.append('div')
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
			return this.layoutFlags(undefined, duration);
	}
	
	TagSearchView.prototype.firstTagInputNode = function()
	{
		return this.poolSection.section.select('.tags-container>input.tag').node();
	}
	
	/* Set the visible flags for each of the services associated with this flags. */
	TagSearchView.prototype.setFlagVisibles = function(inputNode)
	{
		if (inputNode.value)
			TagPoolView.prototype.setFlagVisibles.call(this, inputNode);
		else if (inputNode != this.firstTagInputNode() ||
				 this.controller.hasPrimaryService())
		{
			this.flags().each(function(fs)
				{
					if (fs.service)
						fs.visible = (fs.service.serviceImplications().length > 1) ? false : undefined;
					else
						fs.visible = false;
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

	TagSearchView.prototype.constrainTagFlags = function(inputNode, duration)
	{
		this.filterFlags(inputNode);
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
	
	TagSearchView.prototype.transferFocusAfterClick = function(moveToNewInput, d)
	{
		var _this = this;
		
		var node;
		if (moveToNewInput)
			node = null;
		else
		{
			var newDatum = d.service;
			node = this.poolSection.tagsContainer
				.selectAll('input.tag')
				.filter(function(d)	
					{
						/* newDatum will be null if there is an Other option. */
						return d instanceof _this.controller.serviceLinkType() &&
							 (!newDatum || d.service() == newDatum); 
					})
				.node();
		}
		/* Node can be null if you have just selected a service that is part of
			an offering's services.
		 */
		if (!node)
		{
			var newInput = this.poolSection.appendTag(null);
			newInput.node().focus();
		}
		else
			node.focus();
	}
	
	TagSearchView.prototype.onClickButton = function(d) {
		if (prepareClick('click', 'service: ' + d.description()))
		{
			try
			{
				var newService = d.service || 
					(this.focusNode && this.focusNode.value.trim() && 
					 this.hasNamedService(this.focusNode.value.trim().toLocaleUpperCase()));
					 
				/* If the user clicks a flag that is the same as the flag already there, then move on. 
					If the user clicks a flag that has no sub-flags other than itself, then move on.
					Otherwise, stay there.
				 */	
				var d3Focus = this.focusNode && this.focusNode.parentNode && d3.select(this.focusNode);
				
				var moveToNewInput = !d.service ||
				    !this.hasSubService(newService) ||
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
							oldService.service(newService)
							     .description(newService.description())
							     .id(null);
						}
						else
						{
							oldService = this.controller.addService(newService);
						}
					}
					else if (this.controller.customServiceType() &&
							 oldService instanceof this.controller.customServiceType())
					{
						this.controller.removeCustomService(oldService);
						oldService = this.controller.addService(newService);
					}
					else
					{
						// This can occur if the datum is null, in which case it
						// May be the datum of the parent.
						oldService = this.controller.addService(newService);
					}
					this.focusNode.value = d.description();
				}
				else
				{
					this.controller.addService(newService);
				}
				
				this.poolSection.showTags();
				$(this.poolSection).trigger('tagsChanged.cr');
				
				this.transferFocusAfterClick(moveToNewInput, d);

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
		if (node == document.activeElement && !node.hasAttribute('readonly'))
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
				PathGuides.fillNode(node, service.getColumn());
			}
			else if (d && node.value)
			{
				PathGuides.fillOtherNode(node);
			}
			else
			{
				PathGuides.clearNode(node);
			}
		}
	}
	
	TagPoolSection.prototype.setTagInputWidth = function(inputNode)
	{
		var newWidth = this.getInputTextWidth(inputNode) + 18;
		$(inputNode).outerWidth(newWidth);
		
		this.setTagColor(inputNode);
	}
	
	TagPoolSection.prototype.checkEmptyTagInput = function(inputNode)
	{
		var newText = inputNode.value.trim();
		var newService = newText && this.searchView.hasNamedService(newText.toLocaleUpperCase());
		
		if (!newText ||
			(!newService && !this.controller.customServiceType()))
		{
			if (this.tagsContainer.select('button').size())
			{
				$(inputNode).remove();
				this.checkAddTagButton();
			}
		}
	}
	
	/* Checks the datum associated with this input node. d is the old datum. */
	TagPoolSection.prototype.checkOneInput = function(inputNode, d)
	{
		var newText = inputNode.value.trim();
		var newService = newText && this.searchView.hasNamedService(newText.toLocaleUpperCase());
		var changedData = false;
		
		if (!newText ||
			(!newService && !this.controller.customServiceType()))
		{
			if (d instanceof this.controller.serviceLinkType())
			{
				/* Remove a standard service */
				this.controller.removeService(d);
				d3.select(inputNode).datum(null);
				changedData = true;
			}
			else if (this.controller.customServiceType() &&
					 d instanceof this.controller.customServiceType())
			{
				/* Remove a custom service */
				this.controller.removeCustomService(d);
				d3.select(inputNode).datum(null);
				changedData = true;
			}
			else if (d)
			{
				// This may be the datum associated with the container.
				// In this case, do nothing.
				;
			}
			
			/* Now ensure that the input control properly matches the contents */
			if (!newText && inputNode != document.activeElement)
			{
				/* Remove inputNode if there is an addTag button and show the addTag button. */
				if (this.tagsContainer.select('button').size())
				{
					d3.select(inputNode).remove();
					this.checkAddTagButton();
				}
				else
					this.checkInputControls(inputNode);
			}
			else
				this.checkInputControls(inputNode);
		}
		else if (d instanceof this.controller.serviceLinkType())
		{
			if (!newService)
			{
				/* Replace standard service with a custom service */
				this.controller.removeService(d);
				var newValue = this.controller.addService(newText);
				d3.select(inputNode).datum(newValue);
				this.checkInputControls(inputNode);
				changedData = true;
			}
			else if (newService != d.service())
			{
				/* Replace standard service with a different standard service */
				d.service(newService)
				 .description(newService.description());
				inputNode.value = newService.description();
				this.checkInputControls(inputNode);
				changedData = true;
			}
			/* else no change */
		}
		else if (this.controller.customServiceType() &&
				 d instanceof this.controller.customServiceType())
		{
			if (!newService)
			{
				if (newText != d.name())
				{
					/* Replace custom service with a different custom service */
					d.name(newText)
					 .description(newText);
					inputNode.value = newText;	/* In case the text was trimmed */
					this.checkInputControls(inputNode);
					changedData = true;
				}
			}
			else
			{
				/* Replace a custom service with a standard service */
				this.controller.removeCustomService(d);
				var newValue = this.controller.addService(newService);
				d3.select(inputNode).datum(newValue);
				inputNode.value = newService.description();
				this.checkInputControls(inputNode);
				changedData = true;
			}
		}
		else
		{
			/* The blank tag. */
			var newValue = this.controller.addService(newService || newText);
			d3.select(inputNode).datum(newValue);
			inputNode.value = newValue ? newValue.description() : "";
			$(inputNode).attr('placeholder', $(inputNode).attr('placeholder'));
			changedData = true;
		}
		
		if (changedData)
			$(this).trigger('tagsChanged.cr');	
	}
	
	/* Align the contents of the controller with the HTML elements. */
	TagPoolSection.prototype.checkTagInput = function(exceptNode)
	{
		var _this = this;
		this.tagsContainer.selectAll('input.tag').each(function(d, i)
			{
				/* Skip the exceptNode */
				if (this != exceptNode)
					_this.checkOneInput(this, d);
			});
	}
	
	TagPoolSection.prototype.checkInputDatum = function(inputNode, instance)
	{
		/* If this is an empty node with no instance to remove, then don't handle here. */
		if (!inputNode.value && !instance)
			return false;
		/* If this is a node whose value matches the previous value, then don't handle here. */
		else if (instance && inputNode.value == instance.description())
			return false;
		else if (instance)
		{
			/* Replace the current instance with the value of the inputNode */
			this.checkOneInput(inputNode, instance);
			this.showAddTagButton();

			/* Do not prevent default for the Tab key. */
			return false;
		}
		else
		{
			this.checkOneInput(inputNode, instance);
			this.showAddTagButton();
			this.searchView.constrainTagFlags(inputNode);
			return true;
		}
	}
	
	TagPoolSection.prototype.checkAddTagButton = function()
	{
		var inputNode = null;
		if (document.activeElement &&
			document.activeElement.parentNode == this.tagsContainer.node())
		{
			inputNode = document.activeElement;
		}
		
		if (!inputNode || inputNode.value)
			this.showAddTagButton();
		else
			this.hideAddTagButton();
	}
	
	/* Ensure that the appearance of this inputNode is correct based on its datum.
	 */
	TagPoolSection.prototype.checkInputControls = function(inputNode)
	{
		if (inputNode == document.activeElement)
		{
			this.checkAddTagButton();
			this.searchView.constrainTagFlags(inputNode);
		}
		this.setTagInputWidth(inputNode);
	}
	
	TagPoolSection.prototype.appendTag = function(instance, placeholder)
	{
		var _this = this;
		placeholder = placeholder !== undefined ? placeholder : "Tag";
		
		var input = this.tagsContainer.insert('input', 'button')
			.datum(instance)
			.classed('tag', true)
			.attr('placeholder', placeholder)
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
				_this.checkInputDatum(this, d3.select(this).datum());
				_this.checkAddTagButton();
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
				_this.checkEmptyTagInput(this);
			})
			.keypress(function(e) {
				if (e.which == 13)
				{
					e.preventDefault();
				}
			})
			.keydown( function(event) {
				if (event.keyCode == 9) {
					var instance = d3.select(this).datum();
					
					if (_this.checkInputDatum(this, instance))
						event.preventDefault();
					_this.checkEmptyTagInput(this);
				}
			});

		this.setTagInputWidth(input.node());
		
		return input;
	}
	
	/* Ensures that the HTML elements exactly correspond to the services of the associated controller. */
	TagPoolSection.prototype.showTags = function()
	{
		var offeringTags = this.controller.primaryServices() || [];
		var tags = [];
		var _this = this;
		
		var tagDivs = this.tagsContainer.selectAll('input.tag');
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
		
		var i = 0;
		var j = 0;
		while (i < tags.length || j < this.tagsContainer.selectAll('input.tag').size())
		{
			if (i == tags.length)
				this.tagsContainer.selectAll('input.tag:nth-child({0})'.format(j+1)).remove();
			else if (j == this.tagsContainer.selectAll('input.tag').size())
			{
				this.appendTag(tags[i]);
				++i;
				++j;
			}
			else
			{
				var input = this.tagsContainer.selectAll('input.tag:nth-child({0})'.format(j+1));
				input.datum(tags[i]);
				input.node().value = tags[i].description();
				this.setTagInputWidth(input.node());
				++i;
				++j;
			}
		}
	}
	
	TagPoolSection.prototype.hideAddTagButton = function(duration)
	{
		var button = this.tagsContainer.select('button');
		if (button.size())
		{
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
	}
	
	TagPoolSection.prototype.showAddTagButton = function()
	{
		var button = this.tagsContainer.select('button');
		if (button.size() && button.style('display') == 'none')
		{
			button.style('display', null);
			button.interrupt().transition()
				.style('opacity', 1);
		}
	}
	
	TagPoolSection.prototype.reveal = function()
	{
		return this.searchView.reveal;
	}
	
	TagPoolSection.prototype.hideReveal = function(done)
	{
		this.searchView.hideSearch(done);
	}
	
	TagPoolSection.prototype.revealSearchView = function(inputNode, ensureVisible)
	{
		var duration = this.searchView.reveal.isVisible() ? undefined : 0;
		this.searchView.constrainTagFlags(inputNode, duration);
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
		return ServiceFlagController.controllersPromise()
			.then(function(services, controllers)
				{
					_this.allServices = services;
					_this.searchView.appendFlags(controllers)
						.on('click', function(s)
							{
								if (s.visible === undefined || s.visible)
									_this.searchView.onClickButton(s);
								else
									d3.event.preventDefault();
								d3.event.stopPropagation();
							});
				},
				cr.chainFail);
	}
	
	TagPoolSection.prototype.addAddTagButton = function()
	{
		var _this = this;
		this.tagsContainer.append('button')
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
								var tagInput = _this.appendTag(null);
								tagInput.node().focus();
							});
				});
	}
	
	/** searchViewType is the type of search view to be create for this tag pool section. */
	function TagPoolSection(container, controller, sectionLabel, searchViewType)
	{
		searchViewType = searchViewType !== undefined ? searchViewType : TagSearchView;
		
		this.controller = controller;
		
		this.section = container.append('section')
			.classed('cell tags custom', true);
		var tagsTopContainer = this.section.append('div');
		if (sectionLabel)
			tagsTopContainer.append('label')
				.text("{0}:".format(sectionLabel));
		
		this.tagsContainer = tagsTopContainer.append('span')
			.classed('tags-container', true);
			
		searchContainer = this.section.append('div');
		
		this.searchView = new searchViewType(searchContainer, this, controller);
		/* Mark the reveal as not visible or the metrics aren't calculated. */
		this.searchView.reveal.isVisible(false);
	}
	
	return TagPoolSection;
})();