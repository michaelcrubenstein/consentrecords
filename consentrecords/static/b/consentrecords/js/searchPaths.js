var SearchPathsResultsView = (function () {
	SearchPathsResultsView.prototype = Object.create(SearchOptionsView.prototype);
	SearchPathsResultsView.prototype.constructor = SearchPathsResultsView;

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
	
	SearchPathsResultsView.prototype.fillItems = function(buttons)
	{
		var _this = this;
		
		buttons.each(function(d)
			{
				var leftText = d3.select(this);
				
				var screenName = d.name();
				var user = d.user();
				var userName = user && user.fullName();
				var userDescription = user && user.description();
				var ageDescription = d.birthday() && new AgeCalculator(d.birthday()).toString();			
				
				if (screenName) leftText.append('div').text(screenName);
				if (userName && userName != screenName) leftText.append('div').text(userName);
				/* Only include the email address if there is no userName or screenName */
				if (userDescription && !userName && !screenName) leftText.append('div').text(userDescription);
				if (d.birthday())
					leftText.append('div').text(ageDescription);
			});
	}
	
	SearchPathsResultsView.prototype.containsQuery = function(fc, queryFlags) {
		var offering = fc.experience.offering();
		if (offering && offering.id())
		{
			var services = offering.offeringServices();
			/* services may be null if the experience references an offering in an
				organization that isn't public. This typically occurs in testing
				when the organization wasn't made public.
			 */
			if (services && services.findIndex(function(s)
				{
					return queryFlags.findIndex(function(qf)
						{
							return s.service().serviceImplications().findIndex(function(s2)
								{
									return qf.service.id() == s2.service().id();
								}) >= 0;
						}) >= 0;
				}) >= 0)
				return true;
		}
		
		if (fc.experience instanceof cr.Experience)
		{
			var services = fc.experience.experienceServices();
			if (services)
			{
				if (services.findIndex(function(s) {
						return queryFlags.findIndex(function(qf)
						{
							return s.service().serviceImplications().findIndex(function(s2)
								{
									return qf.service.id() == s2.service().id();
								}) >= 0;
						}) >= 0;
					}) >= 0)
					return true;
			}
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
								var queryFlags = _this.searchPathsPanel.queryTagPoolView.flags().data();
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
		return "No Results";
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
			path = 'path';
			
			var qf = this.searchPathsPanel.getQueryFlags();
			if (!qf.length)
				return null;
			
			qf.forEach(function(sf)
				{
					if (sf.service)
						path += '[experience>implication>service={0}]'.format(sf.service.id());
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
		return ['parents', 'user'];
	}
	
	SearchPathsResultsView.prototype.resultType = function()
	{
		return cr.Path;
	}
	
	function SearchPathsResultsView(sectionView, searchPathsPanel)
	{
		console.assert(sectionView);
		console.assert(searchPathsPanel);

		var _this = this;

		this.searchPathsPanel = searchPathsPanel;
		SearchOptionsView.call(this, sectionView);

		this.inputBox = searchPathsPanel.searchInput;
	}
	
	return SearchPathsResultsView;
})();

var SearchTagPoolView = (function () {
	SearchTagPoolView.prototype = Object.create(TagPoolView.prototype);
	SearchTagPoolView.prototype.constructor = SearchTagPoolView;

	SearchTagPoolView.prototype.sitePanel = null;
	
	SearchTagPoolView.prototype.setFlagVisibles = function(inputNode)
	{
		var _this = this;
		var queryData = this.sitePanel.queryTagPoolView.flags().data();
		
		/* inQueryFlags returns true if the specified flag is already part of the query data. */
		function inQueryFlags(a)
		{
			return queryData.some(function(fd) { return fd.service == a.service; });
		}
		
		var myTags = [];
		if (this.sitePanel.filterColumn === undefined)
		{
			cr.signedinUser.path().experiences().forEach(function(e)
				{
					e.experienceServices().forEach(function(es)
						{
							es.service().serviceImplications().forEach(function(si)
								{
									if (myTags.indexOf(si.service()) < 0)
										myTags.push(si.service());
								});
						});
				});
		}
		function inMyFlags(a)
		{
			if (inQueryFlags(a))
				a.visible = false;
			else if (myTags.length > 0 && myTags.indexOf(a.service) < 0)
				a.visible = false;
			else
				a.visible = true;
		}

		var filterFunction = this.sitePanel.filterColumn !== undefined ?
			function(fs) { fs.visible = (fs.getColumn() == _this.sitePanel.filterColumn) && !inQueryFlags(fs); } :
			inMyFlags;
			
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
	SearchPathsPanel.prototype = Object.create(crv.SitePanel.prototype);
	SearchPathsPanel.prototype.constructor = SearchPathsPanel;

	SearchPathsPanel.prototype.selectedPool = null;
	
	SearchPathsPanel.prototype.topBox = null;
	SearchPathsPanel.prototype.searchInput = null;
	SearchPathsPanel.prototype.cancelButton = null;
	SearchPathsPanel.prototype.poolContainer = null;
	SearchPathsPanel.prototype.queryTagPoolView = null;
	
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
						 
		$(this.searchInput).css('display', '');
		$(this.cancelButton).css('display', '');
		$(this.searchInput).animate({width: inputWidth,
									 "margin-right": 0},
							   {duration: duration});
		$(this.cancelButton).animate({left: inputWidth + inputMarginLeft,
									  opacity: 1.0},
							   {duration: duration});
							   
		var poolTop = $(this.topBox).outerHeight(true) + $(this.stagesDiv).outerHeight(true);				   
		
		this.mainDiv.classed('vertical-scrolling', true)
			.classed('no-scrolling', false);

		var resultsHeight;
		var queryBottom;
		var poolHeight;
		var poolWidth;
		var _this = this;

		/* queryBottom is the height of the space between the bottom of the query container and
			the bottom of the window when scrollTop is 0. This space is used to display a little bit
			of the results (two items).
		 */
		if (this.queryTagPoolView.flags().size() == 0)
			queryBottom = 0;
		else
			queryBottom = 100;
			
		var $poolContainer = $(this.poolContainer.node());
		var $queryContainer = $(this.queryContainer.node());
			
		var poolVMargins = $poolContainer.outerHeight(true) - $poolContainer.outerHeight(false);
		var poolHMargins = $poolContainer.outerWidth(true) - $poolContainer.innerWidth();
		var queryContainerWidth;
		
		poolHeight = $(window).height() - poolTop - poolVMargins -
					$queryContainer.outerHeight(true) - queryBottom;
		poolWidth = parentWidth - poolHMargins;
		queryContainerWidth = parentWidth - poolHMargins;
		
		resultsHeight = this.queryTagPoolView.flags().size() && ($(window).height() - this.resultsTopMargin);
		
		if ($(this.resultContainerNode).height() < queryBottom &&
			resultsHeight >= queryBottom)
			$(this.resultContainerNode).height(queryBottom);
		
		return $.when($poolContainer.animate(
					{width: poolWidth, 
					 height: poolHeight},
					{duration: duration}).promise(),
					/* Scroll the parentNode top to 0 so that the searchInput is sure to appear.
						This is important on iPhones where the soft keyboard appears and forces scrolling. */
					$(this.node().parentNode)
						.animate({scrollTop: 0},
								 {duration: duration})
						.promise())
			.then(function()
				{
					return $(_this.resultContainerNode)
						.animate({height: resultsHeight},
								 {duration: duration})
						.promise();
				})
		 	.then(function()
			 	{
					_this.poolContainer.layoutFlags(queryContainerWidth, duration);
					_this.checkResultsScrolling();
				});
	}
	
	SearchPathsPanel.prototype.getNextQueryFlagPosition = function(sourceFlag)
	{
		var lastChild = this.queryTagPoolView.flagsContainer.selectAll('span:last-child');
		if (lastChild.size() == 0)
			return {top: 0, left:0};
		else
		{
			var oldS = lastChild.datum();
			var nextRight = oldS.x + lastChild.node().getBoundingClientRect().width + this.searchFlagHSpacing;
			if (nextRight + sourceFlag.getBoundingClientRect().width 
				> $(this.queryTagPoolView.node()).width())
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
			return _this.queryTagPoolView.flags().data()
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
			aDesc = a.service.description();
			bDesc = b.service.description();
			return aDesc.localeCompare(bDesc);
		}
	}
	
	SearchPathsPanel.prototype.onQueryFlagClicked = function(queryFlag, service)
	{
		var _this = this;
		
		if (this.queryTagPoolView.flags().size() == 1)
		{
			this.queryHelp
 				.interrupt().transition().duration(400)
				.style('opacity', 1.0);
		}

		return $(queryFlag).animate({opacity: 0.0})
			.promise()
			.done(function()
				{
					$(queryFlag).remove();
					_this.poolContainer.flags().data().find(function(s) { return s.service == service.service; })
						.visible = true;
						
					_this.poolContainer.layoutFlags();
					_this.queryTagPoolView.layoutFlags();
					
					var promise = null;
					if (_this.queryTagPoolView.flags().size() == 0)
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
		$(this.queryTagPoolView.node()).children().remove();
		this.poolContainer.flags().sort(function(a, b) { return _this.comparePoolFlags(a, b); });
		
		this.poolContainer.layoutFlags();
		
		/* Show the help message in the query container */ 
		this.queryTagPoolView.flagsContainer.selectAll('span')
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
		var travelContainer = this.mainDiv.append('div')
			.classed('travel flags', true);
		
		/* Set the svg dimensions to the same as the flag. */
		var poolFlagRect = poolFlag.getBoundingClientRect();
		$(travelContainer.node()).width(poolFlagRect.width)
			.height(poolFlagRect.height)
			.css('left', poolFlagRect.left)
			.css('top', poolFlagRect.top);
		
 		/* Create a new flag in the svg. */
 		var g = travelContainer.append('span')
 			.datum(s);
			
		this.poolContainer.appendFlag(g);
		g.style('opacity', 1)
			.style('display', '');
		
		/* Cover the old flag with a hole. */
		d3.select(poolFlag).classed('hole', true)
			.style('border-left-color', null)
			.style('background-color', null)
			.style('color', null);
 		
 		/* Figure out where travelSVG is going to end up relative to queryTagPoolView.flagsContainer. */
 		var newPosition = this.queryTagPoolView.flagsContainer.node().getBoundingClientRect();
 		var flagPosition = this.getNextQueryFlagPosition(poolFlag);
 		
 		var _this = this;
 		/* Animate the movement of the svg to its new location. */
 		$(travelContainer.node()).animate({top: newPosition.top + flagPosition.top,
 			left: newPosition.left + flagPosition.left},
 			{duration: 400, complete: function()
 				{
					/* Reset the positions of all of the pool flags. */
					_this.poolContainer.layoutFlags()
						.then(function()
							{
								/* Dispose of the hole. */
								d3.select(poolFlag).classed('hole', false)
									.each(function(d)
										{
											PathGuides.fillNode(this, d.getColumn());
										});
							});
					
					/* Add a query flag that is the same as the svg flag in the same position. */
					var newS = new ServiceFlagController(s.service);
					newS.x = flagPosition.left;
					newS.y = flagPosition.top / _this.emToPX;
					var queryFlag = _this.queryTagPoolView.flagsContainer.append('span')
						.datum(newS)
						.on('click', function(fd) 
							{ 
								if (prepareClick('click', 'remove query flag: {0}'.format(fd.description())))
								{
									_this.onQueryFlagClicked(this, fd)
										.done(unblockClick);
								} 
							});
	
					_this.queryTagPoolView.appendFlag(queryFlag);
					$(queryFlag.node()).css(flagPosition)
						.css('display', '');	/* Set the top and the left simultaneously. */
					queryFlag.transition()
						.style('opacity', 1);
					
					var promise = null;
					if (_this.queryTagPoolView.flags().size() == 1)
					{
						_this.queryHelp
 							.interrupt().transition().duration(400)
							.style('opacity', 0.0);
						promise = _this.revealPanel();
					}
					
					/* Dispose of the travelSVG. */
					travelContainer.remove();
							
					/* Run a new search based on the query. */
					_this.enableResultsScrolling();
					_this.searchPathsResultsView.startSearchTimeout(_this.searchPathsResultsView.inputCompareText(), 0);
					var f = function()
					{
						_this.checkResultsScrolling();
					}
					if (promise)
						promise.then(f);
					else
						f();
 				}});
 		
 		/* Hide the poolFlag. */
 		d3.select(poolFlag).datum().visible = false;
	}
	
	SearchPathsPanel.prototype.getQueryFlags = function()
	{
		return this.queryTagPoolView.flags().data();
	}
	
	SearchPathsPanel.prototype.filterPool = function()
	{
		this.poolContainer.filterFlags(this.searchInput);
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
		ServiceFlagController.controllersPromise()
			.done(function(services)
				{
					_this.handleColumnClick(services, 1);
				});
	}
	
	SearchPathsPanel.prototype.handleInterestsClick = function()
	{
		var _this = this;
		ServiceFlagController.controllersPromise()
			.done(function(services)
				{
					_this.handleColumnClick(services, 2);
				});
	}
	
	SearchPathsPanel.prototype.handleCareerClick = function()
	{
		var _this = this;
		ServiceFlagController.controllersPromise()
			.done(function(services)
				{
					_this.handleColumnClick(services, 3);
				});
	}
	
	SearchPathsPanel.prototype.skillsClick = function()
	{
		var _this = this;
		ServiceFlagController.controllersPromise()
			.done(function(services)
				{
					_this.handleColumnClick(services, 4);
				});
	}
	
	SearchPathsPanel.prototype.givingBackClick = function()
	{
		var _this = this;
		ServiceFlagController.controllersPromise()
			.done(function(services)
				{
					_this.handleColumnClick(services, 5);
				});
	}
	
	SearchPathsPanel.prototype.housingClick = function()
	{
		var _this = this;
		ServiceFlagController.controllersPromise()
			.done(function(services)
				{
					_this.handleColumnClick(services, 0);
				});
	}
	
	SearchPathsPanel.prototype.wellnessClick = function()
	{
		var _this = this;
		ServiceFlagController.controllersPromise()
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
				handleResize();
			});
			
		this.createRoot(null, "Search Paths", "search-paths", revealPanelUp);
		
		var mainDiv = this.appendScrollArea();
		
		var topBox = mainDiv.append('div');
		this.topBox = topBox.node();
			
		this.searchInput = topBox.append('input')
			.attr('placeholder', 'Search for a path')
			.node();
			
		this.cancelButton = topBox.append('button')
			.classed('cancel', true)
			.text(crv.buttonTexts.done)
			.style('display', 'none')
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
				try
				{
					_this.filterPool();
					_this.poolContainer.layoutFlags();
				}
				catch (err) { cr.asyncFail(err); }
				//event.stopPropagation();
			});
			
		stagesDiv = mainDiv.append('div')
			.classed('horizontal-overflow', true);
		this.stagesDiv = stagesDiv.node();
			
		var div = stagesDiv.append('div');
		
		var svgData = [{name: "My Tags", color: "#222", click: this.handleAllClick},
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
		
		/* poolContainer is the tag pool that users can click to fill the queryTagPoolView. */
		this.poolContainer = new SearchTagPoolView(this);
		
		this.queryContainer = this.mainDiv.append('div')
			.classed('query-container', true);

		/* queryTagPoolView is the tag pool that is used as search criteria. */
		this.queryTagPoolView = new TagPoolView(this.queryContainer, 'query-tag-pool');
			
		this.queryHelp = this.queryContainer.append('span')
			.text('Tap tags to find paths containing those tags.');
		
		$(this.cancelButton).click(function(event)
			{
				_this.hide();				
				event.stopPropagation();
			});
			
		function handleResize()
		{
			_this.revealPanel(0);
		}
		
		$(mainDiv.node()).on('resize.cr', handleResize);
		
		this.sectionView = new crv.SectionView(this)
			.classed('results-container', true);
		this.resultContainerNode = this.sectionView.node();

		setTimeout(function()
			{
				_this.panelDiv.style('top', '{0}px'.format($(window).height()));
				_this.panelDiv.style('display', 'block');

				_this.searchPathsResultsView = new SearchPathsResultsView(_this.sectionView, _this);
				
				ServiceFlagController.controllersPromise()
					.done(function(services, controllers)
						{
							_this.poolContainer.appendFlags(controllers)
								 .on('click', function(s)
									{
										if (s.visible === undefined || s.visible)
										{
											if (prepareClick('click', 'add query flag: {0}'.format(s.description())))
											{
												_this.addFlagToQuery(this, s);
												unblockClick();
											}
										}
									});

							_this.filterColumn = undefined;
							_this.filterPool();
							_this.poolContainer.layoutFlags(undefined, 0);
						});
				$(mainDiv.node()).scroll(function() {
					_this.checkResultsScrolling();
					});
			});
	}
	
	return SearchPathsPanel;
})();
