var DotsNavigator = (function () {
	DotsNavigator.prototype.div = null;
	DotsNavigator.prototype.panels = null;
	DotsNavigator.prototype.doneButton = null;
	DotsNavigator.prototype.backButton = null;
	DotsNavigator.prototype.count = 0;
	DotsNavigator.prototype.value = 0;
	DotsNavigator.prototype.done = null;
	DotsNavigator.prototype.finalText = "Add";
	DotsNavigator.prototype.services = [];
	DotsNavigator.prototype.datum = null;
	DotsNavigator.prototype.sitePanel = null;
	
	/* Dots are followed by a set of panels, which can have the following functions:
		onReveal: called each time the panel is revealed. Typically this is used
				  to initialize the panel contents and then set to either null or a 
				  different function for subsequent reveals.
		onGoingForward: called when the panel is completed and the user clicks the 
				  Next or Add button.
		onCheckForwardEnabled: called to determine whether or not the go forward button
				  is enabled for each panel.
	 */
	
	DotsNavigator.prototype.setValue = function(newValue) {
		var oldValue = this.value;
	
		var p = this.nthPanel(oldValue);
		if (p.onDoneClicked)
			p.onDoneClicked();
		
		this.value = newValue;
		var li = this.div.selectAll("ol > li");
		li.classed("active", function(d, i) { return i == newValue; });
	
		if (newValue > 0)
			this.backButton.selectAll("span").text("Back");
		else
			this.backButton.selectAll("span").text("Cancel");
	
		if (newValue < this.count - 1)
			this.doneButton.selectAll("span").text("Next");
		else
			this.doneButton.selectAll("span").text(this.finalText);
		
		p = this.nthPanel(newValue);
		if (p.onReveal)
			p.onReveal.call(p, this.datum);
			
		this.checkForwardEnabled();
	
		var containerWidth = $(this.div.node()).parent().width();
	
		if (oldValue < newValue)
		{
			while (oldValue < newValue)
			{
				var p = $(this.nthPanel(oldValue));
				p.animate({left: -containerWidth}, 700, "swing");
				++oldValue;
			}
			$(this.nthPanel(newValue))
				.animate({left: 0}, 700, "swing");
		}
		else if (oldValue > newValue)
		{
			while (oldValue > newValue)
			{
				var p = $(this.nthPanel(oldValue));
				p.animate({left: containerWidth}, 700, "swing");
				--oldValue;
			}
			$(this.nthPanel(newValue))
				.animate({left: 0}, 700, "swing");
		}
	}

	DotsNavigator.prototype.nthPanel = function(n) {
		return this.panels[0][n];
	}
	
	DotsNavigator.prototype.showDots = function() {
		this.checkForwardEnabled();
// 		$(this.div.node()).animate({bottom: "30px"}, 400, "swing",
// 						function() {
// 						});

	}
	
	DotsNavigator.prototype.getServiceByName = function(name)
	{
		for (i = 0; i < services.length; ++i)
		{
			if (services[i].getDescription() == name)
				return services[i];
		}
		return null;
	}
	
	DotsNavigator.prototype.appendBackButton = function(navContainer)
	{
		var _this = this;
		this.backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick())
				{
					showClickFeedback(this);
					if (_this.value > 0)
					{
						_this.setValue(_this.value - 1);
						unblockClick();
					}
					else
						hidePanelDown($(this).parents(".site-panel")[0]);
				}
				d3.event.preventDefault();
			});
		this.backButton.append("span").text("Cancel");
	}
	
	DotsNavigator.prototype.goForward = function()
	{
		var _this = this;
		var gotoNext = function()
		{
			if (_this.value == _this.count - 1)
				_this.done();
			else
			{
				_this.setValue(_this.value + 1);
				unblockClick();
			}
		}
		if (prepareClick())
		{
			if (this.isForwardEnabled())
			{
				showClickFeedback(this.doneButton.node());
			
				var p = this.nthPanel(this.value);
				if (p.onGoingForward)
					p.onGoingForward(gotoNext);
				else
					gotoNext();
			}
			else
				unblockClick();
		}
	}
	
	DotsNavigator.prototype.appendForwardButton = function(navContainer, done)
	{
		var _this = this;
		this.done = done;
		
		this.doneButton = navContainer.appendRightButton();
		this.doneButton.append("span").text("Next");
		this.doneButton.on("click", function(d) {
			_this.goForward();
			d3.event.preventDefault();
		});
	}
	
	DotsNavigator.prototype.isForwardEnabled = function()
	{
		var p = this.nthPanel(this.value);
		return (p.onCheckForwardEnabled === undefined ||
						 p.onCheckForwardEnabled());
	}
	
	/* This method is called from within a panel when its content changes to determine
		whether or not the go forward button is enabled. A panel that calls this method
		should define a onCheckForwardEnabled function. 
	 */
	DotsNavigator.prototype.checkForwardEnabled = function()
	{
		var isEnabled = this.isForwardEnabled();
		this.doneButton
			.classed("site-disabled-text", !isEnabled)
			.classed("site-active-text", isEnabled);
	}
	
	function DotsNavigator(panel2Div, sitePanel, numDots) {
		/* By default, the data is the dots object itself for backward compatibility.
		 */
		this.datum = this;
		this.sitePanel = sitePanel;
		
		var dotIndexes = [];
		for (var i = 0; i < numDots; i++)
			dotIndexes.push(i);
	
		this.div = panel2Div.append('div')
			.classed('dots', true);
		var ol = this.div.append('div').append('ol');

		var li = ol.selectAll('li')
			.data(dotIndexes)
			.enter()
			.append('li')
			.classed("active", function(d, i) { return i == 0; });
			
		this.panels = panel2Div.selectAll('panel')
			.data(dotIndexes)
			.enter()
			.append('panel');

		this.count = numDots;
		this.value = 0;
	
		this.services = [];
		this.doneButton = null;
		this.backButton = null;
	
		var _this = this;
		function layoutPanels()
		{
			var containerWidth = $(_this.div.node()).parent().width();
			_this.panels.each(function(d, i)
			{
				if (i < _this.value)
					$(this).offset({left: -containerWidth});
				else if (i == _this.value)
					$(this).offset({left: 0});
				else
					$(this).offset({left: containerWidth});
			});
		}
	
		$(window).on("resize", layoutPanels);
		sitePanel.panelDiv.on("hiding.cr", function()
		{
			$(window).off("resize", layoutPanels);
		});
	}
	
	return DotsNavigator;
})();

function hidePathway() {
	var container = d3.select(this);
	container.selectAll('svg').remove();
}
	
function setColorByService(service)
{
	var _this = this;
	crp.pushID(service.getValueID(),
		function(serviceInstance)
		{
			var serviceDomain = serviceInstance.getValue("Service Domain");
			if (serviceDomain && serviceDomain.getValueID())
			{
				crp.pushID(serviceDomain.getValueID(),
					function(sdInstance) 
					{
						color = sdInstance.getValue("Color");
						if (color && color.value)
							_this.attr("fill", color.value)
								 .attr("stroke", color.value);
					},
					asyncFailFunction);
			}
			else
				_this.attr("fill", otherColor)
					.attr("stroke", otherColor);
		},
		asyncFailFunction);
}

