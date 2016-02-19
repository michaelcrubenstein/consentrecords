function hidePathway() {
	var container = d3.select(this);
	container.selectAll('svg').remove();
}
	
function _pickedOrCreatedValue(i, pickedName, createdName)
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

var FlagData = (function() {
	FlagData.prototype.experience = null;
	FlagData.prototype.x = null;
	FlagData.prototype.y = null;
	FlagData.prototype.height = null;
	FlagData.prototype.flagX = null;
	
	FlagData.prototype.getDescription = function()
	{
		return this.experience.getDescription();
	}
	
	FlagData.prototype.pickedOrCreatedValue = function(pickedName, createdName)
	{
		return _pickedOrCreatedValue(this.experience, pickedName, createdName);
	}

	function FlagData(experience)
	{
		this.experience = experience;
		this.y = null;
		this.x = null;
		this.height = null;
		this.flagX = null;
	}
	return FlagData;
})();

var Pathway = (function () {
	Pathway.prototype.dataTopMargin = 5;
	Pathway.prototype.dataBottomMargin = 5;
	Pathway.prototype.dataLeftMargin = 40;			/* The space between the left margin and the beginning of the flags */
	Pathway.prototype.trunkWidth = 5;
	Pathway.prototype.trunkSpacing = 5;
	Pathway.prototype.trunkColumnWidth = 10;		/* trunkWidth + trunkSpacing; */
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
	
	Pathway.prototype.detailFlagData = null;
	Pathway.prototype.flagElement = null;
	Pathway.prototype.flagHeight = 0;
	Pathway.prototype.flagWidth = 0;
	
	Pathway.prototype.minDate = null;
	Pathway.prototype.maxDate = null;
	Pathway.prototype.timespan = 0;
	Pathway.prototype.dataHeight = 0;
	Pathway.prototype.dataWidth = 0;
	Pathway.prototype.dayHeight = 0;
	Pathway.prototype.years = [];
	
	//This is the accessor function we talked about above
	Pathway.prototype._lineFunction = d3.svg.line()
		.x(function(d) { return d.x; })
		.y(function(d) { return d.y; })
		.interpolate("linear");

	Pathway.prototype._compareExperiences = function(a, b)
	{
		var aService = a.getValue("Service");
		var bService = b.getValue("Service");
		var aServiceDomain = aService && crp.getInstance(aService.getValueID()).getValue("Service Domain");
		var bServiceDomain = bService && crp.getInstance(bService.getValueID()).getValue("Service Domain");
		if (!bServiceDomain)
		{
			if (aServiceDomain) return -1;
		}
		else if (!aServiceDomain)
			return 1;
		else
		{
			var aDescription = aServiceDomain.getDescription();
			var bDescription = bServiceDomain.getDescription();
			var ordered = ["Housing", "Education", "Extra-Curricular", "Wellness", "Career & Finance"];
			var aOrder = ordered.indexOf(aDescription);
			var bOrder = ordered.indexOf(bDescription);
			if (aOrder < 0) aOrder = ordered.length;
			if (bOrder < 0) bOrder = ordered.length;
			if (aOrder != bOrder)
				return aOrder - bOrder;
		}
		
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

	Pathway.prototype.getExperiencePath = function(g, fd)
	{
		var flagX = fd.flagX;
		var h = this.getExperienceHeight(fd.experience);
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
	
	Pathway.prototype.clearLayout = function()
	{
		/* Do whatever it takes to force layout when layoutExperiences is called. */
		this.dataHeight = 0;
		this.dataWidth = 0;
	}

	Pathway.prototype.layoutExperiences = function()
	{
		var container = $(this.containerDiv);
		
		var containerHeight = container.height();
		var containerWidth = container.width();
		
		if (containerWidth === 0)
			return;
		
		if (this.dataHeight === containerHeight - this.dataTopMargin - this.dataBottomMargin &&
			this.dataWidth === containerWidth)
			return;
		
		/* Calculate the height of the area where data appears and the height of a single day. */
		this.dataHeight = containerHeight - this.dataTopMargin - this.dataBottomMargin;
		this.dataWidth = containerWidth;
		this.dayHeight = this.dataHeight / this.timespan;
	
		var columns = [];
		this.flagColumns = [];
		var g = this.experienceGroup.selectAll('g');
		var y = this.yearGroup.selectAll('text');
		
		var _thisPathway = this;
		
		/* Restore the sort order to startDate/endDate */
		g.sort(function(a, b)
		{
			return _thisPathway._compareExperiences(a.experience, b.experience);
		});
	
		function getExperienceY (fd, i)
		{
			return _thisPathway.DateToY(Date.parse(getEndDate(fd.experience)));
		}

		/* MaxHeight is the maximum height of the top of a column before skipping to the
			next column */
		function addToBestColumn(fd, columns)
		{
			var thisTop = fd.y;
			var thisBottom = fd.y + fd.height;
			var j;
			for (j = 0; j < columns.length; ++j)
			{
				// If this item's height + y is greater than the last item,
				// then add this to the column.
				var column = columns[j];
				var lastTop = d3.select(column[column.length - 1]).datum().y;
				if (lastTop > thisBottom)
				{
					column.push(this);
					break;
				}
				else
				{
					var isInserted = false;
					for (var i = column.length - 1; i > 0; --i)
					{
						var aboveFlag = d3.select(column[i]);
						var belowFlag = d3.select(column[i-1]);
						var aboveBottom = aboveFlag.datum().y + aboveFlag.datum().height;
						var belowTop = belowFlag.datum().y;
						if (thisTop > aboveBottom &&
							thisBottom < belowTop)
						{
							column.splice(i, 0, this);
							isInserted = true;
							break;
						}
						else if (thisTop < aboveBottom)
							break;
					}
					if (isInserted)
						break;
					var aboveFlag = d3.select(column[0]);
					var aboveBottom = aboveFlag.datum().y + aboveFlag.datum().height;
					if (thisTop > aboveBottom)
					{
						column.splice(0, 0, this);
						break;
					}
				}
			}
			if (j == columns.length)
			{
				columns.push([this]);
			}
		}
		
		function addToFlagColumns(fd, flagColumns, flagHeight)
		{
			var thisTop = fd.y;
			var thisBottom = thisTop + flagHeight;
			var j;
			for (j = 0; j < flagColumns.length; ++j)
			{
				// If this item's height + y is greater than the last item,
				// then add this to the column.
				var column = flagColumns[j];
				var lastTop = d3.select(column[column.length - 1]).datum().y;
				if (lastTop > thisBottom)
				{
					column.push(this);
					break;
				}
				else
				{
					var isInserted = false;
					for (var i = column.length - 1; i > 0; --i)
					{
						var aboveFlag = d3.select(column[i]);
						var belowFlag = d3.select(column[i-1]);
						var aboveTop = aboveFlag.datum().y;
						var belowTop = belowFlag.datum().y;
						if (thisTop > aboveTop + flagHeight &&
							thisBottom < belowTop)
						{
							column.splice(i, 0, this);
							isInserted = true;
							break;
						}
						else if (thisTop < aboveTop + flagHeight)
							break;
					}
					if (isInserted)
						break;
					var aboveFlag = d3.select(column[0]);
					var aboveTop = aboveFlag.datum().y;
					if (thisTop > aboveTop + flagHeight)
					{
						column.splice(0, 0, this);
						break;
					}
				}
			}
			if (j == flagColumns.length)
			{
				flagColumns.push([this]);
			}
		};
	
		/* Compute the y attribute for every item */
		
		/* Fit each item to a column, according to the best layout. */	
		g.each(function(fd, i)
			{
				fd.y = getExperienceY(fd);
				fd.height = _thisPathway.getExperienceHeight(fd.experience);
				addToBestColumn.call(this, fd, columns);
			});
		
		/* Compute the x attribute for every item */
		/* Then, Add the items to the flag columns in the column order for better results than
			the current sort order.
		 */
		for (var j = 0; j < columns.length; ++j)
		{
			var x = this.dataLeftMargin + (this.trunkColumnWidth * j);
			var column = columns[j];
			for (var i = 0; i < column.length; ++i)
			{
				var fd = d3.select(column[i]).datum();
				fd.x = x;
				addToFlagColumns.call(column[i], fd, this.flagColumns, this.flagHeight);
			}
		}
	
		/* Compute the column width for each column of flags + spacing to its right. 
			Add flagSpacing before dividing so that the rightmost column doesn't need spacing to its right.
		 */
		var flagsLeft = this.dataLeftMargin + (this.trunkColumnWidth * columns.length) + this.flagsLeftMargin;
	
		var flagColumnWidth = (this.dataWidth - flagsLeft - this.flagsRightMargin + this.flagSpacing) / this.flagColumns.length;
		this.flagWidth = flagColumnWidth - this.flagSpacing;
		var textWidth = this.flagWidth - this.textLeftMargin - this.textRightMargin;
		if (textWidth < 0)
			textWidth = 0;
		
		g.attr("transform", 
			function(fd)
			{
				return "translate(" + fd.x + "," + fd.y + ")";
			})
			
		if (this.detailFlagData != null)
		{
			/*( Restore the flagElement */
			 g.each(function(fd)
			 {
				if (fd === _thisPathway.detailFlagData)
					_thisPathway.flagElement = this;
			 });
		}
		
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
				d3.selectAll(column).each(function(fd) {
						fd.flagX = flagLeft - fd.x;
					});
			}
		
			/* Transform each text node relative to its containing group. */
			g.selectAll('text').attr("transform",
				function(fd)
				{
					return "translate(" + (fd.flagX + _thisPathway.textLeftMargin).toString() + ", 0)";
				});
			
			/* Calculate the path for each containing group. */
			g.selectAll('path').attr("d", function(fd) {
					return _thisPathway.getExperiencePath(this.parentNode, fd);
				});
			
			g.sort(function (a, b)
			{
				if (a.flagX+a.x != b.flagX+b.x)
					return (b.flagX+b.x) - (a.flagX+a.x);
				else
					return a.y - b.y;
			});
		}

		y.attr("y", function(d) { 
				return _thisPathway.DateToY(new Date(d, 0, 0));
			});
			
		if (y.size() >= 2)
		{
			var oldD0 = y[0][0];
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
		if (this.detailFlagData != null)
		{
			this.refreshDetail();
		}
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
	
	Pathway.prototype.getServiceDomain = function(service)
	{
		return service.getValue("Service Domain");
	}
	
	Pathway.prototype.setColorByService = function(service)
	{
		var serviceInstance = crp.getInstance(service.getValueID());
		var serviceDomain = serviceInstance && serviceInstance.getValue("Service Domain");
		if (serviceDomain && serviceDomain.getValueID())
		{
			var sdInstance = crp.getInstance(serviceDomain.getValueID());
			color = sdInstance.getValue("Color");
			if (color && color.value)
				this.attr("fill", color.value)
					 .attr("stroke", color.value);
		}
		else
			this.attr("fill", otherColor)
				.attr("stroke", otherColor);
	}

	Pathway.prototype.setColor = function(fd)
	{
		var _this = d3.select(this);

		var offering = fd.experience.getValue("Offering");
		if (offering && offering.getValueID())
		{
			var experienceColor = otherColor;
			crp.pushCheckCells(offering, function()
			{
				var service = offering.getValue("Service");
				if (service)
					Pathway.prototype.setColorByService.call(_this, service);
				else
					_this.attr("fill", otherColor)
						 .attr("stroke", otherColor);
			},
			asyncFailFunction);
		}
		else
		{
			var service = fd.experience.getValue("Service");
			if (service && service.getValueID())
				Pathway.prototype.setColorByService.call(_this, service);
			else
				_this.attr("fill", otherColor)
					 .attr("stroke", otherColor);
		}
	}

	Pathway.prototype.showDetailPanel = function(fd, i)
	{
		if (prepareClick('click', 'show experience detail: ' + fd.getDescription()))
		{
			var panel = $(this).parents(".site-panel")[0];
			var experienceDetailPanel = new ExperienceDetailPanel(fd.experience, panel);
			d3.event.stopPropagation();
		}
	}
	
	Pathway.prototype.showDetailGroup = function(g, fd, duration)
	{
		duration = (duration !== undefined ? duration : 700);
		
		this.detailGroup.datum(fd);
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
	
		var s;
		s = fd.pickedOrCreatedValue("Organization", "User Entered Organization");
		if (s && lines.indexOf(s) < 0)
			lines.push(s);

		s = fd.pickedOrCreatedValue("Site", "User Entered Site");
		if (s && lines.indexOf(s) < 0)
			lines.push(s);

		s = fd.pickedOrCreatedValue("Offering", "User Entered Offering");
		if (s && lines.indexOf(s) < 0)
			lines.push(s);

		var x = fd.flagX + fd.x;
		var y = fd.y - this.textBottomBorder;

		var tspans = detailText.selectAll('tspan').data(lines)
			.enter()
			.append('tspan')
			.text(function(d) { return d; })
			.attr("x", this.textDetailLeftMargin);
		var spanHeight = tspans.node().getBBox().height + this.detailTextSpacing;
		tspans.attr("dy", spanHeight);
		
		var textBox = detailText.node().getBBox();
		var maxX = this.dataWidth - this.flagsRightMargin - textBox.width - this.showDetailIconWidth - (this.textDetailLeftMargin * 3);
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
					   .attr("x", textBox.x - this.textDetailLeftMargin)
					   .attr("y", textBox.y - this.detailTextSpacing);
		detailFrontRect.attr("width", rectWidth)
					   .attr("x", textBox.x - this.textDetailLeftMargin)
					   .attr("y", textBox.y - this.detailTextSpacing)
					   .each(this.setColor)
					   .each(this.setupServicesTriggers)
					   .transition()
					   .duration(duration)
					   .attr("height", rectHeight);
		if (duration > 0)
		{
			detailBackRect.attr("height", 0)
					   .transition()
					   .duration(duration)
					   .attr("height", rectHeight);
			detailFrontRect.attr("height", 0)
					   .transition()
					   .duration(duration)
					   .attr("height", rectHeight);
		}
		else
		{
			detailBackRect.attr("height", rectHeight);
			detailFrontRect.attr("height", rectHeight);
		}
	   
		/* Set the clip path of the text to grow so the text is revealed in parallel */
		var textClipRect = d3.select("#id_detailClipPath").selectAll('rect')
			.attr('x', textBox.x)
			.attr('y', textBox.y)
			.attr('width', textBox.width); 
		
		var iconClipRect = d3.select("#id_detailIconClipPath").selectAll('rect')
			.attr('x', textBox.x + textBox.width + this.textDetailLeftMargin)
			.attr('y', textBox.y)
			.attr('width', this.showDetailIconWidth);
			
		detailChevron.attr('x', textBox.x + textBox.width + this.textDetailLeftMargin)
			.attr('y', textBox.y + (textBox.height - this.showDetailIconWidth) / 2);
			
		if (duration > 0)
		{
			textClipRect.attr('height', 0)
				.transition()
				.duration(duration)
				.attr('height', textBox.height); 
			detailText				
				.transition()
				.duration(duration)
				.attr("height", textBox.height);

			iconClipRect.attr('height', 0)
				.transition()
				.duration(duration)
				.attr('height', textBox.height);
		}
		else
		{
			textClipRect.attr('height', textBox.height); 
			detailText.attr("height", textBox.height);
			iconClipRect.attr('height', textBox.height);
		}
		
		this.detailFlagData = fd;
		this.flagElement = g;
		
		{
			var _this = this;
			var experience = this.detailFlagData.experience;
			[experience.getCell("Organization"),
			 experience.getCell("User Entered Organization"),
			 experience.getCell("Site"),
			 experience.getCell("User Entered Site")].forEach(function(d)
			 {
				/* d will be null if the experience came from the organization for the 
					User Entered Organization and User Entered Site.
				 */
				if (d)
				{
					$(d).on("dataChanged.cr", null, _this, _this.handleChangeDetailGroup);
					$(d).on("valueAdded.cr", null, _this, _this.handleChangeDetailGroup);
				}
			 });
		 }
	}
	
	Pathway.prototype.handleChangeDetailGroup = function(eventObject)
	{
		eventObject.data.refreshDetail();
	}
	
	Pathway.prototype.clearDetail = function()
	{
		this.detailGroup.selectAll('text').remove();
		/* Remove the image here instead of when the other clipPath ends
			so that it is sure to be removed when the done method is called. 
		 */
		this.detailGroup.selectAll('image').remove();
		this.detailGroup.selectAll('rect').remove();
		d3.select("#id_detailClipPath").attr('height', 0);
		d3.select("#id_detailIconClipPath").attr('height', 0);
		
		var _this = this;
		if (this.detailFlagData)
		{
			var experience = this.detailFlagData.experience;
			[experience.getCell("Organization"),
			 experience.getCell("User Entered Organization"),
			 experience.getCell("Site"),
			 experience.getCell("User Entered Site")].forEach(function(d)
			 {
				/* d will be null if the experience came from the organization for the 
					User Entered Organization and User Entered Site.
				 */
			 	if (d)
			 	{
					$(d).off("dataChanged.cr", null, _this.handleChangeDetailGroup);
					$(d).off("valueAdded.cr", null, _this.handleChangeDetailGroup);
				}
			 });
		}
		
		this.detailGroup.datum(null);
		this.detailFlagData = null;
		this.flagElement = null;
	}

	Pathway.prototype.hideDetail = function(done, duration)
	{
		duration = (duration !== undefined ? duration : 250);
		
		var _this = this;
		if (this.flagElement != null)
		{
			if (duration === 0)
			{
				this.clearDetail();
				if (done) done();
			}
			else
			{
				d3.select("#id_detailClipPath").selectAll('rect')
					.transition()
					.attr("height", 0)
					.duration(duration)
					.each("end", function() {
						_this.clearDetail();
						if (done)
							done();
					});
				d3.select("#id_detailIconClipPath").selectAll('rect')
					.transition()
					.duration(duration)
					.attr("height", 0);
				this.detailGroup.selectAll('rect')
					.transition()
					.duration(duration)
					.attr("height", 0);
			}
		}
		else if (done)
			done();
	}
	
	Pathway.prototype.refreshDetail = function()
	{
		var oldFlagData = this.detailFlagData;
		var oldElement = this.flagElement;
		var _this = this;
		this.hideDetail(
			function() { _this.showDetailGroup(oldElement, oldFlagData, 0); },
			0);
	}
	
	/* setup up each group (this) that displays an experience to delete itself if
		the experience is deleted.
	 */
	Pathway.prototype.setupDelete = function(fd) 
	{
		var valueDeleted = function(eventObject)
		{
			d3.select(eventObject.data).remove();
		};
		
		var dataChanged = function(eventObject)
		{
			d3.select(eventObject.data).selectAll('text')
				.text(function(d) { return d.getDescription(); })
		}
		
		$(fd.experience).one("valueDeleted.cr", null, this, valueDeleted);
		$(fd.experience).on("dataChanged.cr", null, this, dataChanged);
		
		$(this).on("remove", function()
		{
			$(fd.experience).off("valueDeleted.cr", null, valueDeleted);
			$(fd.experience).off("dataChanged.cr", null, dataChanged);
		});
	}
	
	Pathway.prototype.handleChangeServices = function(eventObject)
	{
		var rect = d3.select(eventObject.data);
		var experience = rect.datum();
		
		Pathway.prototype.setColor.call(eventObject.data, experience);
	}
	
	Pathway.prototype.setupServicesTriggers = function(fd)
		{
			var e = fd.experience;
			var serviceCell = e.getCell("Service");
			var userServiceCell = e.getCell("User Entered Service");
			$(serviceCell).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this, Pathway.prototype.handleChangeServices);
			$(userServiceCell).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this, Pathway.prototype.handleChangeServices);
			$(this).on("remove", null, e, function(eventObject)
			{
				var serviceCell = e.getCell("Service");
				var userServiceCell = e.getCell("User Entered Service");
				$(serviceCell).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, Pathway.prototype.handleChangeServices);
				$(userServiceCell).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, Pathway.prototype.handleChangeServices);
			});
		}
	
	Pathway.prototype.appendExperiences = function()
	{
		this.experienceGroup.selectAll('g').remove();
		var g = this.experienceGroup.selectAll('g')
			.data(this.allExperiences.map(function(e) { return new FlagData(e); }))
			.enter()
			.append('g')
			.each(this.setupDelete);
		
		function showDetail(fd, i)
		{
			cr.logRecord('click', 'show detail: ' + fd.getDescription());
			var g = this.parentNode;
			var pathway = this.pathway;
			pathway.detailGroup.datum(fd);
			
			pathway.hideDetail(function() {
					pathway.showDetailGroup(g, fd); 
				});
		}
		
		var _this = this;
		g.append('path')
			.each(function()
				{ this.pathway = _this; })
			.attr("fill", '#FFFFFF')
			.attr("stroke", '#FFFFFF');

		g.append('path')
			.each(function()
				{ this.pathway = _this; })
			.attr("fill-opacity", "0.3")
			.attr("stroke-opacity", "0.7")
			.on("click", function() 
				{ 
					d3.event.stopPropagation(); 
				})
			.on("click.cr", showDetail)
			.each(this.setColor)
			.each(this.setupServicesTriggers);

		/* t is the set of all text nodes. */
		var t = g.append('text')
			.each(function() { this.pathway = _this; })
			.attr("x", 0)
			.attr("dy", "1.1")
			.attr('clip-path', 'url(#id_clipPath)')
			.text(function(fd) { return fd.getDescription(); })
			.on("click", function() 
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

		t.attr("y", function()
			{
				return 0 - bbox.y;
			});
	
		this.clearLayout();
		this.layoutExperiences();
	}
	
	Pathway.prototype.handleDataChanged = function(eventObject)
	{
		var _this = eventObject.data;

		_this.clearLayout();
		_this.layoutExperiences();
	}
	
	Pathway.prototype.handleValueDeleted = function(eventObject)
	{
		var i = this;
		var _this = eventObject.data;
		
		var index = _this.allExperiences.indexOf(i);
		if (index >= 0)
			_this.allExperiences.splice(index, 1);
		if (i == _this.detailFlagData.experience)
			_this.hideDetail(function() { }, 0);
		_this.clearLayout();
		_this.layoutExperiences();
	};

	Pathway.prototype.handleExperienceDateChanged = function(eventObject)
	{
		var _this = eventObject.data;
		_this.setDateRange();
		_this.appendExperiences();
	}
		
	Pathway.prototype.setupExperienceTriggers = function(experience)
	{
		var _this = this;
		
		$(experience).on("dataChanged.cr", null, this, this.handleDataChanged);
		$(experience).on("valueDeleted.cr", null, this, this.handleValueDeleted);
		$(experience.getCell("Start")).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this, this.handleExperienceDateChanged);
		$(experience.getCell("End")).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this, this.handleExperienceDateChanged);
		
		$(this.sitePanel.node()).on("remove", null, experience, function(eventObject)
		{
			$(eventObject.data).off("dataChanged.cr", null, _this.handleDataChanged);
			$(eventObject.data).off("valueDeleted.cr", null, _this.handleValueChanged);
			$(eventObject.data.getCell("Start")).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this.handleExperienceDateChanged);
			$(eventObject.data.getCell("End")).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this.handleExperienceDateChanged);
		});
	}
	
	Pathway.prototype.addMoreExperience = function(experience)
	{
		this.checkDateRange(experience);
		experience.typeName = "More Experience";
		
		this.allExperiences.push(experience);
		
		this.setupExperienceTriggers(experience);
		
		this.appendExperiences();
		
		if (this.loadingText)
		{
			this.loadingText.remove();
			this.promptAddText.remove();
			this.loadingText = null;
			this.promptAddText = null;
		}
	}
	
	Pathway.prototype.showAllExperiences = function()
	{
		this.setDateRange();
		
		var _this = this;
		function resizeFunction()
		{
			_this.layoutExperiences();
		}
	
		var node = this.sitePanel.node();
		this.allExperiences.filter(function(d)
			{
				return d.typeName === "More Experience";
			})
			.forEach(function(d)
			{
				_this.setupExperienceTriggers(d);
			});

		$(window).on("resize", resizeFunction);
		$(node).on("hiding.cr", function()
		{
			$(window).off("resize", resizeFunction);
		});
	
		this.appendExperiences();
	}
		
	function Pathway(userInstance, sitePanel, containerDiv, editable) {
		editable = (editable !== undefined ? editable : true);
		this.allExperiences = [];
		this.containerDiv = containerDiv;
		this.detailFlagData = null;
		this.flagElement = null;
		this.sitePanel = sitePanel;
		this.userInstance = userInstance;
		
		var container = d3.select(containerDiv);
		
		this.svg = container.append('div')
			.style("height", "100%")
			.append('svg')
			.style("width", "100%")
			.style("height", "100%");

		this.defs = this.svg.append('defs');
	
		/* bg is a rectangle that fills the background with the background color. */
		this.bg = this.svg.append('rect')
			.attr("x", 0).attr("y", 0)
			.style("width", "100%")
			.style("height", "100%")
			.attr("fill", this.pathBackground);
			
		this.loadingMessage = crv.appendLoadingMessage(containerDiv)
			.style("position", "absolute")
			.style("left", "0")
			.style("top", "0");
		
		this.experienceGroup = this.svg.append('g')
				.attr("font-family", "San Francisco,Helvetica Neue,Arial,Helvetica,sans-serif")
				.attr("font-size", "1.3rem");
		this.yearGroup = this.svg.append('g')
			.attr("fill", "#777");
			
		this.detailGroup = this.svg.append('g')
				.attr("font-family", "San Francisco,Helvetica Neue,Arial,Helvetica,sans-serif")
				.attr("font-size", "1.3rem")
			.style("width", "100%")
			.style("height", "100%")
			.on("click", function(d) 
				{ 
					d3.event.stopPropagation(); 
				})
			.on("click.cr", this.showDetailPanel);
			
		var _thisPathway = this;

		$(this.sitePanel.node()).on("remove", null, null, function() {
			_thisPathway.clearDetail();
		});
		
		this.svg.on("click", function() 
			{ 
				d3.event.stopPropagation(); 
			})
			.on("click.cr", function() {
				cr.logRecord('click', 'hide details');
				_thisPathway.hideDetail();
			});
		
		var successFunction1 = function(experiences)
		{
			_thisPathway.allExperiences = experiences;
			$(experiences).each(function()
			{
				this.typeName = "Experience";
				this.setDescription(this.getValue("Offering").getDescription());
			});
		
			crp.getData({path: "#" + _thisPathway.userInstance.getValueID() + '::reference(Experience)::reference(Experiences)' + 
								'::reference(Session)::reference(Sessions)::reference(Offering)',
						 done: function(newInstances)
							{
							},
							fail: asyncFailFunction});
			crp.getData({path: "#" + _thisPathway.userInstance.getValueID() + '>"More Experiences">"More Experience">Offering',
						 done: function(newInstances)
							{
							},
							fail: asyncFailFunction});			
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
											m.getCellData("More Experience",
														  successFunction2, 
														  asyncFailFunction);
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
				this.typeName = "More Experience";
				this.calculateDescription();
			});
		
			_thisPathway.showAllExperiences();
			
			crv.stopLoadingMessage(_thisPathway.loadingMessage);
			_thisPathway.loadingMessage.remove();
			
			if (_thisPathway.allExperiences.length == 0 && editable)
			{
				_thisPathway.loadingText = _thisPathway.svg.append('text')
					.attr("x", _thisPathway.dataLeftMargin).attr("y", 0)
					.attr("fill", "#777")
					.text('Ready to record an experience?')
					.attr("y", this.loadingText.node().getBBox().height);
			
				var bbox = _thisPathway.loadingText.node().getBBox();
				_thisPathway.promptAddText = _thisPathway.svg.append('text')
					.attr("fill", "#2C55CC")
					.text(" Record one now.")
					.on("click", function(d) {
						if (prepareClick('click', 'Record one now prompt'))
						{
							showClickFeedback(this);
		
							var newPanel = new AddExperiencePanel(_thisPathway, null, sitePanel.node());
						}
						d3.event.preventDefault();
					})
					.attr("cursor", "pointer");
				
				var newBBox = _thisPathway.promptAddText.node().getBBox();
				if (bbox.x + bbox.width + _thisPathway.textLeftMargin + newBBox.width >
					_thisPathway.dataWidth - _thisPathway.flagsRightMargin)
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
		
		var path = "#" + _thisPathway.userInstance.getValueID() + '::reference(Experience)';
		cr.getData({path: path, 
				   fields: ["parents"], 
				   done: successFunction1, 
				   fail: asyncFailFunction});
	}
	
	return Pathway;
})();

