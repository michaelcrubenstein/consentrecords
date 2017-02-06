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
				var leftText = d3.select(this);
				
				var screenName = d.getDatum("_name");
				var user = d.getValue("_user");
				var userName = user && (getUserName(user));
				var userDescription = user && user.getDescription();
				var ageCalculator = new AgeCalculator(d.getValue("Birthday").getDescription());
				var ageDescription = ageCalculator.toString();			
				
				if (screenName) leftText.append('div').text(screenName);
				if (userName && userName != screenName) leftText.append('div').text(userName);
				/* Only include the email address if there is no userName or screenName */
				if (userDescription && !userName && !screenName) leftText.append('div').text(userDescription);
				leftText.append('div').text(ageDescription);
			});
	}
	
	SearchPathsResultsView.prototype.containsQuery = function(fc, queryFlags) {
		var offering = fc.experience.getValue("Offering");
		if (offering && offering.getInstanceID())
		{
			if (!offering.areCellsLoaded())
				throw ("Runtime error: offering data is not loaded");
				
			var services = offering.getCell("Service");
			if (services.data.findIndex(function(s)
				{
					return queryFlags.findIndex(function(qf)
						{
							return s.getCell("Service").data.findIndex(function(s2)
								{
									return qf.service.getInstanceID() == s2.getInstanceID();
								}) >= 0;
						}) >= 0;
				}) >= 0)
				return true;
		}
		
		var serviceCell = fc.experience.getCell("Service");
		if (serviceCell)
		{
			if (serviceCell.data.findIndex(function(s) {
					return queryFlags.findIndex(function(qf)
					{
						return s.getCell("Service").data.findIndex(function(s2)
							{
								return qf.service.getInstanceID() == s2.getInstanceID();
							}) >= 0;
					}) >= 0;
				}) >= 0)
				return true;
		}
		return false;
	}
	
	SearchPathsResultsView.prototype.onClickButton = function(d, i) {
		var _this = this;
		
		if (prepareClick('click', 'other path'))
		{
			showPath(d, this.searchPathsPanel.node())
				.then(function(panel)
					{
						$(panel.pathtree).on("userSet.cr", function()
							{
								var queryFlags = _this.searchPathsPanel.queryFlags.selectAll('g.flag').data();
								panel.pathtree.flagControllers().forEach(function(fc)
									{
										fc.selected(_this.containsQuery(fc, queryFlags));
									});
							});
					});
		}
		d3.event.preventDefault();
	}
	
	SearchPathsResultsView.prototype.isButtonVisible = function(button, d, compareText)
	{
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
			path = '"Path"';
			
			var qf = this.searchPathsPanel.getQueryFlags();
			if (!qf.length)
				return null;
			
			qf.forEach(function(sf)
				{
					if (sf.service)
						path += '["More Experience"[Service[Service="{0}"]|Offering>Service[Service="{0}"]]]'.format(sf.service.getInstanceID());
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
		return ["parents", "_user"];
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
	
	SearchPathsPanel.prototype.resultsTopMargin = 10;
	
	SearchPathsPanel.prototype.queryFlagsHeight = 101;

	SearchPathsPanel.prototype.clearInput = function()
	{
		$(this.searchInput).val('');
											
		/* Hide and show the input so that the placeholder
			re-appears properly in safari 10 and earlier. */
		$(this.searchInput).hide(0).show(0);
	}
	
	SearchPathsPanel.prototype.revealInput = function(duration)
	{
		var newTop = $(window).height() 
					 - $(this.searchInput).outerHeight(true)
					 - $(this.topHandle).outerHeight(true);
		
		/* Reset the right margin to the same as the left margin. */
		var inputMarginLeft = parseInt($(this.searchInput).css('margin-left'));
		var inputMarginRight = parseInt($(this.searchInput).css('margin-right'));

		var inputWidth = $(this.searchInput.parentNode).width()
						 - inputMarginLeft + inputMarginRight
						 - $(this.searchInput).outerWidth(true) + $(this.searchInput).outerWidth(false);

		var poolTop = $(this.topBox).outerHeight(true) + $(this.stagesDiv).outerHeight(true);				   

		var queryBottom;
		if (this.queryFlags.selectAll('g').size() == 0)
			queryBottom = 0;
		else
			queryBottom = 100;
			
		var _this = this;
		
		this.mainDiv.classed('vertical-scrolling', false)
			.classed('no-scrolling', true);
			
		return $.when(
			$(this.node()).animate({top: newTop,
									height: $(this.topBox).outerHeight(true)},
								   {duration: duration}),
			$(this.searchInput).animate({width: inputWidth,
										 "margin-right": inputMarginLeft},
										{duration: duration,
										 done: function()
											{
												_this.clearInput();
											}
										 }),
			$(this.cancelButton).animate({left: inputWidth + (2 * inputMarginLeft),
										  opacity: 0.0},
								   {duration: duration})
			);
	}
	
	SearchPathsPanel.prototype.revealPanel = function(duration)
	{
		/* Ensure the height of the node and the mainNode are correct. */
		var parentHeight = $(window).height();
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
								height: parentHeight},
							   {duration: duration});
		$(this.searchInput).animate({width: inputWidth,
									 "margin-right": 0},
							   {duration: duration});
		$(this.cancelButton).animate({left: inputWidth + inputMarginLeft,
									  opacity: 1.0},
							   {duration: duration});
							   
		var poolTop = $(this.topBox).outerHeight(true) + $(this.stagesDiv).outerHeight(true);				   
		
		this.mainDiv.classed('vertical-scrolling', true)
			.classed('no-scrolling', false);

		var resultsTop;
		var resultsHeight;
		var queryHeight;
		var queryBottom;
		var poolHeight;
		if (this.queryFlags.selectAll('g').size() == 0)
			queryBottom = 0;
		else
			queryBottom = 100;
			
		var $poolContainer = $(this.poolContainer.node());
		var $queryContainer = $(this.queryContainer.node());
			
		var poolVMargins = $poolContainer.outerHeight(true) - $poolContainer.outerHeight(false);
		var poolHMargins = $poolContainer.outerWidth(true) - $poolContainer.innerWidth();
		var queryVMargins = $queryContainer.outerHeight(true) - $queryContainer.outerHeight(false);
		var queryVPadding = parseInt($queryContainer.css('padding-top')) + 
							parseInt($queryContainer.css('padding-bottom'));
		if (parentHeight < parentWidth)
		{
			$poolContainer.css('display', 'inline-block');
			poolHeight = $(window).height() - queryBottom - poolTop - poolVMargins;
			queryHeight = poolHeight;
			$(this.poolContainer.node()).stop().animate(
				{width: parentWidth / 2 - poolHMargins, 
				 height: poolHeight},
				{duration: duration});
			$queryContainer.stop().animate(
				{"margin-top": 10,
				 "margin-left": 0,
				 width: parentWidth / 2 - poolHMargins,
				 height: poolHeight},
				{duration: duration});
			this.layoutPoolFlags(parentWidth / 2 - poolHMargins, duration);
		}
		else
		{
			$poolContainer.css('display', 'block');
			poolHeight = $(window).height() - queryBottom - poolTop - poolVMargins -
						 this.queryFlagsHeight - parseInt($queryContainer.css('margin-bottom'));
			queryHeight = this.queryFlagsHeight;
			$poolContainer.stop().animate(
				{width: parentWidth - poolHMargins, 
				 height: poolHeight},
				{duration: duration});
			$queryContainer.stop().animate(
				{"margin-top": 0,
				 "margin-left": 10,
				 width: parentWidth - poolHMargins,
				 height: this.queryFlagsHeight},
				{duration: duration});
			this.layoutPoolFlags(parentWidth - poolHMargins, duration);
		}
		
		this.queryFlags
 			.interrupt().transition().duration(400)
			.attr('height', this.queryFlagsHeight - queryVPadding);

		if (this.queryFlags.selectAll('g').size() == 0)
			resultsHeight = 0;
		else
			resultsHeight = $(window).height() - this.resultsTopMargin;
		
		var _this = this;
		return $.when(
			$(this.resultContainerNode).stop()
				.animate({height: resultsHeight},
						 {duration: duration})
				.promise(),
							   
			/* Scroll the parentNode top to 0 so that the searchInput is sure to appear.
				This is important on iPhones where the soft keyboard appears and forces scrolling. */
			$(this.node().parentNode)
				.animate({scrollTop: 0},
						 {duration: duration})
				.promise()
			)
			.then(function()
				{
					_this.checkResultsScrolling();
				});
	}
	
	SearchPathsPanel.prototype._setFlagText = function(node)
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
					var thisSpacing = this.getElementsByTagName('rect')[0].getBBox().width;
					nextX += thisSpacing;
					if (nextX >= maxX && fd.x > startX)
					{
						nextY += deltaY;
						nextX = startX;
						fd.x = nextX;
						nextX += thisSpacing;
					}
					nextX += _this.searchFlagHSpacing;
				}
				
				fd.y = nextY;
				fd.y2 = fd.y + _this.flagHeightEM;
			});
		
		return (nextY + _this.flagHeightEM) * this.emToPX;
	}
	
	/* Lay out all of the contents within the svg object. */
	SearchPathsPanel.prototype.layoutPoolFlags = function(maxX, duration)
	{
		maxX = maxX !== undefined ? maxX : $(this.poolFlags.node()).width();
		duration = duration !== undefined ? duration : 700;
		
		var g = this.poolFlags.selectAll('g.flag');
		
		var _this = this;
		
		var height = this._setFlagCoordinates(g, maxX);
		
		/* Set the height of the svg to match the total height of all of the flags. */
		this.poolFlags
 			.interrupt().transition().duration(duration)
			.attr('height', height)
		
		g
 			.interrupt().transition().duration(duration)
			.attr('transform', function(fd) { return "translate({0},{1})".format(fd.x, fd.y * _this.emToPX); })
			.style('opacity', function(fd) { return (fd.visible === undefined || fd.visible) ? 1.0 : 0.0; });
		
	}
	
	/* Lay out all of the contents within the svg object. */
	SearchPathsPanel.prototype.layoutQueryFlags = function()
	{
		var g = this.queryFlags.selectAll('g.flag');
		
		var _this = this;
		
		this._setFlagCoordinates(g, $(this.queryFlags.node()).width());
		
		g
 			.interrupt().transition().duration(1000)
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
					
					var promise = null;
					if ($(_this.queryFlags.node()).children().length == 0)
						promise = _this.revealPanel();
		
					var f = function()
						{
							_this.enableResultsScrolling();
							_this.searchPathsResultsView.startSearchTimeout(_this.searchPathsResultsView.inputCompareText(), 0);
							_this.checkResultsScrolling();
						}
					/* Run a new search based on the query. */
					if (promise)
						promise.then(f);
					else
						f();
					
				}});
		if ($(this.queryFlags.node()).children().length == 1)
		{
			this.queryContainer.selectAll('span')
 				.interrupt().transition().duration(400)
				.style('opacity', 1.0);
			this.revealPanel();
		}
	}
	
	SearchPathsPanel.prototype._clearQuery = function()
	{
		var _this = this;
		$(this.queryFlags.node()).children().remove();
		this.poolFlags.selectAll('g.flag').sort(function(a, b) { return _this.comparePoolFlags(a, b); });
		
		this.layoutPoolFlags();
		
		/* Show the help message in the query container */ 
		this.queryContainer.selectAll('span')
 							.interrupt().transition().duration(400)
							.style('opacity', 1.0);

		/* Clear the results from the search. */
		this.searchPathsResultsView.cancelSearch();
	}
	
	SearchPathsPanel.prototype.enableResultsScrolling = function()
	{
		$(this.resultContainerNode).css('overflow-y', '');
	}
	
	SearchPathsPanel.prototype.disableResultsScrolling = function()
	{
		$(this.resultContainerNode).css('overflow-y', 'hidden');
	}
	
	SearchPathsPanel.prototype.checkResultsScrolling = function()
	{
		var offsetParent = $(this.resultContainerNode).offsetParent();
		var maxScrollTop = offsetParent.prop('scrollHeight') - offsetParent.innerHeight();
		var canOverflow = (maxScrollTop <= offsetParent.scrollTop()) ||
			$(this.resultContainerNode).scrollTop() > 0;
		
		$(this.resultContainerNode).css('overflow-y', canOverflow ? '' : 'hidden');
	}
	
	SearchPathsPanel.prototype.addFlagToQuery = function(poolFlag, s)
	{
		/* Make an svg whose position is identical to poolFlag relative to mainDiv. */
		var travelSVG = this.mainDiv.append('svg')
			.classed('travel flags', true)
			.attr('xmlns', "http://www.w3.org/2000/svg")
			.attr('version', "1.1");
		
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
 		var newPosition = this.queryFlags.node().getBoundingClientRect();
 		var flagPosition = this.getNextQueryFlagPosition(poolFlag);
 		
 		var _this = this;
 		/* Animate the movement of the svg to its new location. */
 		travelSVG.interrupt().transition()
 			.duration(400)
 			.style('top', newPosition.top + flagPosition.top)
 			.style('left', newPosition.left + flagPosition.left)
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
					
					var promise = null;
					if (_this.queryFlags.selectAll('g').size() == 1)
					{
						_this.queryContainer.selectAll('span')
 							.interrupt().transition().duration(400)
							.style('opacity', 0.0);
						promise = _this.revealPanel();
					}
					
					/* Dispose of the travelSVG. */
					travelSVG.remove();
					
					/* Dispose of the hole. */
					rectHole.interrupt().transition()
						.duration(400)
						.style('opacity', 0.0)
						.remove();
		
					/* Run a new search based on the query. */
					var f = function()
					{
						_this.enableResultsScrolling();
						_this.searchPathsResultsView.startSearchTimeout(_this.searchPathsResultsView.inputCompareText(), 0);
						_this.checkResultsScrolling();
					}
					if (promise)
						promise.then(f);
					else
						f();
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
		
		var f;
		var _this = this;
		if (this.filterColumn !== undefined)
		{
			f = function(fs)
				{
					fs.visible = (fs.getColumn() == _this.filterColumn);
				}
		}
		else
		{
			f = function(fs) { fs.visible = undefined; }
		}
		
		g.each(f);
			
		var inputTexts = this.searchInput.value.toLocaleUpperCase().split(' ');
		
		if (inputTexts.length > 0)
		{
			g.each(function(fs)
				{
					if (!inputTexts.reduce(function(a, b)
						{
							return a && fs.contains(b);
						}, true))
						fs.visible = false;
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
			.attr('dy', '1.1em')
			.attr('fill', function(d) {
				return d.fontColor();
			});
		
		var _this = this;	
		g.each(function() { _this._setFlagText(this); });

		g.selectAll('rect')
			.attr('height', "{0}em".format(this.flagHeightEM))
			.attr('width', function(fd)
				{
					return $(this.parentNode).children('text')[0].getBBox().width + 5;
				});	
		
		g.selectAll('line.flag-pole')
			.attr('y2', function(fd) { return "{0}em".format(_this.flagHeightEM); });

	}
	
	/* Remove all of the existing flags displayed and add all of the specified flags
		to the flag pool.
	 */
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
		/* Need to respecify the placeholder to fix a bug that causes
			the placeholder to not display when manually clearing the value
			after it has something within it.
		 */
		this.clearInput();
		this.filterColumn = column;
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
		this.clearInput();
		this.filterColumn = undefined;
		this.filterPool();
		this.layoutPoolFlags();
	}
	
	function SearchPathsPanel()
	{
		var _this = this;
		
		$(window).resize(function()
			{
				if ($(_this.node()).position().top == 0)
				{
					resizeContents();
				}
			});
			
		this.createRoot(null, "Search Paths", "search-paths");
		
		var mainDiv = this.appendScrollArea();
		
		var topBox = mainDiv.append('div');
		this.topBox = topBox.node();
			
		this.topHandle = topBox.append('div')
			.classed('handle', true)
			.node();
			
		this.searchInput = topBox.append('input')
			.attr('placeholder', 'Search for a path')
			.node();
			
		this.cancelButton = topBox.append('button')
			.classed('cancel', true)
			.text('Cancel')
			.node();
			
		$(this.searchInput).focusin(function(event)
			{
				_this.revealPanel();
				//event.stopPropagation();
			})
			.click(function(event)
			{
				//event.stopPropagation();
			})
			.on('input', function(event)
			{
				_this.filterPool();
				_this.layoutPoolFlags();
				//event.stopPropagation();
			});
			
		stagesDiv = mainDiv.append('div')
			.classed('horizontal-overflow', true);
		this.stagesDiv = stagesDiv.node();
			
		var div = stagesDiv.append('div');
		
		var svgData = [{name: "All Tags", color: "#222", click: this.handleAllClick},
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
			.append('svg')
			.attr('xmlns', "http://www.w3.org/2000/svg")
			.attr('version', "1.1");
		svgs.append('circle')
			.attr('r', 16).attr('cx', 30).attr('cy', 23)
			.attr('fill', 'white');
		svgs.append('circle')
			.attr('r', 16).attr('cx', 30).attr('cy', 23).attr('opacity', 0.3)
			.attr('fill', function(d) { return d.color; });
		svgs.append('text')
			.classed('icon-label', true)
			.attr('x', 30).attr('y', 49)
			.attr('fill', '#777')
			.text(function(d) { return d.name; });
			
		svgs.on('click', function(d)
			{
				svgs.selectAll('circle:last-of-type')
					.attr('opacity', 0.3);
				d3.select(this).selectAll('circle:last-of-type')
					.attr('opacity', 0.8);
				svgs.selectAll('text')
					.style('fill', '#777');
				d3.select(this).selectAll('text')
					.style('fill', d.color);
					
				/* Set the focus here so that the keyboard disappears on mobile devices. */
				$(this).focus();
				if (d.click)
				{
					_this.selectedPool = d;
					d.click.call(_this);
				}
			});
			
		div.select('svg:first-child')
			.selectAll('circle:last-of-type')
			.attr('opacity', 0.8);
		div.select('svg:first-child')
			.selectAll('text')
			.style('fill', function(d) { return d.color; });
		this.selectedPool = svgData[0];
		
		this.poolContainer = this.mainDiv.append('div')
			.classed('pool-container', true);
				
		this.poolFlags = this.poolContainer.append('svg')
			.classed('flags', true);
			
		this.queryContainer = this.mainDiv.append('div')
			.classed('query-container', true);
			
		this.queryHelp = this.queryContainer.append('span')
			.text('Tap tags to find paths containing those tags.');
			
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
				_this.revealInput()
					.then(function()
						{
							_this._clearQuery();
						});
				
				event.stopPropagation();
			});
			
		function resizeContents()
		{
			if ($(_this.node()).position().top == 0)
			{
				_this.revealPanel(0);
			}
			else
				_this.revealInput(0);
		}
		
		$(mainDiv.node()).on("resize.cr", resizeContents);
		
		setTimeout(function()
			{
				_this.panelDiv.style('top', "{0}px".format($(window).height()));
				_this.panelDiv.style('display', 'block');
				_this.revealInput();

				_this.searchPathsResultsView = new SearchPathsResultsView(_this);
				
				crp.promise({path: "Service"})
					.done(function(services)
						{
							var s = services.map(function(e) { return new Service(e); });
			
							_this.appendPoolFlags(s);
							_this.filterColumn = undefined;
							_this.filterPool();
							_this.layoutPoolFlags();
						});
				$(mainDiv.node()).scroll(function() {
					_this.checkResultsScrolling();
					});
			});
			
		this.resultContainerNode = this.mainDiv.append('div')
			.classed('results-container', true)
			.node();
			
	}
	
	return SearchPathsPanel;
})();