function setColor(experience)
{
	var _this = d3.select(this);

	var offering = experience.getValue("Offering");
	if (offering && offering.getValueID())
	{
		var experienceColor = otherColor;
		crp.pushCheckCells(offering, function()
		{
			var service = offering.getValue("Service");
			if (service)
				setColorByService.call(_this, service);
			else
				_this.attr("fill", otherColor)
					 .attr("stroke", otherColor);
		},
		asyncFailFunction);
	}
	else
	{
		var service = experience.getValue("Service");
		if (service)
			setColorByService.call(_this, service);
		else
			_this.attr("fill", otherColor)
				 .attr("stroke", otherColor);
	}
}

var Pathway = (function () {
	Pathway.prototype.dataTopMargin = 5;
	Pathway.prototype.dataBottomMargin = 5;
	Pathway.prototype.dataLeftMargin = 40;
	Pathway.prototype.trunkWidth = 5;
	Pathway.prototype.trunkSpacing = 5;
	Pathway.prototype.trunkColumnWidth = 10; /* trunkWidth + trunkSpacing; */
	Pathway.prototype.textLeftMargin = 10;
	Pathway.prototype.textRightMargin = 10;
	Pathway.prototype.textBottomBorder = 3;
	Pathway.prototype.flagsLeftMargin = 14;
	Pathway.prototype.flagsRightMargin = 14;
	Pathway.prototype.flagSpacing = 5;
	Pathway.prototype.stemHeight = 3;
	Pathway.prototype.otherColor = "#bbbbbb";
	Pathway.prototype.textDetailLeftMargin = 10; /* textLeftMargin; */
	Pathway.prototype.textDetailRightMargin = 10; /* textRightMargin; */
	Pathway.prototype.detailTextSpacing = 2;		/* The space between lines of text in the detail box. */
	Pathway.prototype.pathBackground = "white";
	Pathway.prototype.showDetailIconWidth = 18;
	
	Pathway.prototype.userInstance = null;
	Pathway.prototype.allExperiences = [];
	Pathway.prototype.flagColumns = [];
	Pathway.prototype.sitePanel = null;
	Pathway.prototype.containerDiv = null;
	Pathway.prototype.svg = null;
	Pathway.prototype.defs = null;
	Pathway.prototype.bg = null;
	Pathway.prototype.loadingText = null;
	Pathway.prototype.promptAddText = null;
	Pathway.prototype.experienceGroup = null;
	Pathway.prototype.yearGroup = null;
	Pathway.prototype.detailGroup = null;
	
	Pathway.prototype.flagDown = false;
	Pathway.prototype.flagHeight = 0;
	Pathway.prototype.flagWidth = 0;
	
	Pathway.prototype.minDate = null;
	Pathway.prototype.maxDate = null;
	Pathway.prototype.timespan = 0;
	Pathway.prototype.dataHeight = 0;
	Pathway.prototype.dayHeight = 0;
	Pathway.prototype.years = [];
	
	//This is the accessor function we talked about above
	Pathway.prototype._lineFunction = d3.svg.line()
		.x(function(d) { return d.x; })
		.y(function(d) { return d.y; })
		.interpolate("linear");

	Pathway.prototype._compareExperiences = function(a, b)
	{
		var aStartDate = getStartDate(a);
		var bStartDate = getStartDate(b);
		if (aStartDate > bStartDate) return 1;
		else if (aStartDate < bStartDate) return -1;
		else
		{
			var aEndDate = getEndDate(a);
			var bEndDate = getEndDate(b);
			if (aEndDate > bEndDate) return 1;
			else if (aEndDate < bEndDate) return -1;
			else return 0;
		}
		return aStartDate - bStartDate;
	}

	Pathway.prototype.DateToY = function(d)
	{
		var daySpan = (new TimeSpan(d-this.minDate)).days;
		return this.dataTopMargin + (this.timespan - daySpan) * this.dayHeight;
	}

	Pathway.prototype.getExperienceHeight = function(experience)
	{
		var startDate = getStartDate(experience);
		var endDate = getEndDate(experience);
		var days = (new TimeSpan(Date.parse(endDate)-Date.parse(startDate))).days;
		return days * this.dayHeight;
	}

	Pathway.prototype.getExperiencePath = function(g, experience)
	{
		var flagX = parseFloat(g.getAttribute("flagX"));
		var h = this.getExperienceHeight(experience);
		var x1 = 0;
		var x2 = x1 + flagX + this.flagWidth;
		var x3 = x1 + flagX;
		var x4 = x1 + this.trunkWidth;
		var y1 = 0;
		var y2 = y1 + this.flagHeight;
		var y3;
		if (h < this.stemHeight)
			y3 = y1 + h;
		else
			y3 = y1 + this.stemHeight;
		var y4 = y1 + h;
		return this._lineFunction([{x: x1, y: y1}, 
							 {x: x2, y: y1}, 
							 {x: x2, y: y2}, 
							 {x: x3, y: y2}, 
							 {x: x3, y: y3}, 
							 {x: x4, y: y3}, 
							 {x: x4, y: y4}, 
							 {x: x1, y: y4}, 
							 {x: x1, y: y1}]);
	}

	Pathway.prototype.layoutExperiences = function()
	{
		var container = $(this.containerDiv);
		
		var containerHeight = container.height();
		var containerWidth = container.width();
		
		/* Calculate the height of the area where data appears and the height of a single day. */
		this.dataHeight = containerHeight - this.dataTopMargin - this.dataBottomMargin;
		this.dayHeight = this.dataHeight / this.timespan;
	
		var columns = [];
		this.flagColumns = [];
		var g = this.experienceGroup.selectAll('g');
		var y = this.yearGroup.selectAll('text');
		
		var _thisPathway = this;
	
		function getExperienceY (experience, i)
		{
			return _thisPathway.DateToY(Date.parse(getEndDate(experience)));
		}

		function addToBestColumn(g, maxHeight, columns)
		{
			var j;
			for (j = 0; j < columns.length; ++j)
			{
				// If this item's height + y is greater than the last item,
				// then add this to the column.
				var column = columns[j];
				var lastTop = parseFloat(column[column.length - 1].getAttribute("y"));
				if (lastTop > maxHeight)
				{
					column.push(g);
					break;
				}
			}
			if (j == columns.length)
			{
				columns.push([g]);
			}
		}
		
		function addToFlagColumns(d, flagColumns, flagHeight)
		{
			var thisTop = parseFloat(this.getAttribute("y"));
			var maxHeight = thisTop + flagHeight;
			var j;
			for (j = 0; j < flagColumns.length; ++j)
			{
				// If this item's height + y is greater than the last item,
				// then add this to the column.
				var column = flagColumns[j];
				var lastTop = parseFloat(column[column.length - 1].getAttribute("y"));
				if (lastTop > maxHeight)
				{
					column.push(this);
					break;
				}
				else
				{
					var i;
					var isInserted = false;
					for (i = column.length - 1; i > 0; ++i)
					{
						var aboveFlag = column[i];
						var belowFlag = column[i-1];
						var aboveTop = parseFloat(aboveFlag.getAttribute("y"));
						var belowTop = parseFloat(belowFlag.getAttribute("y"));
						if (thisTop > aboveTop + flagHeight &&
							thisTop < belowTop)
						{
							for (var k = column.length; k > i; --k)
								column[k] = column[k-1];
							column[i] = this;
							isInserted = true;
							break;
						}
						else if (thisTop < aboveTop + flagHeight)
							break;
					}
					if (isInserted)
						break;
				}
			}
			if (j == flagColumns.length)
			{
				flagColumns.push([this]);
			}
		};
	
		/* Compute the y attribute for every item */
		g.attr("y", getExperienceY);
		
		/* Fit each item to a column, according to the best layout. */	
		g.each(function(e, i)
			{
				var thisTop = parseFloat(this.getAttribute("y"));
				var maxHeight = thisTop + _thisPathway.getExperienceHeight(e);
				addToBestColumn(this, maxHeight, columns);
			});
		
		/* Compute the x attribute for every item */
		for (var j = 0; j < columns.length; ++j)
		{
			var x = this.dataLeftMargin + (this.trunkColumnWidth * j);
			var column = columns[j];
			for (var i = 0; i < column.length; ++i)
			{
				column[i].setAttribute("x", x);
			}
		}
	
		var flagsLeft = this.dataLeftMargin + (this.trunkColumnWidth * columns.length) + this.flagsLeftMargin;
	
		g.each(function(d) {
			addToFlagColumns.call(this, d, _thisPathway.flagColumns, _thisPathway.flagHeight);
		});

		/* Compute the column width for each column of flags + spacing to its right. 
			Add flagSpacing before dividing so that the rightmost column doesn't need spacing to its right.
		 */
		var flagColumnWidth = (containerWidth - flagsLeft - this.flagsRightMargin + this.flagSpacing) / this.flagColumns.length;
		this.flagWidth = flagColumnWidth - this.flagSpacing;
		var textWidth = this.flagWidth - this.textLeftMargin - this.textRightMargin;
		if (textWidth < 0)
			textWidth = 0;
		
		g.attr("transform", 
			function(d)
			{
				return "translate(" + this.getAttribute("x") + "," + this.getAttribute("y") + ")";
			});
		
		if (this.flagColumns.length > 0)
		{
			this.defs.selectAll('clipPath').remove();
			/* Add a clipPath for the text box size. */
			this.defs.append('clipPath')
				.attr('id', 'id_clipPath')
				.append('rect')
				.attr('x', 0)
				.attr('y', 0)
				.attr('height', this.flagHeight)
				.attr('width', textWidth);
			this.defs.append('clipPath')
				.attr('id', 'id_detailClipPath')
				.append('rect');
			this.defs.append('clipPath')
				.attr('id', 'id_detailIconClipPath')
				.append('rect');

			/* Calculate the x offset of the flag for each group */
			for (var j = 0; j < this.flagColumns.length; ++j)
			{
				var flagLeft = flagsLeft + (flagColumnWidth * j);
				var column = this.flagColumns[j];
				d3.selectAll(column).attr("flagX", function(d) {
						return flagLeft - parseFloat(this.getAttribute("x"));
					});
			}
		
			/* Transform each text node relative to its containing group. */
			g.selectAll('text').attr("transform",
				function(d)
				{
					var g = this.parentNode;
					var flagX = parseFloat(g.getAttribute("flagX"));
					return "translate(" + (flagX + _thisPathway.textLeftMargin).toString() + ", 0)";
				});
			
			/* Calculate the path for each containing group. */
			g.selectAll('path').attr("d", function(experience) {
					return _thisPathway.getExperiencePath(this.parentNode, experience);
				});
		}

		y.attr("y", function(d) { 
				return _thisPathway.DateToY(new Date(d, 0, 0));
			});
			
		if (y.size() >= 2)
		{
			oldD0 = y[0][0];
			var thisHeight = oldD0.getBBox().height;
			var spacing = 365 * this.dayHeight;
			
			var yearPeriod = parseInt(thisHeight / spacing) + 1;
			if (yearPeriod == 1)
				y.attr("fill", null);
			else
			{
				// Set the target so that the latest year is always visible.
				var target = (y.size() - 1) % yearPeriod;
				y.attr("fill", function(d, i) { if (i % yearPeriod == target) return null; else return "transparent";});
			}
		}
	
		/* Hide the detail so that if detail is visible before a resize, it isn't left behind. */	
		this.hideDetail();
	}
	
	Pathway.prototype.setDateRange = function()
	{
		var birthday = this.userInstance.getValue("Birthday");
		if (birthday && birthday.value)
			this.minDate = new Date(birthday.value);
		else
			this.minDate = new Date();
		
		this.maxDate = new Date(1900, 1, 1);
		var _this = this;
		$(this.allExperiences).each(function()
			{
				var startDate = new Date(getStartDate(this));
				var endDate = new Date(getEndDate(this));
				if (_this.minDate > startDate)
					_this.minDate = startDate;
				if (_this.maxDate < endDate)
					_this.maxDate = endDate;
			});
			
		/* Make the timespan start on Jan. 1 of that year. */
		this.minDate.setUTCMonth(0);
		this.minDate.setUTCDate(1);
		
		if (this.maxDate < this.minDate)
		{
			/* Make sure that the maxDate is at least 365 days after the minDate, but no later than today. */
			this.maxDate = (new Date(this.minDate)).addDays(365);
			if (this.maxDate > new Date())
				this.maxDate = new Date();
		}
		
		/* Now make sure that the minimum date is at least a year before the maximum date. */
		var maxMinDate = (new Date(this.maxDate)).addDays(-365);
		if (this.minDate > maxMinDate)
			this.minDate = maxMinDate;
	
		this.timespan = new TimeSpan(this.maxDate - this.minDate).days;

		var minYear = this.minDate.getUTCFullYear();
		var maxYear = this.maxDate.getUTCFullYear();
		this.years = [];
		for (var y = minYear; y <= maxYear; ++y)
			this.years.push(y);

		/* create the set of text objects for each year. */
		this.yearGroup
			.selectAll('text')
			.data(this.years)
			.enter()
			.append('text')
			.text(function(d) { return d; })
			.attr("font", "sans-serif")
			.attr("font-size", "10px")
			.attr("x", this.textLeftMargin);
	}
	
	Pathway.prototype.checkDateRange = function(experience)
	{
		var oldMinDate = this.minDate;
		var oldMaxDate = this.maxDate;
		var oldMinYear = this.minDate.getUTCFullYear();	
		var oldMaxYear = this.maxDate.getUTCFullYear();	
		
		var startDate = new Date(getStartDate(experience));
		var endDate = new Date(getEndDate(experience));
		if (this.minDate > startDate)
			this.minDate = startDate;
		if (this.maxDate < endDate)
			this.maxDate = endDate;
		
		/* Make the timespan start on Jan. 1 of that year. */
		this.minDate.setUTCMonth(0);
		this.minDate.setUTCDate(1);
		
		var minYear = this.minDate.getUTCFullYear();
		var maxYear = this.maxDate.getUTCFullYear();
		
		this.timespan = new TimeSpan(this.maxDate - this.minDate).days;
		if (minYear < oldMinYear || maxYear > oldMaxYear)
		{
			this.years = [];
			for (var y = minYear; y <= maxYear; ++y)
				this.years.push(y);

			/* create the set of text objects for each year. */
			this.yearGroup.selectAll('text').remove();
			this.yearGroup
				.selectAll('text')
				.data(this.years)
				.enter()
				.append('text')
				.text(function(d) { return d; })
				.attr("font", "sans-serif")
				.attr("font-size", "10px")
				.attr("x", this.textLeftMargin);
		}
			
		return this.minDate < oldMinDate || this.maxDate > oldMaxDate;
	}
	
	Pathway.prototype.showDetailGroup = function(g, experience)
	{
		var detailBackRect = this.detailGroup.append('rect')
			.attr("fill", this.pathBackground)
			.attr("width", "100%");
		var detailFrontRect = this.detailGroup.append('rect')
			.attr("fill-opacity", "0.3")
			.attr("stroke-opacity", "0.8")
			.attr("width", "100%");
		var detailText = this.detailGroup.append('text')
			.attr("width", "100")
			.attr("height", "1")
			.attr('clip-path', 'url(#id_detailClipPath)');
		var detailChevron = this.detailGroup.append('image')
			.attr("width", this.showDetailIconWidth)
			.attr("height", this.showDetailIconWidth)
			.attr("xlink:href", rightChevronPath)
			.attr('clip-path', 'url(#id_detailIconClipPath)')

		var lines = [];
	
		function pickedOrCreatedValue(i, pickedName, createdName)
		{
			var v = i.getValue(pickedName);
			if (v && v.getValueID())
				return v.getDescription();
			else {
				v = i.getValue(createdName);
				if (v)
					return v.value;
				else
					return undefined;
			}
		}
	
		var s;
		s = pickedOrCreatedValue(experience, "Organization", "User Entered Organization");
		if (s && lines.indexOf(s) < 0)
			lines.push(s);

		s = pickedOrCreatedValue(experience, "Site", "User Entered Site");
		if (s && lines.indexOf(s) < 0)
			lines.push(s);

		s = pickedOrCreatedValue(experience, "Offering", "User Entered Offering");
		if (s && lines.indexOf(s) < 0)
			lines.push(s);

		var x = parseFloat(g.getAttribute("flagX")) + parseFloat(g.getAttribute("x"));
		var y = parseFloat(g.getAttribute("y")) - this.textBottomBorder;

		detailText.selectAll('tspan').data(lines)
			.enter()
			.append('tspan')
			.text(function(d) { return d; })
			.attr("x", this.textDetailLeftMargin);
		var spanHeight = detailText.selectAll('tspan').node().getBBox().height + this.detailTextSpacing;
		detailText.selectAll('tspan').attr("dy", spanHeight);
		
		var textBox = detailText.node().getBBox();
		var containerWidth = $(this.containerDiv).width();
		var maxX = containerWidth - this.flagsRightMargin - textBox.width - this.showDetailIconWidth - (this.textDetailLeftMargin * 3);
		if (x > maxX)
			x = maxX;
		var rectWidth = textBox.width + this.showDetailIconWidth + (this.textDetailLeftMargin * 3);
		if (rectWidth < this.flagWidth)
		{
			rectWidth = this.flagWidth;
			textBox.width = rectWidth - this.showDetailIconWidth - (this.textDetailLeftMargin * 3);
		}
		var rectHeight = textBox.height + (this.detailTextSpacing * 2);
			
		this.detailGroup.attr("x", x)
				 .attr("y", y)
				 .attr("transform", "translate("+x + "," + y+")")
				 .attr("height", 0);
		detailBackRect.attr("width", rectWidth)
					   .attr("height", 0)
					   .attr("x", textBox.x - this.textDetailLeftMargin)
					   .attr("y", textBox.y - this.detailTextSpacing)
					   .transition()
					   .duration(700)
					   .attr("height", rectHeight);
		detailFrontRect.attr("width", rectWidth)
					   .attr("height", 0)
					   .attr("x", textBox.x - this.textDetailLeftMargin)
					   .attr("y", textBox.y - this.detailTextSpacing)
					   .each(setColor)
					   .transition()
					   .duration(700)
					   .attr("height", rectHeight);
	   
		/* Set the clip path of the text to grow so the text is revealed in parallel */
		d3.select("#id_detailClipPath").selectAll('rect')
			.attr('x', textBox.x)
			.attr('y', textBox.y)
			.attr('width', textBox.width)
			.attr('height', 0)
			.transition()
			.attr('height', textBox.height)
			.duration(700); 
		detailText				
			.transition()
			.duration(1000)
			.attr("height", textBox.height);

		d3.select("#id_detailIconClipPath").selectAll('rect')
			.attr('x', textBox.x + textBox.width + this.textDetailLeftMargin)
			.attr('y', textBox.y)
			.attr('width', this.showDetailIconWidth)
			.attr('height', 0)
			.transition()
			.attr('height', textBox.height)
			.duration(700); 
		detailChevron.attr('x', textBox.x + textBox.width + this.textDetailLeftMargin)
			.attr('y', textBox.y + (textBox.height - this.showDetailIconWidth) / 2)
			.attr('height', this.showDetailIconWidth);
			
		this.flagDown = true;
	}

	Pathway.prototype.hideDetail = function(done)
	{
		var _this = this;
		if (this.flagDown)
		{
			d3.select("#id_detailClipPath").selectAll('rect')
				.transition()
				.attr("height", 0)
				.each("end", function() {
					_this.detailGroup.selectAll('text').remove();
					/* Remove the image here instead of when the other clipPath ends
						so that it is sure to be removed when the done method is called. 
					 */
					_this.detailGroup.selectAll('image').remove();
					_this.flagDown = false;
					if (done)
						done();
				});
			d3.select("#id_detailIconClipPath").selectAll('rect')
				.transition()
				.attr("height", 0);
			this.detailGroup.selectAll('rect')
				.transition()
				.attr("height", 0)
				.each("end", function() {
					d3.select(this).remove();
				});
		}
		else if (done)
			done();
	}
	
	Pathway.prototype.appendExperiences = function()
	{
		this.experienceGroup.selectAll('g').remove();
		var g = this.experienceGroup.selectAll('g')
			.data(this.allExperiences)
			.enter()
			.append('g');
		
		function showDetail(experience, i)
		{
			var g = this.parentNode;
			var pathway = this.pathway;
			pathway.detailGroup.datum(experience);
			
			pathway.hideDetail(function() {
					pathway.showDetailGroup.call(pathway, g, experience); 
				});
		}
		
		var _this = this;
		var rect = g.append('path')
			.each(function() { this.pathway = _this; })
			.attr("fill-opacity", "0.3")
			.attr("stroke-opacity", "0.7")
			.on("click", function(d) 
				{ 
					d3.event.stopPropagation(); 
				})
			.on("click.cr", showDetail)
			.each(setColor);

		/* t is the set of all text nodes. */
		var t = g.append('text')
			.each(function() { this.pathway = _this; })
			.attr("x", 0)
			.attr("dy", "1.1")
			.attr('clip-path', 'url(#id_clipPath)')
			.text(function(d) { return d.getDescription(); })
			.on("click", function(d) 
				{ 
					d3.event.stopPropagation(); 
				})
			.on("click.cr", showDetail);
	
		/* bbox is used for various height calculations. */
		var bbox;
		if (t.node())
			bbox = t.node().getBBox();
		else
			bbox = {height: 20, y: -18};
			
		this.flagHeight = bbox.height + this.textBottomBorder;

		t.attr("y", function(experience)
			{
				return 0 - bbox.y;
			});
	
		this.layoutExperiences();
	}
	
	Pathway.prototype.addMoreExperience = function(experience)
	{
		this.checkDateRange(experience);
		
		this.allExperiences.push(experience);
		this.allExperiences.sort(this._compareExperiences);
		this.appendExperiences();
		
		if (this.loadingText)
		{
			this.loadingText.remove();
			this.promptAddText.remove();
			this.loadingText = null;
			this.promptAddText = null;
		}
	}
		
	function Pathway(userInstance, sitePanel, containerDiv, editable) {
		editable = (editable !== undefined ? editable : true);
		this.allExperiences = [];
		this.containerDiv = containerDiv;
		this.flagDown = false;
		this.sitePanel = sitePanel;
		this.userInstance = userInstance;
		
		var container = d3.select(containerDiv);
		
		this.svg = container.append('svg')
			.style("width", "100%")
			.style("height", "100%");

		this.defs = this.svg.append('defs');
	
		/* bg is a rectangle that fills the background with the background color. */
		this.bg = this.svg.append('rect')
			.attr("x", 0).attr("y", 0)
			.attr("width", "100%")
			.attr("height", "100%")
			.attr("fill", this.pathBackground);
		
		this.loadingText = this.svg.append('text')
			.attr("x", this.dataLeftMargin).attr("y", 0)
			.attr("fill", "#777")
			.text("Loading...");
			
		this.loadingText.attr("y", this.loadingText.node().getBBox().height);
		
		this.experienceGroup = this.svg.append('g')
				.attr("font-family", "San Francisco,Helvetica Neue,Arial,Helvetica,sans-serif")
				.attr("font-size", "1.3rem");
		this.yearGroup = this.svg.append('g')
			.attr("fill", "#777");
			
		this.detailGroup = this.svg.append('g')
				.attr("font-family", "San Francisco,Helvetica Neue,Arial,Helvetica,sans-serif")
				.attr("font-size", "1.3rem")
			.attr("width", "100%")
			.attr("height", "100%");
	
		var _thisPathway = this;

		this.svg.on("click", function() { _thisPathway.hideDetail(); });
		
		function resizeFunction()
		{
			_thisPathway.layoutExperiences();
		}
		
		$(window).on("resize", resizeFunction);
		sitePanel.panelDiv.on("hiding.cr", function()
		{
			$(window).off("resize", resizeFunction);
		});

		var successFunction1 = function(experiences)
		{
			_thisPathway.allExperiences = experiences;
			$(experiences).each(function()
			{
				this.value.description = this.getValue("Offering").getDescription();
			});
		
			crp.getData({path: "Service", 
						 done: function(newInstances)
							{
							},
							fail: asyncFailFunction});
			crp.getData({path: '"Service Domain"', 
						 done: function(newInstances)
							{
								for (i = 0; i < newInstances.length; ++i)
								{
									if (newInstances[i].getDescription() == "Other")
									{
										color = newInstances[i].getValue("Color");
										if (color && color.value)
											otherColor = color.value;
										break;
									}
								}

								crp.pushCheckCells(_thisPathway.userInstance, function() {
										var m = _thisPathway.userInstance.getValue("More Experiences");
										if (m && m.getValueID())
										{
											var path = "#" + m.getValueID() + '>"More Experience"';
											cr.getData({path: path, 
														done: successFunction2, 
														fail: asyncFailFunction});
										}
										else
											successFunction2([]);	/* There are none. */
									},
									asyncFailFunction);
							},
						fail: asyncFailFunction});
		}

		var successFunction2 = function(experiences)
		{
			_thisPathway.allExperiences = _thisPathway.allExperiences.concat(experiences);
			
			$(experiences).each(function()
			{
				this.calculateDescription();
			});
		
			_thisPathway.allExperiences.sort(_thisPathway._compareExperiences);
			
			_thisPathway.setDateRange();
			
			_thisPathway.appendExperiences();
			
			if (_thisPathway.allExperiences.length > 0)
			{
				_thisPathway.loadingText.remove();
				_thisPathway.loadingText = null;
			}
			else if (editable)
			{
				_thisPathway.loadingText.text('Ready to record an experience?');
				var bbox = _thisPathway.loadingText.node().getBBox();
				_thisPathway.promptAddText = _thisPathway.svg.append('text')
					.attr("fill", "#2C55CC")
					.text(" Record one now.")
					.on("click", function(d) {
						if (prepareClick())
						{
							showClickFeedback(this);
		
							showAddExperiencePanel(_thisPathway, null, sitePanel.node());
						}
						d3.event.preventDefault();
					})
					.attr("cursor", "pointer");
				
				var newBBox = _thisPathway.promptAddText.node().getBBox();
				var containerWidth = $(_thisPathway.containerDiv).width();
				if (bbox.x + bbox.width + _thisPathway.textLeftMargin + newBBox.width >
					containerWidth - _thisPathway.flagsRightMargin)
				{
					_thisPathway.promptAddText.attr("x", _thisPathway.loadingText.attr("x"))
						.attr("y", parseFloat(_thisPathway.loadingText.attr("y")) + bbox.height);
				}
				else
				{
					_thisPathway.promptAddText.attr("x", bbox.x + bbox.width + _thisPathway.textLeftMargin)
						.attr("y", _thisPathway.loadingText.attr("y"));
				}

			}
		}
	
		var path = "#" + this.userInstance.getValueID() + '::reference(Experience)';
		cr.getData({path: path, 
				   fields: ["parents"], 
				   done: successFunction1, 
				   fail: asyncFailFunction});
	}
	
	return Pathway;
})();

