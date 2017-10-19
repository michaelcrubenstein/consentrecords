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
	QuickAddExperiencePanel.prototype.setFlagVisibles = function()
	{
		if (this.currentService)
			this.flags().each(function(fs) { fs.visible = undefined; });
		else
		{
			this.flags().each(function(fs)
				{
					fs.visible = (fs.service.serviceImplications().length > 1) ? false : undefined;
				});
		}
	}

	QuickAddExperiencePanel.prototype.filterFlags = function(filterText)
	{
		this.setFlagVisibles();
		
		if (this.currentService)
		{
			var filterService = this.currentService;
		
			/* Make the services that are directly implied by filterService visible. */
			var sis = filterService && filterService.serviceImplications().map(function(si) { return si.service(); })
				.filter(function(s) { return s != filterService && s.impliedDirectlyBy().indexOf(filterService) >= 0;});

			this.flags().each(function(fs)
				{
					if (fs.service != filterService &&
						filterService.impliedDirectlyBy().indexOf(fs.service) < 0 &&
						sis.indexOf(fs.service) < 0)
						fs.visible = false;
				});
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
		}

		flagSets.forEach(function(fs)
			{
				if (fs.length)
				{
					fs.forEach(function(gNode)
						{
							var fd = d3.select(gNode).datum();
							$(gNode).css('display', '');
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
	
	QuickAddExperiencePanel.prototype.addService = function(path, service, timeframe)
	{
		var controller = new ExperienceController(path, null, false);
		controller.service(service);
		controller.timeframe(timeframe);
		controller.initDateRange(timeframe);
		return new NewExperiencePanel(controller)
				.showUp()
	}
	
	QuickAddExperiencePanel.prototype.hideFlagRow = function($flagRow)
	{
		var newLeft = $(this.mainDiv.node()).innerWidth()
			 - $flagRow.children('span:first-child').outerWidth(true);
		return $flagRow.animate({left: newLeft}).promise();
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
		this._setFlagCoordinates(this.flagRows, undefined, undefined);
		TagPoolView.prototype.moveFlags.call(this, duration);
	}
	
	QuickAddExperiencePanel.prototype.appendFlag = function(g)
	{
		g.classed('flag', true)
			.style('border-left-color',
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
	
	QuickAddExperiencePanel.prototype.compareFlags = function(a, b)
	{
		var columnDelta = a.getColumn() - b.getColumn();
		return columnDelta ||
			a.description().localeCompare(b.description());
	}
	
	function QuickAddExperiencePanel(panelNode, experienceController) {
			
		var _this = this;
		
		this.panelNode = panelNode;
		this.dimmer = new Dimmer(panelNode, 200);
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
			
		$(this.mainDiv.node()).on('resize.cr', function()
			{
				_this.handleResize(0);
			});
		
		$.when(_this.dimmer.show(), cr.Service.servicesPromise())
		 .then(function(x1, services)
			{
				try
				{
					var controllers = services.map(function(s) { return new ServiceFlagController(s); });
					controllers.sort(function(a, b) { return _this.compareFlags(a, b); });

					_this.flagRows = _this.flagsContainer.selectAll('span')
						.data(controllers)
						.enter()
						.append('span')
						.classed('flag-row', true);
					var g = _this.flagRows.append('span')
						.on('click', function(d)
							{
								if (prepareClick('click', d.service.description()))
								{
									try
									{
										var $currentFlag = $(this).parent();
										if (_this.currentService == d.service)
										{
											var newLeft = d.expanded
												? d.x
												: $(_this.mainDiv.node()).innerWidth() - $currentFlag.outerWidth(true);
											d.expanded = !d.expanded;
											$currentFlag.animate(
														{left: newLeft},
														{duration: 400})
														.promise()
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
										else
										{
											_this.currentService = d.service;
											_this.filterFlags();
											_this._setFlagCoordinates(_this.flagRows, undefined, undefined);
											TagPoolView.prototype.moveFlags.call(_this, undefined)
												.then(function()
												{
													d.expanded = true;
													return $currentFlag.animate(
														{left: $(_this.mainDiv.node()).innerWidth() - $currentFlag.outerWidth(true)},
														{duration: 400})
														.promise();
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
					var mouseDownElement = null;
					var previousButtons = _this.flagRows.append('button')
						.classed('timeframe-button', true)
						.text(crv.buttonTexts.previousTimeframe)
						.on('mousedown', function()
							{
								mouseDownElement = this;
							})
						.on('blur', function(d)
							{
								if (mouseDownElement)
									mouseDownElement = null;
								else
									_this.hideFlagRow($(this).parent());
							})
						.on('click', function(d)
							{
								if (prepareClick('click', crv.buttonTexts.previousTimeframe + ": " + d.service.description()))
								{
									try
									{
										var $flagRow = $(this).parent();
										_this.addService(experienceController.parent(), d.service, 'Previous')
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
					var currentButtons = _this.flagRows.append('button')
						.classed('timeframe-button', true)
						.text(crv.buttonTexts.currentTimeframeShort)
						.on('mousedown', function()
							{
								mouseDownElement = this;
							})
						.on('blur', function(d)
							{
								if (mouseDownElement)
									mouseDownElement = null;
								else
									_this.hideFlagRow($(this).parent());
							})
						.on('click', function(d)
							{
								if (prepareClick('click', crv.buttonTexts.previousTimeframe + ": " + d.service.description()))
								{
									try
									{
										var $flagRow = $(this).parent();
										_this.addService(experienceController.parent(), d.service, 'Current')
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
					var goalButtons = _this.flagRows.append('button')
						.classed('timeframe-button', true)
						.text(crv.buttonTexts.goalTimeframeShort)
						.on('mousedown', function()
							{
								mouseDownElement = this;
							})
						.on('blur', function(d)
							{
								if (mouseDownElement)
									mouseDownElement = null;
								else
									_this.hideFlagRow($(this).parent());
							})
						.on('click', function(d)
							{
								if (prepareClick('click', crv.buttonTexts.previousTimeframe + ": " + d.service.description()))
								{
									try
									{
										var $flagRow = $(this).parent();
										_this.addService(experienceController.parent(), d.service, 'Goal')
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