function addInput(p, placeholder)
{
	var searchBar = p.append("div").classed("searchbar table-row", true);
	
	var searchInputContainer = searchBar.append("div")
		.classed("search-input-container", true);
		
	return searchInputContainer
		.append("input")
		.classed("search-input", true)
		.attr("placeholder", placeholder);
}

var ReportedObject = function () {
	ReportedObject.prototype.name = null;
	ReportedObject.prototype.value = null;
	
	function ReportedObject(args) {
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

function setupFirstMarkerPanel(dots)
{
	var p0 = d3.select(this);
	p0.append('div')
		.classed('table-row', true)
		.append('p').text("Every experience leaves some marker along your pathway that describes what you got from that experience.");
	p0.append('div')
		.classed('table-row', true)
		.append('p').text("Choose one of the markers below, or type the name of your own marker. If more than one marker applies, pick one and then you can add others.");
		
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
								return null;
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
			if (prepareClick('click', 'experience first marker: ' + d.getDescription()))
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
		}
		
		rootObjects.sort(sortByDescription);
		p0.datum(rootObjects);
		var w = p0.append('div').classed('body', true)
				  .append('div')
				  .append('div');
		appendButtons(w, rootObjects, buttonClicked);
	}
	
	p0.node().onDoneClicked = function()
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
	this.onReveal = null;
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
			if (prepareClick('click', 'cancel'))
			{
				hidePanelRight(sitePanel.node());
			}
			d3.event.preventDefault();
		});
	backButton.append("span").text("Cancel");
	
	var addButton = navContainer.appendRightButton()
		.on("click", function()
		{
			if (prepareClick('click', 'add service'))
			{
				if (!dots.getServiceByName(searchInputNode.value))
				{
					var newValue = getObjectByDescription(rootObjects, searchInputNode.value);
					success(new ReportedObject({name: searchInputNode.value, value: newValue}));
				}
				
				hidePanelRight(sitePanel.node());
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
				.style("display", null);
		}
		else
		{
			/* Show the items whose description is this.value */
			panel2Div.selectAll("li")
				.style("display", function(d)
					{
						if (d.getDescription().toLocaleLowerCase().indexOf(val) >= 0)
							return null;
						else
							return "none";
					});
		}
	}

	var searchInputNode = sitePanel.appendSearchBar(textChanged);

	var panel2Div = sitePanel.appendScrollArea();
	
	function buttonClicked(d) {
		if (prepareClick('click', 'pick service: ' + d.getDescription()))
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
	var sitePanelNode = $(this).parents("panel.site-panel")[0];
	var p1 = d3.select(this);
	p1.append('div')
		.classed('table-row', true)
		.append('p').text("Some experiences provide more than one marker, such as being the captain of a soccer team or getting a summer job working with computers. If this opportunity has more than one marker, add other markers here for this experience.");

	var obj = p1.append('div')
		.classed('body', true)
		.append('div')
		.append('section')
		.classed("cell multiple", true);
		
	var labelDiv = obj.append('label')
		.text("Markers");
	
	var itemsDiv = obj.append("ol").classed("items-div panel-fill", true);

	itemsDiv.classed("border-above", true);

	var clickFunction;
	clickFunction = function(d) {
			var _this = this;
			if (prepareClick('click', 'marker: ' + d.getDescription()))
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
						dots.services[dots.services.indexOf(d)] = newReportedObject;
					}
					showPickServicePanel(sitePanelNode, rootObjects, d, dots, success);
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
		
	var buttons = appendRowButtons(divs);

	buttons.on("click", clickFunction);
	
	appendDeleteControls(buttons);

	appendRightChevrons(buttons);
		
	appendButtonDescriptions(buttons);
	
	/* Add one more button for the add Button item. */
	var buttonDiv = p1.append("div").classed("table-row", true)
		.append("button").classed("btn row-button multi-row-content site-active-text border-above border-below", true)
		.on("click", function(cell) {
			var _thisButton = this;
			if (prepareClick('click', 'add marker'))
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
						var buttons = appendRowButtons(divs);
						buttons.on("click", clickFunction);
						appendDeleteControls(buttons);
						appendRightChevrons(buttons);
						appendButtonDescriptions(buttons);
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
	buttonDiv.append("span").text(" add marker");
	
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
	var itemsDiv = w.append("section")
		.classed("multiple", true)
		.append("ol")
		.classed("items-div", true);
			  
	var startVal;
	
	var _this = this;

	var done = function(orgs)
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
				
		if (searchInput.node().value.toLocaleLowerCase().trim() == startVal)
		{
			function buttonClicked(d)
			{
				if (prepareClick('click', 'experience organization: ' + d.getDescription()))
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
				}
				d3.event.preventDefault();
			}

			var i = 0;
			var items = itemsDiv.selectAll("li")
				.data(orgs, function(d) {
					/* Ensure that this operation appends without replacing any items. */
					i += 1;
					return i;
				  })
				.enter()
				.append("li");	// So that each button appears on its own row.

			appendViewButtons(items, appendDescriptions)
				.on("click", buttonClicked);
		}
	}
	
	function textChanged()
	{
		var val = this.value.toLocaleLowerCase().trim();
		
		itemsDiv.selectAll("li").remove();
		if (val.length > 0)
		{
			startVal = val;
			
			if (val.length < 3)
				_this.getDataChunker.path = '(Organization,Site)[_name^="'+val+'"]';
			else
				_this.getDataChunker.path = '(Organization,Site)[_name*="'+val+'"]';
			
			_this.getDataChunker.fields = ["parents"];
			_this.getDataChunker.clearLoadingMessage();
			_this.getDataChunker.start();			
		}
	}
	
	var lastText = "";	
	$(searchInput.node()).on("keyup input paste", function(e) {
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
	this.getDataChunker = new GetDataChunker(w.node(), done);
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
					if (prepareClick('click', 'experience site: ' + d.getDescription()))
					{
						dots.site = d;
						dots.siteName = d.getDescription();
			
						searchInput.node().value = d.getDescription();
						$(searchInput.node()).trigger("input");
						dots.setValue(dots.value + 1);
					}
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
					if (prepareClick('click', 'experience offering: ' + d.getDescription()))
					{
						dots.offering = d;
						dots.offeringName = d.getDescription();
			
						searchInput.node().value = d.getDescription();
						$(searchInput.node()).trigger("input");
						dots.setValue(dots.value + 1);
					}
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
	
	var p = d3.select(this)
		.classed('confirm-experience', true);
	
	p.append('div')
		.classed('table-row', true)
		.append('p').text("Add this experience to your pathway?");

	var summary = p.append('div')
		.classed('summary body', true)
		.append('div')
		.append('div');
	if (dots.offeringName)
		summary.append('header').text(dots.offeringName);
	
	orgDiv = summary.append('div').classed("organization", true);		
	if (dots.organizationName)
		orgDiv.append('div').text(dots.organizationName);
			
	if (dots.siteName)
		orgDiv.append('div')
			.classed('address-line', true)
			.text(dots.siteName);
	
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
		{
			var section = summary.append('section')
				.classed('cell view unique', true);
			section.append('ol').classed('items-div', true)
				.append('li')
				.append('div').classed('string-value-view', true)
				.text(t);
			section.append('div').classed('cell-border-below', true);
		}
	}

	if (dots.services.length > 0)
	{
		var servicesDiv = summary.append('section')
			.classed('cell view multiple', true);
		
		servicesDiv.append('label').text("Markers");
		servicesDiv.append('ol')
			.classed('items-div', true)
			.selectAll('li')
			.data(dots.services)
			.enter()
			.append('li')
			.append('div')
			.classed('multi-line-item', true)
			.append('div')
			.classed('description-text string-value-view', true)
			.text(function(d) { return d.getDescription(); });
		servicesDiv.append('div').classed("cell-border-below", true);
	}
}

/* 
	objectData contains the MoreExperiences object.
 */
var AddExperiencePanel = (function () {
	AddExperiencePanel.prototype = new SitePanel();
	
	function AddExperiencePanel(pathway, objectData, previousPanelNode) {
		var header = "Add Experience";
		SitePanel.call(this, previousPanelNode, null, header, "edit new-experience-panel");
			
		var navContainer = this.appendNavContainer();

		var panel2Div = this.appendScrollArea()
			.classed("vertical-scrolling", false)
			.classed("no-scrolling", true);
		
		var dots = new DotsNavigator(panel2Div, 8);	
		dots.finalText = "Add";	

		var _thisPanel = this;
		var hideSuccessFunction = function()
			{
				bootstrap_alert.show($('.alert-container'), "Adding Experience To Your Pathway...", "alert-info");

				var moreExperiencesObject = pathway.userInstance.getValue("More Experiences");
				
				function successFunction3(newData)
				{
					newData.checkCells([],
						function() {
							pathway.addMoreExperience.call(pathway, newData);
							_thisPanel.hidePanelDown();
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
						initialData["Start"] = [startDate];
					if (endDate.length > 0)
						initialData["End"] = [endDate];
						
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
		dots.appendBackButton(navContainer, function() {
			_thisPanel.hidePanelDown();
		});
		
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
			
			$(dots.startDateInput).on('change', function(eventObject) {
				dots.checkForwardEnabled();
			});
			
			this.onCheckForwardEnabled = function()
			{
				return dots.startDateInput.year && dots.startDateInput.month;
			}	
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
		
		dots.nthPanel(0).onReveal = setupPanel2;
		dots.nthPanel(1).onReveal = setupPanel3;
		dots.nthPanel(2).onReveal = setupPanel4;
		dots.nthPanel(3).onReveal = setupPanel5;
		dots.nthPanel(4).onReveal = setupPanel6;
		dots.nthPanel(5).onReveal = setupFirstMarkerPanel;
		dots.nthPanel(6).onReveal = setupServicesPanel;
		dots.nthPanel(7).onReveal = setupConfirmPanel;
				
		showPanelUp(this.node());
		dots.showDots();
	}
	
	return AddExperiencePanel;
})();

var PathwayPanel = (function () {
	PathwayPanel.prototype = new SitePanel();
	PathwayPanel.prototype.pathway = null;
	
	function PathwayPanel(userInstance, previousPanel) {
		SitePanel.call(this, previousPanel, null, "My Pathway", "edit pathway");
		var navContainer = this.appendNavContainer();
		
		var backButton = navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent);
		backButton.append("span").text("Done");
		var _this = this;
		
		var addExperienceButton = navContainer.appendRightButton()
			.classed('add-button', true)
			.on("click", function(d) {
				if (prepareClick('click', 'add experience'))
				{
					showClickFeedback(this);
		
					var newPanel = new AddExperiencePanel(_this.pathway, null, _this.node());
				}
				d3.event.preventDefault();
			});
		addExperienceButton.append("span").text("+");
		
		var panel2Div = this.appendFillArea();
		showPanelLeft(this.node());
		this.pathway = new Pathway(userInstance, this, panel2Div.node(), true);
	}
	
	return PathwayPanel;
})();

var ExperienceDetailPanel = (function () {
	ExperienceDetailPanel.prototype = new SitePanel();
	ExperienceDetailPanel.prototype.experience = null;
	
	ExperienceDetailPanel.prototype.setupTarget = function(targetNode, d, cellName, update)
	{
		var pickDatum = d.getCell(cellName).data[0];
		
		$(pickDatum).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, targetNode, update);
		
		$(targetNode).on("remove", function() {
			$(pickDatum).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, update);
		});
		update.call(this, {data: targetNode});
	}
	
	ExperienceDetailPanel.prototype.setupPickOrCreateTarget = function(targetNode, experience, pickedName, createName, update)
	{
		var pickDatum = experience.getCell(pickedName).data[0];
		var createCell = experience.getCell(createName);
		var createDatum = createCell ? createCell.data[0] : null;
		
		$(pickDatum).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, targetNode, update);
		if (createDatum)
			$(createDatum).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, targetNode, update);
		
		$(targetNode).on("remove", function() {
			$(pickDatum).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, update);
			if (createDatum)
				$(createDatum).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, update);
		});
		update.call(this, {data: targetNode});
	}
	
	function ExperienceDetailPanel(experience, previousPanel) {
		
		SitePanel.call(this, previousPanel, experience, "Offering", "view session");
		this.experience = experience;
		
		var navContainer = this.appendNavContainer();
		
		var backButton = navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent);
		backButton.append("span").text("Done");
		var _this = this;
		
		if (experience.typeName == "More Experience")
		{
			var editButton = navContainer.appendRightButton()
				.on("click", function(d) {
					if (prepareClick('click', 'edit experience: ' + experience.getDescription()))
					{
						showClickFeedback(this);
				
						var panel = new EditExperiencePanel(experience, _this.node());
					}
					d3.event.preventDefault();
				});
			editButton.append("span").text("Edit");
			
			var node = this.node();
			var f = function(eventObject)
				{
					d3.select(eventObject.data).remove();
				};
			$(experience).one("valueDeleted.cr", null, node, f);
			$(node).on("remove", null, function(eventObject)
				{
					$(experience).off("valueDeleted.cr", null, f);
				});
		}
		
		var panel2Div = this.appendScrollArea();
		
		var headerDiv = panel2Div.appendHeader();
		this.setupPickOrCreateTarget(headerDiv.node(), experience, "Offering", "User Entered Offering",
			function() {
			var offering = _pickedOrCreatedValue(experience, "Offering", "User Entered Offering");
			headerDiv.text(offering);
		});
		
		var orgDiv = panel2Div.appendSection(experience);
		orgDiv.classed("organization", true);

		var organizationNameDiv = orgDiv.append("label");
		this.setupPickOrCreateTarget(organizationNameDiv.node(), experience, "Organization", "User Entered Organization", 
			function(eventObject) {
				var organization = _pickedOrCreatedValue(experience, "Organization", "User Entered Organization");
				d3.select(eventObject.data).text(organization);
			});

		var siteNameDiv = orgDiv.append('div')
				.classed("address-line", true);
		this.setupPickOrCreateTarget(siteNameDiv.node(), experience, "Site", "User Entered Site", function() {
			var organization = _pickedOrCreatedValue(experience, "Organization", "User Entered Organization");
			var siteDescription = _pickedOrCreatedValue(experience, "Site", "User Entered Site");
			if (siteDescription && siteDescription.length > 0 && (siteDescription !== organization))
				siteNameDiv.text(siteDescription);
			else
				siteNameDiv.text(null);
		});
		
		var siteAddressDiv = orgDiv.append('div');
		this.setupTarget(siteAddressDiv.node(), experience, "Site",
			function() {
				siteAddressDiv.selectAll('div').remove();
				var site = experience.getValue("Site");
				if (site && site.getValueID())
				{
					crp.pushCheckCells(site, function()
						{
							var address = site.getValue("Address");
							crp.pushCheckCells(address, function()
							{
								var streetCell = address.getCell("Street");
								var cityCell = address.getCell("City");
								var stateCell = address.getCell("State");
								var zipCell = address.getCell("Zip Code");
								if (streetCell)
									$(streetCell.data).each(function() {
										siteAddressDiv.append('div')
											.classed("address-line", true)
											.text(this.value);
									});
								line = "";
								if (cityCell && cityCell.data.length)
									line += cityCell.data[0].value;
								if (stateCell && stateCell.data.length)
									line += ", " + stateCell.data[0].getDescription();
								if (zipCell && zipCell.data.length && zipCell.data[0].value)
									line += "  " + zipCell.data[0].value;
								if (line.trim())
									siteAddressDiv.append('div')
										.classed('address-line', true)
										.text(line.trim());
							},
							function() {
							});
						},
						function() { }
					);
				}
			});
		
		var firstDiv = null;
		var nextDiv;
		
		panel2Div.showViewCells([experience.getCell("Start"),
								 experience.getCell("End")]);

		var cellDiv = panel2Div.append("section")
			.classed("cell view multiple", true);
		
		var offering = experience.getValue("Offering");
		var offeringServiceCell = ((offering && offering.getValueID()) ? offering.getCell("Service") : null);
		var serviceCell = experience.getCell("Service");
		var userEnteredServiceCell = experience.getCell("User Entered Service");
		var numServices = 0;
		if (serviceCell)
			numServices += serviceCell.data.length;
		if (userEnteredServiceCell)
			numServices += userEnteredServiceCell.data.length;
		if (offeringServiceCell)
			numServices += offeringServiceCell.data.length;
			
		if (numServices > 0)
		{
			var labelDiv = cellDiv.append("label")
				.text("Markers");
			var itemsDiv = cellDiv.append("ol").classed("items-div", true);
			
			var serviceData;
			if (serviceCell)
				serviceData = serviceCell.data;
			else
				serviceData = [];
			if (userEnteredServiceCell)
				serviceData = serviceData.concat(userEnteredServiceCell.data);
			if (offeringServiceCell)
				serviceData = serviceData.concat(offeringServiceCell.data);

			var divs = appendItems(itemsDiv, serviceData);
			var buttons = divs.append("div").classed("multi-line-item", true);
			appendButtonDescriptions(buttons);
			cellDiv.append("div").classed("cell-border-below", true);
		}
		
		if (offering && offering.getValueID())
		{
			var webSiteDiv = panel2Div.append("section");	
			showWebSite(offering, function(newText)
				{
					if (newText)
					{
						var labelDiv = webSiteDiv.append("div")
							.classed("more-info", true);
						var link = labelDiv
							.append("a")
							.classed("site-active-text", true)
							.attr("href", newText)
							.attr("target", "_blank")
							.text("More Info");
					}
				});
		}
		showPanelLeft(this.node());
	}
	
	return ExperienceDetailPanel;
})();