function addInput(p, placeholder)
{
	var searchBar = p.append("div").classed("searchbar always-visible table-row", true);
	
	var searchInputContainer = searchBar.append("div")
		.classed("search-input-container", true);
		
	return searchInputContainer
		.append("input")
		.classed("search-input", true)
		.attr("placeholder", placeholder);
}

var ReportedObject = function () {
	ReportedObject.prototype = new cr.EventHandler();
	ReportedObject.prototype.name = null;
	ReportedObject.prototype.value = null;
	
	function ReportedObject(args) {
		cr.EventHandler.call(this);
		
		if (!("name" in args)) args.name = null;
		if (!("value" in args)) args.value = null;
		
		this.name = args.name;
		this.value = args.value;
    };
    
    ReportedObject.prototype.getDescription = function()
    {
    	if (this.value) return this.value.getDescription();
    	return this.name;
    }
    
    return ReportedObject;
}();

function setupPanel0(p0, dots)
{
	p0.append('div')
		.classed('table-row', true)
		.append('p').text("What type of experience do you want to add to your pathway?");
	p0.append('div')
		.classed('table-row', true)
		.append('p').text("Choose one of the types, below, or type the name you can for the experience. If there is more than one, pick one, and then you can add others.");
		
	var searchInput = addInput(p0, "Experience");
	
	var lastText = "";	
	$(searchInput.node()).on("keyup input paste", function(e) {
		if (lastText != this.value)
		{
			lastText = this.value;
			if (lastText.length == 0)
			{
				/* Show all of the items. */
				p0.selectAll("li")
					.style("display", "block");
			}
			else
			{
				/* Show the items whose description is this.value */
				p0.selectAll("li")
					.style("display", function(d)
						{
							if (d.getDescription().toLocaleLowerCase().indexOf(lastText.toLocaleLowerCase()) >= 0)
								return "block";
							else
								return "none";
						});
			}
		}
	});

	function done(rootObjects)
	{
		function sortByDescription(a, b)
		{
			return a.getDescription().localeCompare(b.getDescription());
		}

		function buttonClicked(d)
		{
			if (dots.services.length > 0)
			{
				/* Remove this item if it is farther down in the list. */
				for (var i = 1; i < dots.services.length; ++i)
					if (dots.services[i].value == d)
					{
						dots.services.splice(i, 1);
						break;
					}
				dots.services[0] = new ReportedObject({value: d});
			}
			else
				dots.services.push(new ReportedObject({value: d}));
			
			searchInput.node().value = d.getDescription();
			$(searchInput.node()).trigger("input");
			dots.setValue(dots.value + 1);
		}
		
		rootObjects.sort(sortByDescription);
		p0.datum(rootObjects);
		var w = p0.append('div').classed('body', true)
				  .append('div')
				  .append('div');
		appendButtons(w, rootObjects, buttonClicked);
	}
	
	p0.onDoneClicked = function()
	{
		var newName = searchInput.node().value;
		
		/* Identify if the new name matches the name of an existing service. */
		var newValue = null;
		var rootObjects = p0.datum();
		for (i = 0; i < rootObjects.length; i++)
		{
			if (rootObjects[i].getDescription() == newName)
			{
				newValue = rootObjects[i];
				break;
			}
		}
		
		if (dots.services.length > 0)
		{
			for (var i = 1; i < dots.services.length; ++i)
			{
				if (newName == dots.services[i].getDescription())
				{
					dots.services.splice(i, 1);
					break;
				}
			}
			dots.services[0] = new ReportedObject({name: newName, value: newValue});
		}
		else
			dots.services.push(new ReportedObject({name: newName, value: newValue}));
	}
	crp.getData({path: "Service", done: done, fail: asyncFailFunction});
}

