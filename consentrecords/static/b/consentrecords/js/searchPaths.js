var SearchPathsResultsView = (function () {
	SearchPathsResultsView.prototype = new SearchOptionsView();
	SearchPathsResultsView.prototype.searchPathsPanel = null;
	SearchPathsResultsView.prototype.inputBox = null;
	
	SearchPathsResultsView.prototype.inputText = function(val)
	{
		if (val === undefined)
			return this.inputBox.value.trim();
		else
		{
			this.inputBox.value = val;
			$(this.inputBox).trigger("input");
		}
	}
	
	SearchPathsResultsView.prototype.appendDescriptions = function(buttons)
	{
		var _this = this;
		
		buttons.each(function(d)
			{
				/* TODO: */
				var leftText = d3.select(this).append('div').classed("left-expanding-div description-text", true);
				var screenName = d.getDatum("_name");
				var user = d.getValue("_user");
				
				leftText.text(screenName || (user && user.getDescription()) || d.getDescription());
			});
	}
	
	SearchPathsResultsView.prototype.onClickButton = function(d, i) {
		var _this = this;
		
		/* TODO: */
		if (prepareClick('click', 'other path'))
		{
			showPath(d, this.searchPathsPanel.node());
		}
		d3.event.preventDefault();
	}
	
	SearchPathsResultsView.prototype.isButtonVisible = function(button, d, compareText)
	{
		/* TODO: */
		return true;
	}
	
	SearchPathsResultsView.prototype.noResultString = function()
	{
		return "";
	}
	
	SearchPathsResultsView.prototype.textCleared = function()
	{
		/* Do nothing */
	}
	
	SearchPathsResultsView.prototype.textChanged = function()
	{
		/* Do nothing */
	}
	
	SearchPathsResultsView.prototype.searchPath = function(val)
	{
		var path;
		{
			/* TODO: */
			path = '"More Experiences"';
			
			var qf = this.searchPathsPanel.getQueryFlags();
			if (!qf.length)
				return null;
			
			qf.forEach(function(sf)
				{
					if (sf.service)
						path += '["More Experience"[Service="{0}"]]'.format(sf.service.getValueID());
				});
			return path;
		}
	}
	
	SearchPathsResultsView.prototype.appendSearchArea = function()
	{
		return d3.select(this.searchPathsPanel.resultContainerNode).append('ol')
			.classed('search', true);
	}
	
	/* Overwrite this function to use a different set of fields for the getData or selectAll operation
		sent to the middle tier.
	 */
	SearchPathsResultsView.prototype.fields = function()
	{
		return ["More Experience", "parents"];
	}
	
	function SearchPathsResultsView(searchPathsPanel)
	{
		if (!searchPathsPanel)
			throw new Error("searchPathsPanel is not specified");

		var _this = this;

		this.searchPathsPanel = searchPathsPanel;
		SearchOptionsView.call(this, searchPathsPanel.resultContainerNode, 
			function(buttons) { _this.appendDescriptions(buttons); });

		this.inputBox = searchPathsPanel.searchInput;
	}
	
	return SearchPathsResultsView;
})();