var PickOrCreatePanel = (function () {
	PickOrCreatePanel.prototype = new SitePanel();
	PickOrCreatePanel.prototype.navContainer = null;
	PickOrCreatePanel.prototype.inputBox = null;
	PickOrCreatePanel.prototype.done = null;
	PickOrCreatePanel.prototype.pickDatum = null;
	PickOrCreatePanel.prototype.createDatum = null;
	PickOrCreatePanel.prototype.foundCompareText = null;
	PickOrCreatePanel.prototype.foundObjects = null;
	PickOrCreatePanel.prototype.constrainCompareText = null;
	PickOrCreatePanel.prototype.buttons = null;
	PickOrCreatePanel.prototype.searchTimeout = null;
	
	PickOrCreatePanel.prototype.onClickCancel = function()
	{
		if (prepareClick('click', 'Cancel'))
		{
			this.hide();
		}
		d3.event.preventDefault();
	}
	
	PickOrCreatePanel.prototype.updateValues = function(newValue, newText)
	{
		if (newValue && newValue.getValueID() === this.pickDatum.getValueID())
			this.hide();
		else if (!newValue && newText && newText === this.createDatum.value)
			this.hide();
		else 
		{
			var initialData = [];
			var sourceObjects = [];
			if (newValue)
			{
				this.pickDatum.appendUpdateCommands(0, newValue, initialData, sourceObjects);
				this.createDatum.appendUpdateCommands(0, null, initialData, sourceObjects);
			}
			else
			{
				this.pickDatum.appendUpdateCommands(0, null, initialData, sourceObjects);
				this.createDatum.appendUpdateCommands(0, newText, initialData, sourceObjects);
			}
			
			if (initialData.length > 0)
			{
				var _this = this;
				cr.updateValues(initialData, sourceObjects,
					function () { _this.hide(); },
					syncFailFunction);
			}
			else
				this.hide();
		}
	}
	
	PickOrCreatePanel.prototype.onClickButton = function(d, i) {
		if (prepareClick('click', 'pick ' + d.cell.field.name + ': ' + d.getDescription()))
		{
			this.updateValues(d, null);
		}
		d3.event.preventDefault();
	}
	
	PickOrCreatePanel.prototype.onClickDone = function(d, i) {
		d3.event.preventDefault();

		if (prepareClick('click', 'Done'))
		{
			var newText = this.inputText();
			var compareText = newText.toLocaleLowerCase()
			if (this.foundObjects)
			{
				for (var i = 0; i < this.foundObjects.length; ++i)
				{
					var v = this.foundObjects[i];
					if (v.getDescription().toLocaleLowerCase() === compareText)
					{
						this.updateValues(v, null);
						return;
					}
				}
			}

			if (newText.length == 0)
			{
				this.updateValues(null, null);
			}
			else
			{
			var _this = this;
				function done(newInstances)
				{
					if (newInstances.length == 0)
						_this.updateValues(null, newText);
					else
						_this.updateValues(newInstances[0], null);
				}
			
				cr.selectAll({path: this.pickDatum.cell.field.ofKindID+'[_name='+'"'+newText+'"]', 
					end: 50, done: done, fail: syncFailFunction});
			}
		}
	}
	
	PickOrCreatePanel.prototype.getTitle = function()
	{
		return this.pickDatum.cell.field.name;
	}
	
	PickOrCreatePanel.prototype.constrainFoundObjects = function(val)
	{
		if (val !== undefined)
			this.constrainCompareText = val;
		if (this.buttons != null)
		{
			if (this.constrainCompareText != this.foundCompareText)
			{
				var _this = this;
				this.buttons.style("display", function(d) 
					{ 
						if (d.getDescription().toLocaleLowerCase().indexOf(_this.constrainCompareText) >= 0)
							return null;
						else
							return "none";
					});
			}
			else
				this.buttons.style("display", null);
		}
	}
	
	PickOrCreatePanel.prototype.clearListPanel = function()
	{
		this.listPanel.selectAll("section").remove();
		this.listPanel.selectAll("p").remove();
	}
	
	PickOrCreatePanel.prototype.showObjects = function(foundObjects)
	{
		function sortByDescription(a, b)
		{
			return a.getDescription().localeCompare(b.getDescription());
		}
		foundObjects.sort(sortByDescription);
		
		this.clearListPanel();
		var _this = this;
		var sections = this.listPanel.appendSections(foundObjects);
		this.buttons = appendViewButtons(sections)
			.on("click", function(d, i) {
				_this.onClickButton(d, i);
			});
		
		this.constrainFoundObjects();	
			
		if (!this.pickDatum.isEmpty())
		{
			this.buttons.insert("span", ":first-child").classed("glyphicon glyphicon-ok pull-left", 
				function(d) { return d.getDescription() == _this.pickDatum.getDescription(); });
		}
	}
	
	PickOrCreatePanel.prototype.inputText = function()
	{
		return this.inputBox.value.trim()
	}
	
	PickOrCreatePanel.prototype.inputCompareText = function()
	{
		return this.inputText().toLocaleLowerCase();
	}
	
	PickOrCreatePanel.prototype.searchPath = function(val)
	{
		if (val.length == 0)
			/* This case occurs when searching for sites within an organization. */
			return this.pickDatum.cell.field.ofKindID;
		else
		{
			var symbol = (val.length < 3) ? "^=" : "*=";
			return this.pickDatum.cell.field.ofKindID+'[?'+symbol+'"'+val+'"]';
		}
	}
	
	PickOrCreatePanel.prototype.search = function(val)
	{
		this.foundCompareText = val;
		this.constrainCompareText = val;
		this.foundObjects = null;	/* Clear any old object sets. */
			
		var _this = this;	
		function done(foundObjects)
		{
			if (_this.inputCompareText().indexOf(_this.foundCompareText) == 0)
			{
				_this.foundObjects = foundObjects;
				_this.showObjects(foundObjects);
			}
		}
		
		var searchPath = this.searchPath(val);
		if (searchPath && searchPath.length > 0)
			cr.selectAll({path: searchPath, end: 50, done: done, fail: asyncFailFunction});
		else
			done([]);
	}
	
	PickOrCreatePanel.prototype.setupInputBox = function()
	{
		if (!this.createDatum.isEmpty())
		{
			this.inputBox.value = this.createDatum.getDescription();
			$(this.inputBox).trigger("input")
		}
		else if (!this.pickDatum.isEmpty())
		{
			this.inputBox.value = this.pickDatum.getDescription();
			$(this.inputBox).trigger("input");
		}
	}
	
	PickOrCreatePanel.prototype.startSearchTimeout = function(val)
	{
		this.clearListPanel();
		this.listPanel.append('p')
				.classed("help-block", true)
				.text("Loading...");

		var _this = this;
		function endSearchTimeout() {
			_this.searchTimeout = null;
			_this.search(val);
		}
		this.searchTimeout = setTimeout(endSearchTimeout, 300);
	}
	
	PickOrCreatePanel.prototype.textCleared = function()
	{
		this.listPanel.selectAll("section").remove();
		this.listPanel.selectAll("p").remove();
	}
	
	PickOrCreatePanel.prototype.textChanged = function()
	{
		if (this.searchTimeout != null)
		{
			clearTimeout(this.searchTimeout);
		}
		
		var val = this.inputCompareText();
		if (val.length == 0)
		{
			this.textCleared();
		}
		else if (this.foundCompareText != null && 
				 (this.foundCompareText.length == 0 || val.indexOf(this.foundCompareText) == 0))
		{
			if (this.foundObjects && this.foundObjects.length < 50)
				this.constrainFoundObjects(val);
			else
				this.startSearchTimeout(val);
		}
		else
			this.startSearchTimeout(val);
	}
	
	function PickOrCreatePanel(previousPanelNode, pickDatum, createDatum, done)
	{
		if (previousPanelNode === undefined)
		{
			SitePanel.call(this);
		}
		else
		{
			SitePanel.call(this, previousPanelNode, pickDatum, pickDatum.cell.field.name, "list");
			this.pickDatum = pickDatum;
			this.createDatum = createDatum;
			this.done = done;
			this.navContainer = this.appendNavContainer();

			var _this = this;
			var backButton = this.navContainer.appendLeftButton()
				.on("click", function()
				{
					_this.onClickCancel();
				});
			backButton.append("span").text("Cancel");
			
			this.navContainer.appendRightButton()
				.on("click", function()
				{
					_this.onClickDone();
				})
				.append("span").text("Done");

			var title = this.getTitle();
			if (title)
				this.navContainer.appendTitle(title);

			var inputBox = addInput(this.panelDiv, title);
			
			this.inputBox = inputBox.node();
			$(this.inputBox).on("input", function() { _this.textChanged() });

			this.listPanel = this.appendScrollArea();
			this.setupInputBox();

			showPanelLeft(this.node());
		}
	}
	return PickOrCreatePanel;
})();