function getObjectByDescription(a, description)
{
	for (var i = 0; i < a.length; ++i)
	{
		if (a[i].getDescription() == description)
			return a[i];
	}
	return null;
}

function showPickServicePanel(previousPanelNode, rootObjects, oldReportedObject, dots, success)
{
	var header;
	if (oldReportedObject)
		header = "Change Value";
	else
		header = "Add Value";
		
	var sitePanel = new SitePanel(previousPanelNode, rootObjects, header, "list");

	var navContainer = sitePanel.appendNavContainer();

	var backButton = navContainer.appendLeftButton()
		.on("click", function()
		{
			if (prepareClick())
			{
				hidePanelRight($(this).parents(".site-panel")[0]);
			}
			d3.event.preventDefault();
		});
	backButton.append("span").text("Cancel");
	
	var addButton = navContainer.appendRightButton()
		.on("click", function()
		{
			if (prepareClick())
			{
				if (!dots.getServiceByName(searchInputNode.value))
				{
					var newValue = getObjectByDescription(rootObjects, searchInputNode.value);
					success(new ReportedObject({name: searchInputNode.value, value: newValue}));
				}
				
				hidePanelRight($(this).parents(".site-panel")[0]);
			}
			d3.event.preventDefault();
		});
	
	navContainer.appendTitle(header);
	
	var textChanged = function(){
		var val = this.value.toLocaleLowerCase();
		if (val.length == 0)
		{
			/* Show all of the items. */
			panel2Div.selectAll("li")
				.style("display", "block");
		}
		else
		{
			/* Show the items whose description is this.value */
			panel2Div.selectAll("li")
				.style("display", function(d)
					{
						if (d.getDescription().toLocaleLowerCase().indexOf(val) >= 0)
							return "block";
						else
							return "none";
					});
		}
	}

	var searchInputNode = sitePanel.appendSearchBar(textChanged);

	var panel2Div = sitePanel.appendScrollArea();
	
	panel2Div.appendAlertContainer();
	
	function buttonClicked(d) {
		if (prepareClick())
		{
			success(new ReportedObject({value: d}));
			hidePanelRight(sitePanel.node());
		}
		d3.event.preventDefault();
	}
	
	var buttons = appendButtons(panel2Div, rootObjects, buttonClicked);
	
	if (oldReportedObject)
	{
		if (oldReportedObject.value)
		{
			buttons.insert("span", ":first-child").classed("glyphicon glyphicon-ok pull-left", 
				function(d) { return d == oldReportedObject.value; });
		}
		else
		{
			searchInputNode.value = oldReportedObject.getDescription();
			$(searchInputNode).trigger("input");
		}
	}
	
	showPanelLeft(sitePanel.node());
}

