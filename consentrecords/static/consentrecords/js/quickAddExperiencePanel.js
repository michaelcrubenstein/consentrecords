var FlagStackPanel = (function() {
	FlagStackPanel.prototype.serviceFilter = null;
	FlagStackPanel.prototype.flagsContainer = null;
	FlagStackPanel.prototype.serviceStack = null;
	FlagStackPanel.prototype.flagStack = null;
	FlagStackPanel.prototype.currentFlag = null;
	FlagStackPanel.prototype.otherFlagRowNode = null;
	FlagStackPanel.prototype.rootFlagRowNode = null;
	
	FlagStackPanel.prototype.flags = function()
	{
		return this.flagsContainer.selectAll('span.flag-row');
	}
	
	FlagStackPanel.prototype.$flags = function()
	{
		return $(this.flagsContainer.node()).children('span.flag-row');
	}
	
	FlagStackPanel.prototype._pushFlag = function(flag, service)
	{
		this.serviceStack.push(service);
		this.flagStack.push(flag);
	}
	
	FlagStackPanel.prototype._popFlag = function()
	{
		this.serviceStack.pop();
		return this.flagStack.pop();
	}
	
	FlagStackPanel.prototype.isVisibleService = function(filterService, fs)
	{
		return (!this.serviceFilter || this.serviceFilter(fs)) &&
			filterService.impliedDirectlyBy().indexOf(fs.service) >= 0;
	}
	
	FlagStackPanel.prototype.isRootService = function(fs)
	{
		return fs.service.serviceImplications().length <= 1 &&
		       (!this.serviceFilter || this.serviceFilter(fs));
	}

	/* Set the visible flags for each of the services associated with this flags. */
	FlagStackPanel.prototype._filterFlags = function()
	{
		var _this = this;
		if (this.serviceStack.length > 1)
		{
			var filterService = this.serviceStack.slice(-1)[0];
			
			if (filterService == null)	/* _this.otherFlagRowNode */
			{
				this.flags().each(function(fs)
					{
						fs.visible = this == _this.rootFlagRowNode ||
							this == _this.otherFlagRowNode ||
							_this.flagStack.indexOf(this) >= 0;
					});
			}
			else
			{
				this.flags().each(function(fs)
					{
						if (this == _this.rootFlagRowNode)
							fs.visible = true;
						if (this == _this.otherFlagRowNode)
							fs.visible = _this.numChildren(d3.select(_this.flagStack[_this.flagStack.length - 1]).datum()) > 0;
						else if (_this.flagStack.indexOf(this) >= 0)
							fs.visible = true;
						else
							fs.visible = _this.isVisibleService(filterService, fs);
					});
			}
		}
		else
		{
			/* rootServices are the services that appear at the top level. */
			var rootServices = this.flags().filter(function(fs)
				{
					if (this == _this.rootFlagRowNode || this == _this.otherFlagRowNode)
						return false;
					else
						return _this.isRootService(fs);
				});
			if (rootServices.size() == 1)
			{
				this._pushFlag(rootServices.node(), rootServices.datum().service);
				this._filterFlags();
			}
			else
			{
				this.flags().each(function(fs) { fs.visible = false; });
				rootServices.each(function(fs) { fs.visible = true; });
				d3.select(this.rootFlagRowNode).datum().visible = true;
				d3.select(this.otherFlagRowNode).datum().visible = true;
			}
		}
	}

	FlagStackPanel.prototype.rootFlagText = function()
	{
		return "Experience Tags";
	}
	
	FlagStackPanel.prototype.appendFlag = function(g)
	{
		var _this = this;
		g.classed('flag', true)
			.each(function(d)
				{
					PathGuides.fillNode(this, d.getColumn());
				})
			.text(function(d)
				{
					if (this == _this.rootFlagNode)
						return _this.rootFlagText();
					else if (this == _this.otherFlagNode)
						return "Other";
					else
						return d.description();
				});
	}
	
	FlagStackPanel.prototype.compareFlags = function(a, b)
	{
		var columnDelta = a.getColumn() - b.getColumn();
		return columnDelta ||
			a.description().localeCompare(b.description());
	}
	
	FlagStackPanel.prototype.numChildren = function(d)
	{
		var children;
		var _this = this;
		if (d.service == null)
			children = [];
		else if (this.serviceFilter)
			children = d.service.impliedDirectlyBy().filter(function(s)
				{
					return _this.serviceFilter(s);
				});
		else
			children = d.service.impliedDirectlyBy();
		return children.length;
	}
	
	FlagStackPanel.prototype.appendChevrons = function()
	{
		var _this = this;
		var flags = this.flagRows.filter(function(d)
			{
				return this == _this.rootFlagRowNode || _this.numChildren(d) > 0;
			});
		var containers = flags.append('span')
			.classed('svg-container', true)
			.on('click', function(d)
				{
					_this.handleClickFlag(this.parentNode, d);
					d3.event.stopPropagation();
				})
			.each(function(d)
			{
				PathGuides.fillNode(this, d.getColumn());
			})
		appendRightChevronSVG(containers).each(function(d)
			{
				$(this).css('fill', $(this).css('color'));
			});
	}
	
	FlagStackPanel.prototype.clearSelection = function(duration)
	{
		this.flagStack = [this.rootFlagRowNode];
		this.serviceStack = [d3.select(this.rootFlagRowNode).datum().service];
		this._filterFlags();
		this._setFlagCoordinates(this.flagRows);
		return this.moveFlags(duration);
	}
	
	FlagStackPanel.prototype.moveFlags = function(duration)
	{
		return TagPoolView.prototype.moveFlags.call(this, duration);
	}
	
	FlagStackPanel.prototype.layout = function(duration)
	{
		this._setFlagCoordinates(this.flagRows);
		return this.moveFlags(duration || 0);
	}
	
	FlagStackPanel.prototype.createFlags = function(completeFlagContainers)
	{
		var _this = this;
		
		this.promise = $.when(cr.Service.servicesPromise())
		 .then(function(services)
			{
				try
				{
					var controllers = services.map(function(s) { return new ServiceFlagController(s); });
					controllers.sort(function(a, b) { return _this.compareFlags(a, b); });

					_this.flagsContainer.selectAll('span')
						.data(controllers)
						.enter()
						.append('span');
						
					_this.rootFlagRowNode = _this.flagsContainer.append('span')
						.datum(new ServiceFlagController(null))
						.node();
						
					_this.otherFlagRowNode = _this.flagsContainer.append('span')
						.datum(new ServiceFlagController(null))
						.node();

					_this.flagRows = _this.flagsContainer.selectAll('span')
						.classed('flag-row', true)
						.on('mousedown', function()
							{
								/* Do not remove the panel */
								d3.event.stopPropagation();
							})
						.on('click', function()
							{
								/* Do not remove the panel */
								d3.event.stopPropagation();
							});
					
					var g = _this.flagRows.append('span')
						.on('click', function(d)
							{
								_this.handleClickFlag(this.parentNode, d);
								d3.event.stopPropagation();
							});
							
					_this.flagStack = [_this.rootFlagRowNode];
					_this.serviceStack = [d3.select(_this.rootFlagRowNode).datum().service];
					_this.otherFlagNode = d3.select(_this.otherFlagRowNode).select('span:first-child').node();
					_this.rootFlagNode = d3.select(_this.rootFlagRowNode).select('span:first-child').node();
					
					$(_this.rootFlagNode).text("Pick First Tag");
					
					_this.appendChevrons();
					_this.appendFlag(g);
					if (completeFlagContainers)
						completeFlagContainers();
		
					_this._filterFlags();
					_this.flags().each(function(fd)
						{
							/* If this flag has no children, then the first child width is the width of 
								the flag. Otherwise, it is the width of the flag + the right chevron.
							 */
							if (_this.numChildren(fd) == 0 && this != _this.rootFlagRowNode)
								fd.firstChildWidth = $(this).children('span:first-child').outerWidth(true);
							else
								fd.firstChildWidth = $(this).outerWidth(true);
						});
					_this.$flags().css({opacity: 0, display: 'none'});

					return _this.layout(400);
				}
				catch(err)
				{
					cr.asyncFail(err);
				}
			},
		cr.asyncFail);
	}
	
	function FlagStackPanel(serviceFilter)
	{
		this.serviceFilter = serviceFilter;
	}
	
	return FlagStackPanel;
	
})();