var PickOrCreateSitePanel = (function () {
	PickOrCreateSitePanel.prototype = new PickOrCreatePanel();
	
	PickOrCreateSitePanel.prototype.searchPath = function(val)
	{
		var organization = this.pickDatum.cell.parent.getCell("Organization").data[0];
		
		if (organization.getValueID())
		{
			return "#"+organization.getValueID()+">Sites>"+PickOrCreatePanel.prototype.searchPath.call(this, val);
		}
		else
			return "";
	}
	
	PickOrCreateSitePanel.prototype.textCleared = function()
	{
		var organization = this.pickDatum.cell.parent.getCell("Organization").data[0];
		
		if (organization.getValueID())
		{
			this.startSearchTimeout("");
		}
	}
	
	function PickOrCreateSitePanel(previousPanelNode, pickDatum, createDatum, done)
	{
		PickOrCreatePanel.call(this, previousPanelNode, pickDatum, createDatum, done);
		var organization = this.pickDatum.cell.parent.getCell("Organization").data[0];
		
		if (organization.getValueID() && this.createDatum.value == null)
		{
			this.search("");
		}
	}
	
	return PickOrCreateSitePanel;
})();

var PickOrCreateOfferingPanel = (function () {
	PickOrCreateOfferingPanel.prototype = new PickOrCreatePanel();
	
	PickOrCreateOfferingPanel.prototype.searchPath = function(val)
	{
		var site = this.pickDatum.cell.parent.getCell("Site").data[0];
		
		if (site.getValueID())
		{
			return "#"+site.getValueID()+">Offerings>"+PickOrCreatePanel.prototype.searchPath.call(this, val);
		}
		else
			return "";
	}
	
	PickOrCreateOfferingPanel.prototype.textCleared = function()
	{
		var site = this.pickDatum.cell.parent.getCell("Site").data[0];
		
		if (site.getValueID())
		{
			this.startSearchTimeout("");
		}
	}
	
	function PickOrCreateOfferingPanel(previousPanelNode, pickDatum, createDatum, done)
	{
		PickOrCreatePanel.call(this, previousPanelNode, pickDatum, createDatum, done);
		var site = this.pickDatum.cell.parent.getCell("Site").data[0];
		
		if (site.getValueID() && this.createDatum.value == null)
		{
			this.search("");
		}
	}
	
	return PickOrCreateOfferingPanel;
})();