function setupServicesPanel(dots)
{
	var sitePanel = dots.sitePanel;
	var p1 = d3.select(this);
	p1.append('div')
		.classed('table-row', true)
		.append('p').text("Some experiences provide more than one kind of value, such as being the captain of a soccer team or getting a summer job working with computers. If this opportunity has more than one kind of value, add other values here for this experience.");

	var labelDiv = p1.append("div").classed("table-row", true)
		.append('label')
		.text("Values");

	var obj = p1.append('div')
		.classed('body', true)
		.append('div')
		.append('section');
	
	var itemsDiv = obj.append("ol").classed("items-div panel-fill", true);

	obj.classed("cell multiple", true);
	itemsDiv.classed("border-above", true);

	var clickFunction;
	clickFunction = function(d, i) {
			var _this = this;
			if (prepareClick())
			{
				crp.getData({path: "Service", 
				done: function(rootObjects)
				{
					var success = function(newReportedObject)
					{
						var divs = d3.select($(_this).parents("li")[0]);
						/* Set the datum for the li and this object so that the correct object is used in future clicks. */
						divs.datum(newReportedObject);
						d3.select(_this).datum(newReportedObject);
						var s = divs.selectAll(".description-text").text(newReportedObject.getDescription());
						dots.services[i] = newReportedObject;
					}
					showPickServicePanel(sitePanel.node(), rootObjects, d, dots, success);
				}, 
				fail: syncFailFunction});
			}
		};
		
	var divs = appendItems(itemsDiv, dots.services);
	
	function _confirmDeleteClick(d)
	{
		var a = dots.services;
		a.splice($.inArray(d, a), 1);
		var item = $(this).parents("li")[0];
		$(item).animate({height: "0px"}, 200, 'swing', function() { $(item).remove(); });
	}
	
	appendConfirmDeleteControls(divs)
		.on('click', _confirmDeleteClick);
		
	var buttons = appendRowButtons(divs, null);

	buttons.on("click", clickFunction);
	
	appendDeleteControls(buttons);

	appendRightChevrons(buttons);
		
	appendButtonDescriptions(buttons, null);
	
	/* Add one more button for the add Button item. */
	var buttonDiv = p1.append("div").classed("table-row", true)
		.append("button").classed("btn row-button multi-row-content site-active-text border-above border-below", true)
		.on("click", function(cell) {
			var _thisButton = this;
			if (prepareClick())
			{
				crp.getData({path: "Service", 
				done: function(rootObjects)
				{
					var success = function(newReportedObject)
					{
						dots.services.push(newReportedObject);
						var divs = appendItem(itemsDiv, newReportedObject);
						appendConfirmDeleteControls(divs)
							.on('click', _confirmDeleteClick);
						var buttons = appendRowButtons(divs, null);
						buttons.on("click", clickFunction);
						appendDeleteControls(buttons);
						appendRightChevrons(buttons);
						appendButtonDescriptions(buttons, null);
					}
					var siteNode = $(_thisButton).parents(".site-panel")[0];
					showPickServicePanel(siteNode, rootObjects, null, dots, success);
				}, 
				fail: syncFailFunction});
			}
			d3.event.preventDefault();
		})
		.append("div").classed("pull-left", true);
	buttonDiv.append("span").classed("glyphicon glyphicon-plus", true);
	buttonDiv.append("span").text(" add value");
	
	this.onReveal = null;
}