var QuickAddExperiencePanel = (function () {
	QuickAddExperiencePanel.prototype = Object.create(EditPanel.prototype);
	Object.assign(QuickAddExperiencePanel.prototype, FlagStackPanel.prototype);
	QuickAddExperiencePanel.prototype.constructor = QuickAddExperiencePanel;
	
	QuickAddExperiencePanel.prototype.expandedFlag = null;	/* The current flag that is expanded. */

	QuickAddExperiencePanel.prototype.stackLeftMargin = 15;
	QuickAddExperiencePanel.prototype.flagVSpacing = 1.0;
	QuickAddExperiencePanel.prototype.flagHeightEM = 2.333;
	QuickAddExperiencePanel.prototype.emToPX = 11;
	QuickAddExperiencePanel.prototype.flagTopMargin = 1.0;	/* em */
	
	QuickAddExperiencePanel.prototype._pushFlag = function(flag, service)
	{
		FlagStackPanel.prototype._pushFlag.apply(this, [flag, service]);
		$(flag).children('button.timeframe-button').css('display', 'none');
	}
	
	/* Sets the x, y and y2 coordinates of each flag. */
	QuickAddExperiencePanel.prototype._setFlagCoordinates = function(g)
	{
		var _this = this;

		var deltaY = this.flagHeightEM + this.flagVSpacing;
		var nextY = this.flagTopMargin;
		var panelWidth = $(this.mainDiv.node()).innerWidth();
		
		var flagSet = [];
		if (this.serviceStack.length > 1)
		{
			var filterService = this.serviceStack.slice(-1)[0];
			g.each(function(fd)
				{
					if (fd.visible === undefined || fd.visible)
					{
						if (this == _this.otherFlagRowNode)
						{
							d3.select(_this.otherFlagNode)
								.text("Other {0}".format(filterService.description()));
							PathGuides.fillNode(_this.otherFlagNode, filterService.getColumn());
							/* Ensure the row is visible before calculating the width */
							$(_this.otherFlagRowNode).css('display', '');
							fd.firstChildWidth = $(_this.otherFlagNode).outerWidth(true);
							/* set fd.x and $(this).css('left') immediately so that the 
								buttons don't appear if the width is diminishing. */
							fd.x = panelWidth - fd.firstChildWidth - _this.stackLeftMargin;
							$(this).css('left', fd.x);
							
							flagSet.push(this);
						}
						else if (_this.flagStack.indexOf(this) < 0)
							flagSet.push(this);
					}
				});
		}
		else
		{
			g.each(function(fd)
				{
					if (this != _this.rootFlagRowNode &&
						(fd.visible === undefined || fd.visible))
						flagSet.push(this);
				});
			d3.select(_this.otherFlagNode)
				.text("Other");
			PathGuides.fillOtherNode(_this.otherFlagNode);
			/* Ensure the row is visible before calculating the width */
			$(_this.otherFlagRowNode).css('display', '');
			var fd = d3.select(_this.otherFlagNode).datum();
			fd.firstChildWidth = $(_this.otherFlagNode).outerWidth(true);

			/* set fd.x and $(this).css('left') immediately so that the 
				buttons don't appear if the width is diminishing. */
			fd.x = panelWidth - fd.firstChildWidth - _this.stackLeftMargin;
			$(_this.otherFlagNode).css('left', fd.x);
		}

		/* Set the positions of the top row of flags. */	
		var lastX = panelWidth - this.stackLeftMargin;	
		for (var i = 0, j = this.serviceStack.length - 1; i < this.serviceStack.length; ++i, --j)
		{
			var flag = this.flagStack[j];
			var fd = d3.select(flag).datum();
			$(flag).css('display', '');
			fd.x = lastX - fd.firstChildWidth - this.stackLeftMargin;
			fd.y = nextY;
			lastX = fd.x;
		}

		nextY += deltaY;
		
		flagSet.forEach(function(gNode)
			{
				var fd = d3.select(gNode).datum();
				$(gNode).css('display', '');
				fd.x = panelWidth - fd.firstChildWidth - _this.stackLeftMargin;
				fd.y = nextY;
				nextY += deltaY;
			});
	}
	
	QuickAddExperiencePanel.prototype.moveFlags = function(duration)
	{
		var d;
		var oldX;
		
		/* Before moving the flags, set the x of the expanded flag so that it remains visible. */
		if (this.expandedFlag)
		{
			d = d3.select(this.expandedFlag.get(0)).datum();
			oldX = d.x
			d.x = $(this.mainDiv.node()).innerWidth() - this.expandedFlag.outerWidth(true);
		}

		var promise = FlagStackPanel.prototype.moveFlags.call(this, duration);
		if (this.expandedFlag)
			d.x = oldX;

		return promise;
	}
	
	QuickAddExperiencePanel.prototype.hide = function()
	{
		var _this = this;
		var $mainDiv = $(this.mainDiv.node());
		$mainDiv.trigger('hiding.cr');
		return $mainDiv
			.animate({left: '{0}px'.format($mainDiv.parent().innerWidth())})
			.promise()
				.done(function()
					{
						$mainDiv.css('display', 'none');
					});
	}
	
	QuickAddExperiencePanel.prototype.addService = function(path, service, timeframe)
	{
		var controller = new ExperienceController(path, null, false);
		if (service)
			controller.service(service);
		
		controller.timeframe(timeframe);
		controller.initDateRange(timeframe);
		var panel = new NewExperiencePanel(controller);
		
		return panel.showUp()
			.then(function() { panel.checkTips(); } );
	}
	
	QuickAddExperiencePanel.prototype.hideFlagRow = function($flagRow, fd)
	{
		fd.expanded = false;
		if (this.expandedFlag && $flagRow.get(0) == this.expandedFlag.get(0))
			this.expandedFlag = null;
		return $flagRow.animate({left: fd.x}).promise();
	}
	
	/* Return true if this panel should be stable across the creation of experiences. */
	QuickAddExperiencePanel.prototype._isStable = function()
	{
		return this.panelNode.sitePanel.hasSidebar();
	}
	
	QuickAddExperiencePanel.prototype.layout = function(duration)
	{
		var $mainNode = $(this.mainDiv.node());
		var nav = $mainNode.parent().children('nav')[0];
		
		this.titleContainer.select('span').style('display', this._isStable() ? null : 'none');
		
		$mainNode.css({top: $(nav).outerHeight(),
					   height: $mainNode.parent().innerHeight() - $(nav).outerHeight()});
					   
		if (this._isStable())
			$mainNode.css({width: 450});
		else
			$mainNode.css({width: $mainNode.parent().innerWidth()});
		
		FlagStackPanel.prototype.layout.call(this, duration);			   
	}
	
	QuickAddExperiencePanel.prototype.handleResize = function()
	{
		var $mainNode = $(this.mainDiv.node());
					   
		if (this._isStable())
			$mainNode.css({left: $mainNode.parent().innerWidth() - 450});
		else
			$mainNode.css({left: 0});
		
		return this.layout();		   
	}
	
	QuickAddExperiencePanel.prototype.appendTimeframeButtons = function(path, timeframe, text)
	{
		var _this = this;
		this.flagRows.filter(function(d)
			{
				return this != _this.rootFlagRowNode &&
					_this.numChildren(d) == 0;
			})
			.append('button')
			.classed('timeframe-button', true)
			.text(text)
			.on('mousedown', function()
				{
					_this.mouseDownElement = this;
				})
			.on('blur', function(d)
				{
					if (_this.mouseDownElement)
						_this.mouseDownElement = null;
					else
						_this.hideFlagRow($(this).parent(), d);
				})
			.on('click', function(d)
				{
					if (prepareClick('click', text + ": " + d.description()))
					{
						try
						{
							var $flagRow = $(this).parent();
							var service = ($flagRow.get(0) == _this.otherFlagRowNode) 
								? _this.serviceStack.slice(-1)[0] : d.service;
							
							_this.addService(path, service, timeframe)
								.then(function() {
										return _this.hideFlagRow($flagRow, d);
									},
									cr.chainFail)
								.then(unblockClick, cr.syncFail);
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
					d3.event.stopPropagation();
				});
	}
	
	QuickAddExperiencePanel.prototype.toggleLeft = function($currentFlag, d)
	{
		var newLeft = d.expanded
			? d.x
			: $(this.mainDiv.node()).innerWidth() - $currentFlag.outerWidth(true);
		d.expanded = !d.expanded;
		this.expandedFlag = d.expanded ? $currentFlag : null;
		return $currentFlag.animate(
					{left: newLeft},
					{duration: 400})
					.promise();
	}
	
	QuickAddExperiencePanel.prototype.handleClickFlag = function(currentFlag, d)
	{
		if (prepareClick('click', d ? d.description() : 'quick add experience panel'))
		{
			try
			{
				var _this = this;
				
				/* If the clicked flag is not the expanded flag,
					then close the expanded flag.
				 */
				if (this.expandedFlag &&
					this.expandedFlag.get(0) != currentFlag)
				{
					this.toggleLeft(this.expandedFlag, d3.select(this.expandedFlag.get(0)).datum());
				}
				
				if (this.rootFlagRowNode == currentFlag)
				{
					while (this.flagStack.length > 1)
						this._popFlag();
					_this._filterFlags();
					_this._setFlagCoordinates(_this.flagRows);
					_this.moveFlags()
						.then(unblockClick, cr.syncFail);
				}
				/* If the user clicked on a flag at the top, pop it. */
				else if (d && d.service && 
					this.serviceStack.indexOf(d.service) >= 0)
				{
					var numFlags = this.serviceStack.indexOf(d.service) + 1;
					var flag = null;
					while (this.serviceStack.length > numFlags)
					{
						flag = _this._popFlag();
					}
					if (flag)
					{
						_this._filterFlags();
						_this._setFlagCoordinates(_this.flagRows);
						_this.moveFlags()
							.then(unblockClick, cr.syncFail);
					}
					else
						unblockClick();
				}
				else if (d && this.numChildren(d) == 0)
				{
					/* If the user clicked a child with no other children, show its timeframe options. */
					this.toggleLeft($(currentFlag), d)
						.then(unblockClick, cr.syncFail);
				}
				else if (d)
				{
					this._pushFlag(currentFlag, d.service);
					this._filterFlags();
					this._setFlagCoordinates(this.flagRows);
					this.moveFlags()
						.then(unblockClick, cr.syncFail);
				}
			}
			catch (err)
			{
				cr.syncFail(err);
			}
		}
	}
	
	QuickAddExperiencePanel.prototype.clearSelection = function(duration)
	{
		this.flagStack.forEach(function(e)
			{
				$(e).children('button.timeframe-button').css('display', '');
			});
		return FlagStackPanel.prototype.clearSelection.call(this, duration);
	}
	
	QuickAddExperiencePanel.prototype.show = function(filter)
	{
		this.serviceFilter = filter;
		
		var $mainDiv = $(this.mainDiv.node());
		if ($mainDiv.css('display') == 'none')
		{
			var newLeft = this._isStable() ? ($mainDiv.parent().innerWidth() - 450) : 0;
			$mainDiv
				.css({left: '{0}px'.format($mainDiv.parent().innerWidth()),
					  width: $mainDiv.parent().innerWidth() - newLeft,
					  display: ''});
		
			return this.clearSelection(0)
				.then(function()
					{
						$mainDiv.trigger('showing.cr');
						return $mainDiv.animate({left: '{0}px'.format(newLeft)})
					   				   .promise();
					});
		}
		else if (filter)
		{
			return this.clearSelection();
		}
		else
		{
			var r2 = $.Deferred();
			r2.resolve();
			return r2;
		}
	}
	
	function QuickAddExperiencePanel(panelNode, path, serviceFilter)
	{
		FlagStackPanel.call(this, serviceFilter);
		
		var _this = this;
		
		this.panelNode = panelNode;
		this.expandedFlag = null;
		this.mainDiv = d3.select(panelNode).append('panel')
			.classed('quick-add-experience', true)
			.style('display', 'none');
		
		var $mainDiv = $(this.mainDiv.node());
		var newLeft = this._isStable() ? ($mainDiv.parent().innerWidth() - 450) : 0;
		$mainDiv.css({left: '{0}px'.format($mainDiv.parent().innerWidth()),
					  display: ''});

		this.titleContainer = this.mainDiv.append('div')
			.classed('title', true);
		
		this.titleContainer.append('span').text("Add an Experience or a Goal to Your Path");
		
		var closeButton = this.titleContainer.append('button')
			.on('click', function()
				{
					if (prepareClick('click', 'Close QuickAddExperiencePanel'))
					{
						_this.hide().then(unblockClick, cr.syncFail);
					}
					d3.event.stopPropagation();
				});
		var closeSpan = closeButton.append('span')
			.text(String.fromCharCode(215)	/* 215 - unicode value for times character */);

		this.flagsContainer = this.mainDiv.append('div')
			.classed('flags-container', true);
		
		var resize = function()
			{
				_this.handleResize();
			};
			
		$(window).on('resize', resize);
		$(this.mainDiv.node()).on('remove', function()
			{
				$(window).off('resize', resize);
			});
		
		setupOnViewEventHandler(path, 'experienceAdded.cr', this.mainDiv.node(), function()
			{
				_this.serviceFilter = null;
				_this.clearSelection(0)
					.fail(cr.asyncFail);
			});
		
		function completeFlagContainers()
		{
			_this.mouseDownElement = null;
			_this.appendTimeframeButtons(path, 'Previous', crv.buttonTexts.previousTimeframe)
			_this.appendTimeframeButtons(path, 'Current', crv.buttonTexts.currentTimeframeShort)
			_this.appendTimeframeButtons(path, 'Goal', crv.buttonTexts.goalTimeframeShort)
		}
			
		this.createFlags(completeFlagContainers);
		
		this.promise.then(function()
			{
				$mainDiv.trigger('showing.cr');
				$mainDiv.animate({left: '{0}px'.format(newLeft)});
			});
	}
	
	return QuickAddExperiencePanel;
})();