var PickOrCreateCell = (function () {
	PickOrCreateCell.prototype = new cr.Cell();
	PickOrCreateCell.prototype.pickCell = null;
	PickOrCreateCell.prototype.createCell = null;
	PickOrCreateCell.prototype.editPanel = null;
	
	PickOrCreateCell.prototype.getDescription = function()
	{
		if (this.pickCell.data.length > 0 && !this.pickCell.data[0].isEmpty())
			return this.pickCell.data[0].getDescription();
		else if (this.createCell.data.length > 0 && !this.createCell.data[0].isEmpty())
			return this.createCell.data[0].getDescription();
		else
			return "";
	}
	
	PickOrCreateCell.prototype.isEmpty = function()
	{
		return this.pickCell.isEmpty() && this.createCell.isEmpty();
	}
	
	PickOrCreateCell.prototype.pickedObject = function(d)
	{
		if (pickedObject.getValueID() == this.pickCell.data[0].getValueID())
			this.editPanel.hide();
		else
		{
			var initialData = [];
			var sourceObjects = [];
			this.editPanel.appendUpdateCommands(initialData, sourceObjects);
			if (initialData.length > 0)
			{
				cr.updateValues(initialData, sourceObjects, 
					function() {
						this.editPanel.hide();
					}, 
					syncFailFunction);
			}
			else
				this.editPanel.hide();
		}
	}

	PickOrCreateCell.prototype.showPickOrCreatePanel = function(previousPanelNode)
	{
		var pickDatum = this.pickCell.data[0];
		var createDatum = this.createCell.data[0];
		
		var done = function(d, i)
		{
			_this.pickedObject(d);
		}
		this.editPanel = new PickOrCreatePanel(previousPanelNode, pickDatum, createDatum, done);
	}
	
	PickOrCreateCell.prototype.showValueAdded = function()
	{
		/* getOnValueAddedFunction(true, true, showEditObjectPanel)); */
	}
	
	PickOrCreateCell.prototype.pushTextChanged = function(textNode)
	{
		var pickValue = this.pickCell.data[0];
		var createValue = this.createCell.data[0];
		
		var _this = this;
		var f = function(eventObject)
		{
			d3.select(eventObject.data).text(_this.getDescription());
		}
		$(pickValue).on("valueAdded.cr dataChanged.cr valueDeleted.cr", null, textNode, f);
		$(createValue).on("valueAdded.cr dataChanged.cr valueDeleted.cr", null, textNode, f);
		$(textNode).on("remove", null, null, function() {
			$(pickValue).off("valueAdded.cr dataChanged.cr valueDeleted.cr", null, f);
			$(createValue).off("valueAdded.cr dataChanged.cr valueDeleted.cr", null, f);
		});
	}
	
	PickOrCreateCell.prototype.showEdit = function(obj, containerPanel)
	{
		var sectionDiv = d3.select(obj);

		var labelDiv = sectionDiv.append("label")
			.text(this.field.name);
		var itemsDiv = sectionDiv.append("ol")
			.classed("items-div", true)
			.classed("right-label", true);

		var _this = this;

		sectionDiv.classed("btn row-button", true)
			.on("click", function(cell) {
				if (prepareClick('click', 'pick or create cell: ' + _this.getDescription()))
				{
					var sitePanelNode = $(this).parents(".site-panel")[0];
					_this.showPickOrCreatePanel(sitePanelNode);
				}
			});

		$(itemsDiv.node()).on("valueAdded.cr", function()
			{
				_this.showValueAdded();
			});

		var divs = appendItems(itemsDiv, [this]);
	
		var buttons = appendRowButtons(divs);

		appendRightChevrons(buttons);	
		
		appendButtonDescriptions(buttons)
			.each(function(d)
				{
					_this.pushTextChanged(this);
				});
	}

	function PickOrCreateCell(pickCell, createCell)
	{
		if (pickCell === undefined)
		{
			cr.Cell.call(this);
		}
		else
			{
			var field = {
				name: pickCell.field.name,
				capacity: "_unique value",
			}
			cr.Cell.call(this, field);
			this.pickCell = pickCell;
			this.createCell = createCell;
		}
	}

	return PickOrCreateCell;
})();