function setupPanel2(dots)
{
	var p = d3.select(this);
	p.append('div')
		.classed('table-row', true)
		.append('p').text("What organization that provided this experience?");

	var searchInput = addInput(p, "Organization");

	var w = p.append('div').classed('body', true)
			  .append('div')
			  .append('div');

	function textChanged()
	{
		var val = this.value.toLocaleLowerCase().trim();
		var inputBox = this;
		
		if (val.length == 0)
		{
			w.selectAll("ol").remove();
			searchText = val;
		}
		else
		{
			var startVal = val;
						
			var selectAllSuccess = function(orgs)
			{
				function appendDescriptions(buttons)
				{
					var leftText = buttons.append('div').classed("left-expanding-div", true);
			
					leftText.append('div')
						.classed("sub-text", function(d) { return d.getValue("Organization"); })
						.text(function(d) {
							if (d.getValue("Organization"))
								return d.getValue("Organization").getDescription();
							else
								return d.getDescription();
						});
					leftText.append('div')
						.classed("sub-text", true)
						.text(function(d) { 
							if (d.getValue("Organization"))
								return d.getDescription();
							else
								return "";
						});
				}
						
				if (inputBox.value.toLocaleLowerCase().trim() == startVal)
				{
					w.selectAll("ol").remove();
					function buttonClicked(d)
					{
						if (d.getValue("Organization"))
						{
							dots.organization = d.getValue("Organization");
							dots.site = d;
							dots.organizationName = d.getValue("Organization").getDescription();
							dots.siteName = d.getDescription();
						}
						else
						{
							dots.organization = d;
							dots.site = null;
							dots.organizationName = d.getDescription();
							dots.siteName = null;
						}
			
						searchInput.node().value = d.getDescription();
						$(searchInput.node()).trigger("input");
						if (dots.site)
							dots.setValue(dots.value + 2);
						else
							dots.setValue(dots.value + 1);
						d3.event.preventDefault();
					}
		
					appendButtons(w, orgs, buttonClicked, appendDescriptions);
					searchText = startVal;
				}
			}
			
			if (val.length < 3)
				cr.getData({path: '(Organization,Site)[_name^="'+val+'"]', fields: ["parents"], limit: 50, done: selectAllSuccess, fail: asyncFailFunction});
			else
				cr.getData({path: '(Organization,Site)[_name*="'+val+'"]', fields: ["parents"], limit: 50, done: selectAllSuccess, fail: asyncFailFunction} );
		}
	}
	
	var lastText = "";	
	$(searchInput.node()).on("keyup input paste", function(e) {
// 		searchCancelButton
// 			.classed("site-disabled-text", this.value.length == 0)
// 			.classed("site-active-text", this.value.length > 0);
		if (lastText != this.value)
		{
			lastText = this.value;
			textChanged.call(this);
		}
	});

	this.onDoneClicked = function()
	{
		var textValue = searchInput.node().value;
		if ((dots.site && textValue != dots.site.getDescription() && textValue != dots.organization.getDescription()) ||
		    (!dots.site && dots.organization && textValue != dots.organization.getDescription()) ||
		    (!dots.site && !dots.organization))
		{
			dots.organization = null;
			dots.site = null;
			dots.organizationName = searchInput.node().value;
			dots.siteName = null;
		}
	}
	this.onReveal = null;
}

