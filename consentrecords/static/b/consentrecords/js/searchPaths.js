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
				
				var screenName = d.getDatum(cr.fieldNames.name);
				var user = d.getValue(cr.fieldNames.user);
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
		
		if (prepareClick('click', 'search result path'))
		{
			showPath(d, this.searchPathsPanel.node())
				.then(function(panel)
					{
						$(panel.pathtree).on("userSet.cr", function()
							{
								var queryFlags = _this.searchPathsPanel.queryContainer.flags().data();
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
			path = 'Path';
			
			var qf = this.searchPathsPanel.getQueryFlags();
			if (!qf.length)
				return null;
			
			qf.forEach(function(sf)
				{
					if (sf.service)
						path += '["More Experience"[TagTarget={0}|Offering[TagTarget={0}]]]'.format(sf.service.getInstanceID());
				});
			return path;
		}
	}
	
	SearchPathsResultsView.prototype.appendSearchArea = function()
	{
		return d3.select(this.searchPathsPanel.resultContainerNode)
			.append('ol')
			.classed('hover-items search', true);
	}
	
	/* Overwrite this function to use a different set of fields for the getData or selectAll operation
		sent to the middle tier.
	 */
	SearchPathsResultsView.prototype.fields = function()
	{
		return ["parents", cr.fieldNames.user];
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

var SearchTagPoolView = (function () {
	SearchTagPoolView.prototype = new TagPoolView();
	
	SearchTagPoolView.prototype.sitePanel = null;
	
	SearchTagPoolView.prototype.setFlagVisibles = function()
	{
		var _this = this;
		var queryData = this.sitePanel.queryContainer.flags().data();
		
		function inQueryFlags(a)
		{
			return queryData.some(function(fd) { return fd.service == a.service; });
		}

		var filterFunction = this.sitePanel.filterColumn !== undefined ?
			function(fs) { fs.visible = (fs.getColumn() == _this.sitePanel.filterColumn) && !inQueryFlags(fs); } :
			function(fs) { fs.visible = !inQueryFlags(fs); };
			
		this.flags().each(filterFunction);
	}
	
	function SearchTagPoolView(sitePanel)
	{
		TagPoolView.call(this, sitePanel.mainDiv, 'pool-container');
		this.sitePanel = sitePanel;
	}
	
	return SearchTagPoolView;
})();

var SearchPathsPanel = (function () {
	SearchPathsPanel.prototype = new SitePanel();
	SearchPathsPanel.prototype.selectedPool = null;
	
	SearchPathsPanel.prototype.topBox = null;
	SearchPathsPanel.prototype.searchInput = null;
	SearchPathsPanel.prototype.cancelButton = null;
	SearchPathsPanel.prototype.topHandle = null;
	SearchPathsPanel.prototype.poolContainer = null;
	SearchPathsPanel.prototype.queryContainer = null;
	
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
		if (this.queryContainer.flags().selectAll('g').size() == 0)
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
		var queryBottom;
		var poolHeight;
		var poolWidth;
		var _this = this;

		if (this.queryContainer.flags().size() == 0)
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
		var queryContainerWidth;
		var animatePromise;
		
		poolHeight = $(window).height() - queryBottom - poolTop - poolVMargins -
					 this.queryFlagsHeight - parseInt($queryContainer.css('margin-bottom'));
		poolWidth = parentWidth - poolHMargins;
		queryContainerWidth = parentWidth - poolHMargins;
		
		resultsHeight = this.queryContainer.flags().size() && ($(window).height() - this.resultsTopMargin);
		
		return $.when($poolContainer.animate(
					{width: poolWidth, 
					 height: poolHeight},
					{duration: duration}).promise(),
/* 
			   $(this.queryContainer.svg.node()).animate(
			   		{
			   			width: queryContainerWidth,
			   			height: this.queryFlagsHeight - queryVPadding
			   		},
			   		{duration: duration}).promise(),
 */
			   $(this.resultContainerNode)
				.animate({height: resultsHeight},
						 {duration: duration})
				.promise(),
			/* Scroll the parentNode top to 0 so that the searchInput is sure to appear.
				This is important on iPhones where the soft keyboard appears and forces scrolling. */
			$(this.node().parentNode)
				.animate({scrollTop: 0},
						 {duration: duration})
				.promise())
		 .then(function()
			 	{
					_this.poolContainer.layoutFlags(queryContainerWidth, duration);
					_this.checkResultsScrolling();
				});
	}
	
	SearchPathsPanel.prototype.getNextQueryFlagPosition = function(sourceFlag)
	{
		var lastChild = this.queryContainer.svg.selectAll('g:last-child');
		if (lastChild.size() == 0)
			return {top: 0, left:0};
		else
		{
			var oldS = lastChild.datum();
			var nextRight = oldS.x + lastChild.node().getBBox().width + this.searchFlagHSpacing;
			if (nextRight + sourceFlag.getBBox().width 
				> $(this.queryContainer.svg.node()).width())
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
			return _this.queryContainer.flags().data()
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
		
		if (this.queryContainer.flags().size() == 1)
		{
			this.queryContainer.div.selectAll('span')
 				.interrupt().transition().duration(400)
				.style('opacity', 1.0);
			this.revealPanel();
		}

		return $(queryFlag).animate({opacity: 0.0})
			.promise()
			.done(function()
				{
					$(queryFlag).remove();
					_this.poolContainer.flags().data().find(function(s) { return s.service == service.service; })
						.visible = true;
						
					// _this.poolContainer.flags().sort(function(a, b) { return _this.comparePoolFlags(a, b); });
					
					_this.poolContainer.layoutFlags();
					_this.queryContainer.layoutFlags();
					
					var promise = null;
					if (_this.queryContainer.flags().size() == 0)
						promise = _this.revealPanel();
					else
					{
						promise = new $.Deferred();
						promise.resolve();
					}
							
		
					var f = function()
						{
							_this.enableResultsScrolling();
							_this.searchPathsResultsView.startSearchTimeout(_this.searchPathsResultsView.inputCompareText(), 0);
							_this.checkResultsScrolling();
						}
					/* Run a new search based on the query. */
					return promise.then(f);
					
				});
	}
	
	SearchPathsPanel.prototype._clearQuery = function()
	{
		var _this = this;
		$(this.queryContainer.svg.node()).children().remove();
		this.poolContainer.flags().sort(function(a, b) { return _this.comparePoolFlags(a, b); });
		
		this.poolContainer.layoutFlags();
		
		/* Show the help message in the query container */ 
		this.queryContainer.div.selectAll('span')
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
		
		var poolFlagsRect = this.poolContainer.svg.node().getBoundingClientRect();	
		travelSVG.style('left', poolFlagsRect.left + s.x)
			.style('top', poolFlagsRect.top + (s.y * this.emToPX));
 		
 		/* Create a new flag in the svg. */
 		var g = travelSVG.append('g')
 			.datum(s);
			
		this.poolContainer.appendFlag(g);
		
		/* Cover the old flag with a hole. */
		var rectHole = d3.select(poolFlag).append('rect').classed('hole', true)
			.attr('width', poolFlagRect.width)
			.attr('height', poolFlagRect.height);
 		
 		/* Figure out where travelSVG is going to end up relative to queryContainer.svg. */
 		var newPosition = this.queryContainer.svg.node().getBoundingClientRect();
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
					var queryFlag = _this.queryContainer.svg.append('g')
						.datum(newS)
						.on('click', function(fd) 
							{ 
								if (prepareClick('click', 'remove query flag: {0}'.format(fd.getDescription())))
								{
									_this.onQueryFlagClicked(this, fd)
										.done(unblockClick);
								} 
							})
						.attr('transform', 
						      function(fd) { return "translate({0},{1})".format(fd.x, fd.y * _this.emToPX); });
	
					_this.queryContainer.appendFlag(queryFlag);
					queryFlag.transition()
						.style('opacity', 1);
					
					var promise = null;
					if (_this.queryContainer.flags().size() == 1)
					{
						_this.queryContainer.div.selectAll('span')
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
 		
 		/* Hide the poolFlag. */
 		d3.select(poolFlag).datum().visible = false;
 		
 		/* Reset the positions of all of the pool flags. */
 		this.poolContainer.layoutFlags();
	}
	
	SearchPathsPanel.prototype.getQueryFlags = function()
	{
		return this.queryContainer.flags().data();
	}
	
	SearchPathsPanel.prototype.filterPool = function()
	{
		this.poolContainer.filterFlags(this.searchInput.value);
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
		this.poolContainer.layoutFlags();
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
		this.poolContainer.layoutFlags();
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
				if (prepareClick('focusin', 'searchInput'))
				{
					_this.revealPanel()
						.then(function()
							{
								_this.filterPool();
								_this.poolContainer.layoutFlags();
								unblockClick();
							});
				}
			})
			.click(function(event)
			{
				if ($(_this.node()).position().top == 0)
					event.stopPropagation();
			})
			.on('input', function(event)
			{
				_this.filterPool();
				_this.poolContainer.layoutFlags();
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
				if (prepareClick('click', 'category circle: {0}'.format(d.name)))
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
					unblockClick();
				}
			});
			
		div.select('svg:first-child')
			.selectAll('circle:last-of-type')
			.attr('opacity', 0.8);
		div.select('svg:first-child')
			.selectAll('text')
			.style('fill', function(d) { return d.color; });
		this.selectedPool = svgData[0];
		
		this.poolContainer = new SearchTagPoolView(this);
			
		this.queryContainer = new TagPoolView(this.mainDiv, 'query-container');
			
		this.queryHelp = this.queryContainer.div.append('span')
			.text('Tap tags to find paths containing those tags.');
		
		$(this.topBox).click(function(event)
			{
				if ($(_this.node()).position().top == 0)
				{
					_this.revealInput();
				}
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
			
							_this.poolContainer.appendFlags(s)
								 .on('click', function(s)
									{
										if (s.visible === undefined || s.visible)
										{
											if (prepareClick('click', 'add query flag: {0}'.format(s.getDescription())))
											{
												_this.addFlagToQuery(this, s);
												unblockClick();
											}
										}
									});

							_this.filterColumn = undefined;
							_this.filterPool();
							_this.poolContainer.layoutFlags();
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
