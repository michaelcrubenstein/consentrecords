var QuickAddExperiencePanel = (function () {
	QuickAddExperiencePanel.prototype = Object.create(EditPanel.prototype);
	QuickAddExperiencePanel.prototype.constructor = QuickAddExperiencePanel;

	QuickAddExperiencePanel.prototype.flagHSpacing = 15;
	QuickAddExperiencePanel.prototype.flagVSpacing = 1.0;
	QuickAddExperiencePanel.prototype.flagHeightEM = 2.333;
	QuickAddExperiencePanel.prototype.emToPX = 11;
	QuickAddExperiencePanel.prototype.flagTopMargin = 1.0;	/* em */
	
	QuickAddExperiencePanel.prototype.currentService = null;
	QuickAddExperiencePanel.prototype.currentFlag = null;

	/* Set the visible flags for each of the services associated with this flags. */
	QuickAddExperiencePanel.prototype.filterFlags = function()
	{
		var _this = this;
		if (this.currentService)
		{
			var filterService = this.currentService;
		
			/* Make the services that are directly implied by filterService visible. */
			var sis = filterService && filterService.serviceImplications().map(function(si) { return si.service(); })
				.filter(function(s) { return s != filterService && s.impliedDirectlyBy().indexOf(filterService) >= 0;});

			this.flags().each(function(fs)
				{
					if (this == _this.otherFlagRowNode)
						fs.visible = true;
					else
						fs.visible = (!_this.filter || _this.filter(fs)) &&
							(fs.service == filterService ||
							 filterService.impliedDirectlyBy().indexOf(fs.service) >= 0 ||
							 sis.indexOf(fs.service) >= 0);
				});
		}
		else
		{
			var rootServices = this.flags().filter(function(fs)
				{
					return this != _this.otherFlagRowNode &&
						   fs.service.serviceImplications().length <= 1 &&
						(!_this.filter || _this.filter(fs));
				});
			if (rootServices.size() == 1)
			{
				this.currentService = rootServices.datum().service;
				this.filterFlags();
			}
			else
			{
				this.flags().each(function(fs) { fs.visible = false; });
				rootServices.each(function(fs) { fs.visible = true; });
				d3.select(this.otherFlagRowNode).datum().visible = true;
			}
		}
	}

	/* Sets the x, y and y2 coordinates of each flag. */
	QuickAddExperiencePanel.prototype._setFlagCoordinates = function(g)
	{
		var _this = this;

		var deltaY = this.flagHeightEM + this.flagVSpacing;
		var nextY = this.flagTopMargin;
		var panelWidth = $(this.mainDiv.node()).innerWidth();
		
		var flagSets = [[], [], [], []];
		var filterService = this.currentService;
		if (filterService)
		{
			g.each(function(fd)
				{
					if (fd.visible === undefined || fd.visible)
					{
						if (fd.service == filterService)
							flagSets[1].push(this);
						else if (this == _this.otherFlagRowNode)
						{
							d3.select(_this.otherFlagNode)
								.text("Other {0}".format(filterService.description()));
							PathGuides.fillNode(_this.otherFlagNode, filterService.getColumn());
							fd.x = undefined;
							flagSets[2].push(this);
						}
						else if (fd.service.serviceImplications().find(function(si)
							{
								return si.service() == filterService;
							}))
							flagSets[2].push(this);
						else if (fd.service.impliedDirectlyBy().indexOf(filterService) >= 0)
							flagSets[0].push(this);
						else
							flagSets[3].push(this);
					}
				});
		}
		else
		{
			g.each(function(fd)
				{
					if (fd.visible === undefined || fd.visible)
						flagSets[3].push(this);
				});
			d3.select(_this.otherFlagNode)
				.text("Other");
			PathGuides.fillOtherNode(_this.otherFlagNode);
			d3.select(_this.otherFlagNode).datum().x = undefined;
		}

		flagSets.forEach(function(fs)
			{
				if (fs.length)
				{
					fs.forEach(function(gNode)
						{
							var fd = d3.select(gNode).datum();
							$(gNode).css('display', '');
							if (fd.x === undefined)
								fd.x = panelWidth - $(gNode).children('span:first-child').outerWidth(true);
							fd.y = nextY;
							nextY += deltaY;
						});
				}
			});
			
		return (nextY + this.flagHeightEM) * this.emToPX;
	}
	
	QuickAddExperiencePanel.prototype.flags = function()
	{
		return this.flagsContainer.selectAll('span.flag-row');
	}
	
	QuickAddExperiencePanel.prototype.$flags = function()
	{
		return $(this.flagsContainer.node()).children('span.flag-row');
	}
	
	QuickAddExperiencePanel.prototype.hide = function()
	{
		this.dimmer.hide();
		var _this = this;
		return this.$flags().animate({left: $(this.mainDiv.node()).innerWidth()},
			{duration: 200})
			.promise()
			.done(function()
			{
				_this.mainDiv.remove();
			});
	}
	
	QuickAddExperiencePanel.prototype.addService = function(path, service, timeframe, isOther)
	{
		var controller = new ExperienceController(path, null, false);
		if (service)
			controller.service(service);
		
		if (isOther)
		{
			controller.addService("Other Tag");
		}
		controller.timeframe(timeframe);
		controller.initDateRange(timeframe);
		var panel = new NewExperiencePanel(controller);
		
			
		return panel.showUp()
			.then(function()
				{
					if (isOther)
						panel.focusLastTag();
				},
				cr.chainFail);
	}
	
	QuickAddExperiencePanel.prototype.hideFlagRow = function($flagRow, fd)
	{
		fd.expanded = false;
		if ($flagRow == this.expandedFlag)
			this.expandedFlag = null;
		return $flagRow.animate({left: fd.x}).promise();
	}
	
	QuickAddExperiencePanel.prototype.handleResize = function(duration)
	{
		var $flagRow = $(this.flagRows.node());
		var newLeft = $(this.mainDiv.node()).innerWidth()
			 - $flagRow.children('span:first-child').outerWidth(true);
		$(this.flagsContainer.node()).width($flagRow.outerWidth(true) + newLeft)
			.height(
			$(this.mainDiv.node()).height() - this.panelNode.sitePanel.getBottomNavHeight()
			);
			
		/* Clear the x coordinates before resetting them. */
		this.flagRows.each(function(fs) { fs.x = undefined; });
		this._setFlagCoordinates(this.flagRows, undefined, undefined);
		TagPoolView.prototype.moveFlags.call(this, duration);
	}
	
	QuickAddExperiencePanel.prototype.appendFlag = function(g)
	{
		g.classed('flag', true)
			.each(function(d)
				{
					PathGuides.fillNode(this, d.getColumn());
				})
			.text(function(d)
				{
					return d.description();
				});
	}
	
	QuickAddExperiencePanel.prototype.compareFlags = function(a, b)
	{
		var columnDelta = a.getColumn() - b.getColumn();
		return columnDelta ||
			a.description().localeCompare(b.description());
	}
	
	QuickAddExperiencePanel.prototype.appendTimeframeButtons = function(path, timeframe, text)
	{
		var _this = this;
		this.flagRows.append('button')
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
						_this.hideFlagRow($(this).parent(), fd);
				})
			.on('click', function(d)
				{
					if (prepareClick('click', text + ": " + d.description()))
					{
						try
						{
							var $flagRow = $(this).parent();
							var service = ($flagRow.get(0) == _this.otherFlagRowNode) 
								? _this.currentService : d.service;
							
							_this.addService(path, service, timeframe, $flagRow.get(0) == _this.otherFlagRowNode)
								.then(function() {
										return _this.hide();
									},
									cr.chainFail)
								.then(unblockClick, cr.syncFail);
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
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
	
	QuickAddExperiencePanel.prototype.numChildren = function(d)
	{
		var children;
		var _this = this;
		if (d.service == null)
			children = [];
		else if (this.filter)
			children = d.service.impliedDirectlyBy().filter(function(s)
				{
					return _this.filter(s);
				});
		else
			children = d.service.impliedDirectlyBy();
		return children.length;
	}
	
	function QuickAddExperiencePanel(panelNode, experienceController, dimmer, filter, timeframes) {
			
		var _this = this;
		
		this.panelNode = panelNode;
		this.dimmer = dimmer || new Dimmer(panelNode, 200);
		this.filter = filter;
		this.expandedFlag = null;
		this.mainDiv = d3.select(panelNode).append('panel')
			.classed("quick-add-experience", true)
			.on('click', function()
				{
					if (prepareClick('click', 'Close QuickAddExperiencePanel'))
					{
						_this.hide().then(unblockClick, cr.syncFail);
					}
				});
			
		this.flagsContainer = this.mainDiv.append('div')
			.classed('flags-container', true);
		
		var resize = function()
			{
				_this.handleResize(0);
			};
			
		$(window).on('resize', resize);
		$(this.mainDiv.node()).on('remove', function()
			{
				$(window).off('resize', resize);
			});	
		
		this.promise = $.when(_this.dimmer.show(), cr.Service.servicesPromise())
		 .then(function(x1, services)
			{
				try
				{
					var controllers = services.map(function(s) { return new ServiceFlagController(s); });
					controllers.sort(function(a, b) { return _this.compareFlags(a, b); });

					_this.flagsContainer.selectAll('span')
						.data(controllers)
						.enter()
						.append('span');
					
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
								if (prepareClick('click', d.description()))
								{
									try
									{
										var $currentFlag = $(this).parent();

										/* If the clicked flag is not the expanded flag,
											then close the expanded flag.
										 */
										if (_this.expandedFlag &&
											_this.expandedFlag.get(0) != this.parentNode)
										{
											_this.toggleLeft(_this.expandedFlag, d3.select(_this.expandedFlag.get(0)).datum());
										}
										if (d.service && _this.currentService == d.service)
										{
											_this.toggleLeft($currentFlag, d)
												.then(function()
													{
														if (!d.expanded && d.service.serviceImplications().length <= 1)
														{
															_this.currentService = null;
															_this.filterFlags();
															_this._setFlagCoordinates(_this.flagRows, undefined, undefined);
															TagPoolView.prototype.moveFlags.call(_this, undefined)
																.then(unblockClick, cr.syncFail);
														}
														else
															unblockClick();
													}, cr.syncFail);
										}
										else if (_this.numChildren(d) == 0)
										{
											_this.toggleLeft($currentFlag, d)
												.then(unblockClick, cr.syncFail);
										}
										else
										{
											_this.currentService = d.service;
											_this.filterFlags();
											_this._setFlagCoordinates(_this.flagRows, undefined, undefined);
											TagPoolView.prototype.moveFlags.call(_this, undefined)
												.then(function()
												{
													_this.toggleLeft($currentFlag, d);
												},
												cr.chainFail)
												.then(unblockClick, cr.syncFail);
										}
									}
									catch (err)
									{
										cr.syncFail(err);
									}
								}
							});
							
					_this.otherFlagNode = d3.select(_this.otherFlagRowNode).select('span:first-child').node();
					
					_this.mouseDownElement = null;
					if (!timeframes || timeframes.indexOf('Previous') >= 0)
					{
						_this.appendTimeframeButtons(experienceController.parent(), 'Previous', crv.buttonTexts.previousTimeframe)
					}
					if (!timeframes || timeframes.indexOf('Current') >= 0)
					{
						_this.appendTimeframeButtons(experienceController.parent(), 'Current', crv.buttonTexts.currentTimeframeShort)
					}
					if (!timeframes || timeframes.indexOf('Goal') >= 0)
					{
						_this.appendTimeframeButtons(experienceController.parent(), 'Goal', crv.buttonTexts.goalTimeframeShort)
					}
		
					_this.appendFlag(g);
					
					_this.filterFlags();
					_this.$flags().css({opacity: 0, display: 'none'});

					_this.handleResize(undefined);
				}
				catch(err)
				{
					cr.asyncFail(err);
				}
			},
		cr.asyncFail);
	}
	
	return QuickAddExperiencePanel;
})();