var PickOrCreateOrganizationCell = (function () {
	PickOrCreateOrganizationCell.prototype = new PickOrCreateCell();
	PickOrCreateOrganizationCell.prototype.experience = null;
	
	function PickOrCreateOrganizationCell(experience)
	{
		PickOrCreateCell.call(this, 
							  experience.getCell("Organization"),
							  experience.getCell("User Entered Organization"));
		this.experience = experience;
	}
	
	return PickOrCreateOrganizationCell;
})();

var PickOrCreateSiteCell = (function () {
	PickOrCreateSiteCell.prototype = new PickOrCreateCell();
	PickOrCreateSiteCell.prototype.experience = null;
	
	PickOrCreateSiteCell.prototype.showPickOrCreatePanel = function(previousPanelNode)
	{
		var pickDatum = this.pickCell.data[0];
		var createDatum = this.createCell.data[0];
		
		var done = function(d, i)
		{
			_this.pickedObject(d);
		}
		this.editPanel = new PickOrCreateSitePanel(previousPanelNode, pickDatum, createDatum, done);
	}
	
	function PickOrCreateSiteCell(experience)
	{
		PickOrCreateCell.call(this, 
							  experience.getCell("Site"),
							  experience.getCell("User Entered Site"));
		this.experience = experience;
	}
	
	return PickOrCreateSiteCell;
})();