function setupPanel3(dots)
{
	var p = d3.select(this);
	var header = p.append('div')
		.classed('table-row', true)
		.append('p');
	
	var searchInput = addInput(p, "Site");

	var w = p.append('div').classed('body', true)
			  .append('div')
			  .append('div');
			  
	next = function(dots)
	{
		header.text("Where did " + dots.organizationName + " provide this experience?")
		w.selectAll('ol').remove();
		if (dots.organization)
		{
			function done(rootObjects)
			{
				function sortByDescription(a, b)
				{
					return a.getDescription().localeCompare(b.getDescription());
				}

				function buttonClicked(d)
				{
					dots.site = d;
					dots.siteName = d.getDescription();
			
					searchInput.node().value = d.getDescription();
					$(searchInput.node()).trigger("input");
					dots.setValue(dots.value + 1);
				}
		
				rootObjects.sort(sortByDescription);
				appendButtons(w, rootObjects, buttonClicked);
			}
	
			cr.getData({path: "#"+dots.organization.getValueID() + ">Sites>Site", done: done, fail: asyncFailFunction});
		}
	};

	this.onDoneClicked = function()
	{
		if ((dots.site && searchInput.node().value != dots.site.getDescription()) ||
		    !dots.site)
		{
			dots.site = null;
			dots.siteName = searchInput.node().value;
		}
	}
	
	next.call(this, dots);
	this.onReveal = next;
}

function setupPanel4(dots)
{
	var p = d3.select(this);
	p.append('div')
		.classed('table-row', true)
		.append('p').text("What was the name of this experience?");

	var searchInput = addInput(p, "Name");

	var w = p.append('div').classed('body', true)
			  .append('div')
			  .append('div');
			  
	next = function(dots)
	{
		w.selectAll('ol').remove();
		w.selectAll('p').remove();
		if (dots.site)
		{
			function done(rootObjects)
			{
				function sortByDescription(a, b)
				{
					return a.getDescription().localeCompare(b.getDescription());
				}

				function buttonClicked(d)
				{
					dots.offering = d;
					dots.offeringName = d.getDescription();
			
					searchInput.node().value = d.getDescription();
					$(searchInput.node()).trigger("input");
					dots.setValue(dots.value + 1);
				}
		
				rootObjects.sort(sortByDescription);
				appendButtons(w, rootObjects, buttonClicked);
			}
	
			cr.getData({path: "#"+dots.site.getValueID() + ">Offerings>Offering", done: done, fail: asyncFailFunction});
		}
		else
		{
			w.append('p').classed('help-text', true)
				.text("For example, the title of a job, the name of a class or musical instrument or the league of a sports program.");
		}
	};

	this.onDoneClicked = function()
	{
		if ((dots.offering && searchInput.node().value != dots.offering.getDescription()) ||
		    !dots.offering)
		{
			dots.offering = null;
			dots.offeringName = searchInput.node().value;
		}
	}
	
	next.call(this, dots);
	this.onReveal = next;
}