var SearchPathsPanel = (function () {
	SearchPathsPanel.prototype = new SitePanel();
	SearchPathsPanel.prototype.previousPanel = null;
	SearchPathsPanel.prototype.selectedPool = null;
	
	SearchPathsPanel.prototype.topBox = null;
	SearchPathsPanel.prototype.searchInput = null;
	SearchPathsPanel.prototype.cancelButton = null;
	SearchPathsPanel.prototype.topHandle = null;
	SearchPathsPanel.prototype.poolFlags = null;
	SearchPathsPanel.prototype.queryFlags = null;
	
	SearchPathsPanel.prototype.textDetailLeftMargin = 4.5; /* textLeftMargin; */
	SearchPathsPanel.prototype.searchFlagHSpacing = 15;
	SearchPathsPanel.prototype.searchFlagVSpacing = 1.0;
	SearchPathsPanel.prototype.flagHeightEM = 2.333;
	SearchPathsPanel.prototype.emToPX = 11;
	
	SearchPathsPanel.prototype.queryFlagsHeight = 137;

	SearchPathsPanel.prototype.revealInput = function(duration)
	{
		var newTop = $(this.previousPanel).height() 
					 - $(this.searchInput).outerHeight(true)
					 - $(this.topHandle).outerHeight(true);
		
		/* Reset the right margin to the same as the left margin. */
		var inputMarginLeft = parseInt($(this.searchInput).css('margin-left'));
		var inputMarginRight = parseInt($(this.searchInput).css('margin-right'));

		var inputWidth = $(this.searchInput.parentNode).width()
						 - inputMarginLeft + inputMarginRight
						 - $(this.searchInput).outerWidth(true) + $(this.searchInput).outerWidth(false);

		var _this = this;
		$(this.node()).animate({top: newTop,
								height: $(this.topBox).outerHeight(true)},
							   {duration: duration});
		$(this.searchInput).animate({width: inputWidth,
									 "margin-right": inputMarginLeft},
								    {duration: duration,
									 done: function()
										{
											$(_this.searchInput).val('');
											
											/* Hide and show the input so that the placeholder
												re-appears properly in safari 10 and earlier. */
											$(_this.searchInput).hide(0).show(0);
										}
									 });
		$(this.cancelButton).animate({left: inputWidth + (2 * inputMarginLeft),
									  opacity: 0.0},
							   {duration: duration});
	}
	
	SearchPathsPanel.prototype.revealPanel = function(duration)
	{
		/* Ensure the height of the node and the mainNode are correct. */
		var parentHeight = $(this.node().parentNode).height();
		$(this.node()).height(parentHeight);
		$(this.mainDiv.node()).height(parentHeight);

		/* Set the right margin of the search input to 0 and account for this in the inputWidth */
		var parentWidth = $(this.searchInput.parentNode).width();
		var inputMarginLeft = parseInt($(this.searchInput).css('margin-left'));
		var inputMarginRight = parseInt($(this.searchInput).css('margin-right'));
		
		var inputWidth = parentWidth 
						 - $(this.searchInput).outerWidth(true) + $(this.searchInput).outerWidth(false)
						 + inputMarginRight
						 - $(this.cancelButton).outerWidth(true);
						 
		$(this.node()).animate({top: 0,
								height: $(this.node().parentNode).height()},
							   {duration: duration});
		$(this.searchInput).animate({width: inputWidth,
									 "margin-right": 0},
							   {duration: duration});
		$(this.cancelButton).animate({left: inputWidth + inputMarginLeft,
									  opacity: 1.0},
							   {duration: duration});
		
		queryFlagsWidth = $(this.queryFlags.node()).width();
		
		this.queryFlags.attr('height', this.queryFlagsHeight);
	}
	
	SearchPathsPanel.prototype.setFlagText = function(node)
	{
		var g = d3.select(node);
		g.selectAll('text').selectAll('tspan:nth-child(1)')
			.text(function(d) { return d.getDescription(); })
	}
		
	/* Sets the x, y and y2 coordinates of each flag. */
	SearchPathsPanel.prototype._setFlagCoordinates = function(g, maxX)
	{
		var _this = this;

		var deltaY = _this.flagHeightEM + _this.searchFlagVSpacing;
		var startX = 0;
		var nextY = 0;
		var nextX = 0;
		g.each(function(fd, i)
			{
				fd.x = nextX;
				if (fd.visible === undefined || fd.visible)
				{
					nextX += $(this).children('rect').width() + _this.searchFlagHSpacing;
					if (nextX >= maxX && fd.x > startX)
					{
						nextY += deltaY;
						nextX = startX;
						fd.x = nextX;
						nextX += $(this).children('rect').width() + _this.searchFlagHSpacing;
					}
				}
				
				fd.y = nextY;
				fd.y2 = fd.y + _this.flagHeightEM;
			});
		
		return (nextY + _this.flagHeightEM) * this.emToPX;
	}
	
	/* Lay out all of the contents within the svg object. */
	SearchPathsPanel.prototype.layoutPoolFlags = function()
	{
		var g = this.poolFlags.selectAll('g.flag');
		
		var _this = this;
		
		var height = this._setFlagCoordinates(g, $(this.poolFlags.node()).width());
		
		this.poolFlags
			.style('height', height)
		
		g.interrupt().transition()
			.duration(1000)
			.attr('transform', function(fd) { return "translate({0},{1})".format(fd.x, fd.y * _this.emToPX); })
			.attr('opacity', function(fd) { return (fd.visible === undefined || fd.visible) ? 1.0 : 0.0; });
		
	}
	
	/* Lay out all of the contents within the svg object. */
	SearchPathsPanel.prototype.layoutQueryFlags = function()
	{
		var g = this.queryFlags.selectAll('g.flag');
		
		var _this = this;
		
		this._setFlagCoordinates(g, $(this.queryFlags.node()).width());
		
		g.transition()
			.duration(1000)
			.attr('transform', function(fd) { return "translate({0},{1})".format(fd.x, fd.y * _this.emToPX); });
		
	}
	
	SearchPathsPanel.prototype.getNextQueryFlagPosition = function(sourceFlag)
	{
		var lastChild = this.queryFlags.selectAll('g:last-child');
		if (lastChild.size() == 0)
			return {top: 0, left:0};
		else
		{
			var oldS = lastChild.datum();
			var nextRight = oldS.x + lastChild.node().getBBox().width + this.searchFlagHSpacing;
			if (nextRight + sourceFlag.getBBox().width 
				> $(this.queryFlags.node()).width())
			{
				return {top: (oldS.y + this.flagHeightEM + this.searchFlagVSpacing) * this.emToPX,
						left: 0};
			}
			else
			{
				return {top: oldS.y * this.emToPX,
						left: nextRight};
			}
		}
	}
	
	SearchPathsPanel.prototype.comparePoolFlags = function(a, b)
	{		
		var _this = this;
		function inQueryFlags(a)
		{
			return _this.queryFlags.selectAll('g.flag').data()
				.some(function(fd) { return fd.service == a.service; });
		}
		
		if (inQueryFlags(a))
		{
			if (!inQueryFlags(b))
				return 1;
		}
		else if (inQueryFlags(b))
			return -1;
		else
		{
			aDesc = a.service.getDescription();
			bDesc = b.service.getDescription();
			return aDesc.localeCompare(bDesc);
		}
	}
	
	SearchPathsPanel.prototype.onQueryFlagClicked = function(queryFlag, service)
	{
		var _this = this;
		
		$(queryFlag).animate({opacity: 0.0},
			{done: function()
				{
					$(this).remove();
					_this.poolFlags.selectAll('g.flag').sort(function(a, b) { return _this.comparePoolFlags(a, b); });
					
					_this.layoutPoolFlags();
					_this.layoutQueryFlags();
		
					/* Run a new search based on the query. */
					_this.searchPathsResultsView.restartSearchTimeout(_this.searchPathsResultsView.inputCompareText());
				}});
	}
	
	SearchPathsPanel.prototype.addFlagToQuery = function(poolFlag, s)
	{
		/* Make an svg whose position is identical to poolFlag relative to mainDiv. */
		var travelSVG = this.mainDiv.append('svg')
			.classed('travel flags', true);
		
		/* Set the svg dimensions to the same as the flag. */
		var poolFlagRect = poolFlag.getBBox();
		$(travelSVG.node()).width(poolFlagRect.width)
			.height(poolFlagRect.height);
		
		var poolFlagsRect = this.poolFlags.node().getBoundingClientRect();	
		travelSVG.style('left', poolFlagsRect.left + s.x)
			.style('top', poolFlagsRect.top + (s.y * this.emToPX));
 		
 		/* Create a new flag in the svg. */
 		var g = travelSVG.append('g')
 			.datum(s);
			
		this.appendFlag(g);
		
		/* Cover the old flag with a hole. */
		var rectHole = d3.select(poolFlag).append('rect').classed('hole', true)
			.attr('width', poolFlagRect.width)
			.attr('height', poolFlagRect.height);
 		
 		/* Figure out where travelSVG is going to end up relative to queryFlags. */
 		var newPosition = $(this.queryFlags.node()).position();
 		var flagPosition = this.getNextQueryFlagPosition(poolFlag);
 		newPosition.top += flagPosition.top;
 		newPosition.left += flagPosition.left;
 		
 		var _this = this;
 		/* Animate the movement of the svg to its new location. */
 		travelSVG.transition()
 			.duration(400)
 			.style('top', newPosition.top)
 			.style('left', newPosition.left)
 			.each("end", function() {
					/* Add a query flag that is the same as the svg flag in the same position. */
					var newS = new Service(s.service);
					newS.x = flagPosition.left;
					newS.y = flagPosition.top / _this.emToPX;
					var queryFlag = _this.queryFlags.append('g')
						.datum(newS)
						.on('click', function(fd) { _this.onQueryFlagClicked(this, fd); })
						.attr('transform', 
						      function(fd) { return "translate({0},{1})".format(fd.x, fd.y * _this.emToPX); });
	
					_this.appendFlag(queryFlag);
					
					/* Dispose of the travelSVG. */
					travelSVG.remove();
					
					/* Dispose of the hole. */
					rectHole.transition()
						.duration(400)
						.attr('opacity', 0.0)
						.remove();
		
					/* Run a new search based on the query. */
					_this.searchPathsResultsView.restartSearchTimeout(_this.searchPathsResultsView.inputCompareText());
				 });
 		
 		/* Move the poolFlag to the end of its list. */
 		poolFlag.parentElement.appendChild(poolFlag);
 		
 		/* Reset the positions of all of the pool flags. */
 		this.layoutPoolFlags();
	}
	
	SearchPathsPanel.prototype.getQueryFlags = function()
	{
		return this.queryFlags.selectAll('g.flag').data();
	}
	
	SearchPathsPanel.prototype.filterPool = function()
	{
		var g = this.poolFlags.selectAll('g.flag');
		
		var inputTexts = this.searchInput.value.toLocaleUpperCase().split(' ');
		
		if (inputTexts.length > 0)
		{
			g.data().forEach(function(fs)
				{
					fs.visible = false;
					fs.visible = inputTexts.reduce(function(a, b)
						{
							return a && fs.contains(b);
						}, true);
				});
		}
		else
		{
			g.data().forEach(function(fs)
				{
					fs.visible = undefined;
				});
		}
	}
	
	SearchPathsPanel.prototype.appendFlag = function(g)
	{
		g.classed('flag', true);
		
		g.append('line').classed('flag-pole', true)
			.attr('x1', 1.5)
			.attr('x2', 1.5)
			.attr('stroke-opacity', '1.0')
			.attr('fill', 'white')
			.attr('stroke', 'white');
		g.append('line').classed('flag-pole', true)
			.attr('x1', 1.5)
			.attr('x2', 1.5)
			.each(function(d)
				{
					d.colorElement(this);
				});
		g.append('rect').classed('opaque', true)
			.attr('x', 3);
		g.append('rect').classed('bg', true)
			.attr('x', 3)
			.each(function(d)
				{
					d.colorElement(this);
				});
		var text = g.append('text').classed('flag-label', true)
			.attr('x', this.textDetailLeftMargin);
		text.append('tspan')
			.attr('dy', '1.1em');
		
		var _this = this;	
		g.each(function() { _this.setFlagText(this); });

		g.selectAll('rect')
			.attr('height', "{0}em".format(this.flagHeightEM))
			.attr('width', function(fd)
				{
					return $(this.parentNode).children('text').outerWidth() + 5;
				});	
		
		g.selectAll('line.flag-pole')
			.attr('y2', function(fd) { return "{0}em".format(_this.flagHeightEM); });

	}
	
	SearchPathsPanel.prototype.appendPoolFlags = function(s)
	{
		var _this = this;
		this.poolFlags.selectAll('g.flag').remove();
		
		var g = this.poolFlags.selectAll('g')
			.data(s)
			.enter()
			.append('g');
			
		this.appendFlag(g);

		g.on('click', function(s)
			{
				if (s.visible === undefined || s.visible)
					_this.addFlagToQuery(this, s);
			});
	}
	
	SearchPathsPanel.prototype.handleColumnClick = function(services, column)
	{
		var s = services.map(function(e) { return new Service(e); })
					.filter(function(d)
						{
							return d.getColumn() == column;
						});

		$(this.searchInput).val('');
		$(this.searchInput).focus();
		this.appendPoolFlags(s);
		this.filterPool();
		this.layoutPoolFlags();
	}

	SearchPathsPanel.prototype.handleSchoolClick = function()
	{
		var _this = this;
		crp.promise({path: "Service"})
			.done(function(services)
				{
					_this.handleColumnClick(services, 1);
				});
	}
	
	SearchPathsPanel.prototype.handleInterestsClick = function()
	{
		var _this = this;
		crp.promise({path: "Service"})
			.done(function(services)
				{
					_this.handleColumnClick(services, 2);
				});
	}
	
	SearchPathsPanel.prototype.handleCareerClick = function()
	{
		var _this = this;
		crp.promise({path: "Service"})
			.done(function(services)
				{
					_this.handleColumnClick(services, 3);
				});
	}
	
	SearchPathsPanel.prototype.skillsClick = function()
	{
		var _this = this;
		crp.promise({path: "Service"})
			.done(function(services)
				{
					_this.handleColumnClick(services, 4);
				});
	}
	
	SearchPathsPanel.prototype.givingBackClick = function()
	{
		var _this = this;
		crp.promise({path: "Service"})
			.done(function(services)
				{
					_this.handleColumnClick(services, 5);
				});
	}
	
	SearchPathsPanel.prototype.housingClick = function()
	{
		var _this = this;
		crp.promise({path: "Service"})
			.done(function(services)
				{
					_this.handleColumnClick(services, 0);
				});
	}
	
	SearchPathsPanel.prototype.wellnessClick = function()
	{
		var _this = this;
		crp.promise({path: "Service"})
			.done(function(services)
				{
					_this.handleColumnClick(services, 6);
				});
	}
	
	SearchPathsPanel.prototype.handleAllClick = function()
	{
		var _this = this;
		
		crp.promise({path: "Service"})
			.done(function(services)
				{
					var s = services.map(function(e) { return new Service(e); });
					
					if ($(_this.node()).position().top == 0)
					{
						$(_this.searchInput).val('');
						$(_this.searchInput).focus();
					}
					_this.appendPoolFlags(s);
					_this.filterPool();
					_this.layoutPoolFlags();
				});
	}
	
	function SearchPathsPanel(previousPanel)
	{
		this.previousPanel = previousPanel;
		
		var _this = this;
		
		$(window).resize(function()
			{
				if ($(_this.node()).position().top == 0)
				{
					resizeContents();
				}
			});
			
		SitePanel.call(this, previousPanel, null, "Search Paths", "search-paths");
		
		var mainDiv = this.appendScrollArea();
		
		var topBox = mainDiv.append('div');
		this.topBox = topBox.node();
			
		this.topHandle = topBox.append('div')
			.classed('handle', true)
			.node();
			
		this.searchInput = topBox.append('input')
			.attr('placeholder', 'Search for another path')
			.node();
			
		this.cancelButton = topBox.append('button')
			.classed('cancel', true)
			.text('Cancel')
			.node();
			
		$(this.searchInput).focusin(function(event)
			{
				_this.revealPanel();
				event.stopPropagation();
			})
			.click(function(event)
			{
				event.stopPropagation();
			})
			.on('input', function(event)
			{
				_this.filterPool();
				_this.layoutPoolFlags();
				event.stopPropagation();
			});
			
		var horizontalDiv = mainDiv.append('div')
			.classed('horizontal-overflow', true);
			
		var div = horizontalDiv.append('div');
		
		var svgData = [{name: "All", color: "#222", click: this.handleAllClick},
				   {name: "School", color: "#2828E7", click: this.handleSchoolClick},
				   {name: "Interests", color: "#8328E7", click: this.handleInterestsClick},
				   {name: "Career", color: "#805050", click: this.handleCareerClick},
				   {name: "Skills", color: "#D55900", click: this.skillsClick},
				   {name: "Giving Back", color: "#176B36", click: this.givingBackClick},
				   {name: "Housing", color: "#804040", click: this.housingClick},
				   {name: "Wellness", color: "#0694F3", click: this.wellnessClick},
				  ];
				  
		var svgs = div.selectAll('svg')
			.data(svgData)
			.enter()
			.append('svg');
		svgs.append('circle')
			.attr('r', 16).attr('cx', 30).attr('cy', 23)
			.attr('fill', 'white');
		svgs.append('circle')
			.attr('r', 16).attr('cx', 30).attr('cy', 23).attr('opacity', 0.8)
			.attr('fill', '#777');
		svgs.append('text')
			.classed('icon-label', true)
			.attr('x', 30).attr('y', 49)
			.attr('fill', '#777')
			.text(function(d) { return d.name; });
			
		svgs.on('click', function(d)
			{
				svgs.selectAll('circle:last-of-type')
					.attr('fill', '#777');
				d3.select(this).selectAll('circle:last-of-type')
					.attr('fill', d.color);
				svgs.selectAll('text')
					.style('fill', '#777');
				d3.select(this).selectAll('text')
					.style('fill', d.color);
				if (d.click)
				{
					_this.selectedPool = d;
					d.click.call(_this);
				}
			});
			
		div.select('svg:first-child')
			.selectAll('circle:last-of-type')
			.attr('fill', function(d) { return d.color; });
		div.select('svg:first-child')
			.selectAll('text')
			.style('fill', function(d) { return d.color; });
		this.selectedPool = svgData[0];
		
		this.poolContainer = this.mainDiv.append('div')
			.classed('pool-container', true);
				
		this.poolFlags = this.poolContainer.append('svg')
			.classed('flags', true)
			.style('height', 120);
			
		this.queryContainer = this.mainDiv.append('div')
			.classed('query-container', true);
			
		this.queryFlags = this.queryContainer.append('svg')
			.classed('query flags', true);
			
		$(this.topBox).click(function(event)
			{
				if ($(_this.node()).position().top == 0)
					_this.revealInput();
				else
				{
					$(_this.searchInput).focus();
				}
				event.stopPropagation();
			});
			
		$(this.cancelButton).click(function(event)
			{
				_this.revealInput();
				event.stopPropagation();
			});
			
		function resizeContents()
		{
			if ($(_this.node()).position().top == 0)
			{
				_this.revealPanel(0);
				_this.layoutPoolFlags();
			}
			else
				_this.revealInput(0);
		}
		
		$(mainDiv.node()).on("resize.cr", resizeContents);
		
		setTimeout(function()
			{
				_this.panelDiv.style('top', "{0}px".format($(previousPanel).height()));
				_this.panelDiv.style('display', 'block');
				_this.revealInput();

				_this.searchPathsResultsView = new SearchPathsResultsView(_this);
				
				$(_this.previousPanel.sitePanel.pathtree).on('userSet.cr', function()
					{
						_this.handleAllClick();
					});
		
			});
			
		this.resultContainerNode = this.mainDiv.append('div')
			.classed('results-container', true)
			.node();
			
	}
	
	return SearchPathsPanel;
})();