var PickOrCreateOfferingCell = (function () {
	PickOrCreateOfferingCell.prototype = new PickOrCreateCell();
	PickOrCreateOfferingCell.prototype.experience = null;
	
	PickOrCreateOfferingCell.prototype.showPickOrCreatePanel = function(previousPanelNode)
	{
		var pickDatum = this.pickCell.data[0];
		var createDatum = this.createCell.data[0];
		
		var done = function(d, i)
		{
			_this.pickedObject(d);
		}
		this.editPanel = new PickOrCreateOfferingPanel(previousPanelNode, pickDatum, createDatum, done);
	}
	
	function PickOrCreateOfferingCell(experience)
	{
		PickOrCreateCell.call(this, 
							  experience.getCell("Offering"),
							  experience.getCell("User Entered Offering"));
		this.experience = experience;
	}
	
	return PickOrCreateOfferingCell;
})();

var ConfirmAlert = (function () {

	function ConfirmAlert(panelNode, confirmText, done, cancel)
	{
		var panel = d3.select(panelNode).append('panel')
			.classed("confirm", true);
		var div = panel.append('div');
		var confirmButton = div.append('button')
			.text(confirmText)
			.classed("text-danger", true)
			.on("click", function()
				{
					if (prepareClick('click', confirmText))
					{
						$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
							panel.remove();
							done();
						});
					}
				});
		div.append('button')
			.text("Cancel")
			.on("click", function()
				{
					if (prepareClick('click', 'Cancel'))
					{
						$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
							panel.remove();
							cancel();
						});
					}
				});
		
		$(panel.node()).toggle("slide", {direction: "down", duration: 0});
		$(panel.node()).effect("slide", {direction: "down", duration: 400, complete: 
			function() {
				$(confirmButton.node()).focus();
				unblockClick();
			}});
		$(confirmButton.node()).on('blur', function()
			{
				if (prepareClick('blur', confirmText))
				{
					$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
						panel.remove();
						cancel();
					});
				}
			});
		$(panel.node()).mousedown(function(e)
			{
				e.preventDefault();
			});
	}
	
	return ConfirmAlert;
})();