function setupConfirmPanel(dots)
{
	var p = d3.select(this);
	
	p.selectAll("*").remove();
	
	if (dots.offeringName)
		p.append('div')
			.append('p').text("Offering: " + dots.offeringName);
			
	if (dots.organizationName)
		p.append('div')
			.append('p').text("Organization: " + dots.organizationName);
			
	if (dots.siteName)
		p.append('div')
			.append('p').text("Site: " + dots.siteName);
	
	if (dots.services.length > 0)
	{
		var servicesDiv = p.append('div');
		
		servicesDiv.append('p').text("Services");
		for (var i = 0; i < dots.services.length; ++i)
		{
			servicesDiv.append('p').text(dots.services[i].getDescription());
		}
	}
	
	{
		var startDate = dots.startDateInput.value();
		var endDate = dots.endDateInput.value();
		if (startDate && endDate)
			t = startDate + " - " + endDate;
		else if (startDate)
			t = startDate + " - ";
		else if (endDate)
			t = " - " + endDate;
		else
			t = "";
		if (t.length)
			p.append('div')
				.append('p').text(t);
	}
}

/* 
	objectData contains the MoreExperiences object.
 */
function showAddExperiencePanel(pathway, objectData, previousPanelNode) {
		var header = "Add Experience";
			
		var sitePanel = new SitePanel(previousPanelNode, objectData, header, "edit new-experience-panel");

		var navContainer = sitePanel.appendNavContainer();

		var panel2Div = sitePanel.appendScrollArea()
			.classed("vertical-scrolling", false)
			.classed("no-scrolling", true);
		
		panel2Div.appendAlertContainer();
		
		var dots = new DotsNavigator(panel2Div, sitePanel, 8);	
		dots.finalText = "Add";	

		var hideSuccessFunction = function()
			{
				var moreExperiencesObject = pathway.userInstance.getValue("More Experiences");
				
				function successFunction3(newData)
				{
					newData.checkCells([],
						function() {
							pathway.addMoreExperience.call(pathway, newData);
							hidePanelDown($(dots.doneButton.node()).parents(".site-panel")[0]);
						},
						syncFailFunction);
				}
				
				function successFunction2(newData)
				{
					if (newData != moreExperiencesObject)
					{
						var cell = pathway.userInstance.getCell("More Experiences");
						cell.addValue(newData);
						moreExperiencesObject = pathway.userInstance.getValue("More Experiences");
					}
					
					field = {ofKind: "More Experience", name: "More Experience"};
					var initialData = {};
					var startDate = dots.startDateInput.value();
					var endDate = dots.endDateInput.value();
					
					if (startDate.length > 0)
						initialData["Start Date"] = [startDate];
					if (endDate.length > 0)
						initialData["End Date"] = [endDate];
						
					if (dots.organization)
						initialData["Organization"] = dots.organization.getValueID();
					else if (dots.organizationName)
						initialData["User Entered Organization"] = dots.organizationName;
						
					if (dots.site)
						initialData["Site"] = dots.site.getValueID();
					else if (dots.siteName)
						initialData["User Entered Site"] = dots.siteName;
						
					if (dots.offering)
						initialData["Offering"] = dots.offering.getValueID();
					else if (dots.offeringName)
						initialData["User Entered Offering"] = dots.offeringName;
						
					for (i = 0; i < dots.services.length; ++i)
					{
						var s = dots.services[i];
						if (s.value)
						{
							if (!initialData["Service"])
								initialData["Service"] = [s.value.getValueID()];
							else
								initialData["Service"].push(s.value.getValueID());
						}
						else if (s.name)
						{
							if (!initialData["User Entered Service"])
								initialData["User Entered Service"] = [s.name];
							else
								initialData["User Entered Service"].push(s.name);
						}
					}
					
					cr.createInstance(field, moreExperiencesObject.getValueID(), initialData, successFunction3, syncFailFunction);
				}
				
				if (moreExperiencesObject && moreExperiencesObject.getValueID())
				{
					successFunction2(moreExperiencesObject);
				}
				else
				{
					field = {ofKind: "More Experiences", name: "More Experiences"};
					cr.createInstance(field, pathway.userInstance.getValueID(), [], successFunction2, syncFailFunction);
				}
			};

		dots.appendForwardButton(navContainer, hideSuccessFunction);
		dots.appendBackButton(navContainer);
		
		navContainer.appendTitle(header);
		
		function setupPanel5(dots)
		{
			var p = d3.select(this);
			p.append('div')
				.append('p').text("When did you start " + dots.offeringName + "?");
	
			var minYear = undefined;	
			var birthday = pathway.userInstance.getValue("Birthday");
			if (birthday && birthday.value)
				minYear = parseInt(birthday.value.substr(0, 4));

			dots.startDateInput = new DateInput(this, minYear);
				
			this.onReveal = null;
		}

		function setupPanel6(dots)
		{
			var p = d3.select(this);
			p.append('div')
				.append('p').text("If it is over, when did you finish " + dots.offeringName + "?");

			var minYear = undefined;
			if (dots.startDateInput.year)
				minYear = dots.startDateInput.year;
			else
			{
				var birthday = pathway.userInstance.getValue("Birthday");
				if (birthday && birthday.value)
					minYear = parseInt(birthday.value.substr(0, 4));
			}

			dots.endDateInput = new DateInput(this, minYear)

			this.onReveal = null;
		}

		var p0 = d3.select(dots.nthPanel(0));
		
		setupPanel0(p0, dots);
		dots.nthPanel(1).onReveal = setupPanel2;
		dots.nthPanel(2).onReveal = setupPanel3;
		dots.nthPanel(3).onReveal = setupPanel4;
		dots.nthPanel(4).onReveal = setupPanel5;
		dots.nthPanel(5).onReveal = setupPanel6;
		dots.nthPanel(6).onReveal = setupServicesPanel;
		dots.nthPanel(7).onReveal = setupConfirmPanel;
				
		showPanelUp(sitePanel.node());
		dots.showDots();
}

var PathwayPanel = (function () {
	PathwayPanel.prototype = new SitePanel();
	PathwayPanel.prototype.pathway = null;
	
	function PathwayPanel(userInstance, previousPanel) {
		SitePanel.call(this, previousPanel, null, "My Pathway", "edit");
		var navContainer = this.appendNavContainer();
		
		var backButton = navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent);
		backButton.append("span").text("Done");
		var _this = this;
		
		var addExperienceButton = navContainer.appendRightButton()
			.classed('add-button', true)
			.on("click", function(d) {
				if (prepareClick())
				{
					showClickFeedback(this);
		
					showAddExperiencePanel(_this.pathway, null, _this.node());
				}
				d3.event.preventDefault();
			});
		addExperienceButton.append("span").text("+");
		
		var panel2Div = this.appendScrollArea();
		panel2Div.appendAlertContainer();
		showPanelLeft(this.node());
		this.pathway = new Pathway(userInstance, this, panel2Div.node(), true);
	}
	
	return PathwayPanel;
})();