var EditExperiencePanel = (function () {
	EditExperiencePanel.prototype = new SitePanel();
	EditExperiencePanel.prototype.experience = null;
	
	EditExperiencePanel.prototype.handleDeleteButtonClick = function()
	{
		if (prepareClick('click', 'delete experience'))
		{
			var _this = this;
			new ConfirmAlert(this.node(), "Delete Experience", 
				function() { 
					_this.datum().deleteValue(
						function() { _this.hidePanelDown() },
						syncFailFunction);
				}, 
				function() { 
					unblockClick();
				});
		}
	}
	
	function EditExperiencePanel(experience, previousPanel) {
		SitePanel.call(this, previousPanel, experience, "Edit Experience", "edit session", revealPanelUp);
		var navContainer = this.appendNavContainer();
		var panel2Div = this.appendScrollArea();
		var bottomNavContainer = this.appendBottomNavContainer();

		navContainer.appendRightButton()
			.on("click", panel2Div.handleDoneEditingButton)
			.append("span").text("Done");

		navContainer.appendTitle("Edit Experience");
		
		var _this = this;
		bottomNavContainer.appendRightButton()
			.on("click", 
				function() {
					_this.handleDeleteButtonClick();
				})
			.append("span").classed("text-danger", true).text("Delete");
			
		cells = [new PickOrCreateOrganizationCell(experience),
				 new PickOrCreateSiteCell(experience),
				 new PickOrCreateOfferingCell(experience),
				 experience.getCell("Start"),
				 experience.getCell("End"),
				 experience.getCell("Service"),
				];
				
		panel2Div.showEditCells(cells);
									  
		revealPanelUp(this.node());
	}
	
	return EditExperiencePanel;
})();

