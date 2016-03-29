/* showPathtree.js */

var FlagData = (function() {
	FlagData.prototype.experience = null;
	FlagData.prototype.x = null;
	FlagData.prototype.y = null;
	FlagData.prototype.height = null;
	FlagData.prototype.width = null;
	
	FlagData.prototype.getDescription = function()
	{
		return this.experience.getDescription();
	}
	
	FlagData.prototype.pickedOrCreatedValue = function(pickedName, createdName)
	{
		return getPickedOrCreatedValue(this.experience, pickedName, createdName);
	}

	function FlagData(experience)
	{
		this.experience = experience;
		this.y = null;
		this.x = null;
		this.height = null;
		this.width = null;
	}
	return FlagData;
})();

var Pathtree = (function () {
	Pathtree.prototype.dataTopMargin = 5;
	Pathtree.prototype.dataBottomMargin = 5;
	Pathtree.prototype.dataLeftMargin = 40;			/* The space between the left margin and the beginning of the flags */
	Pathtree.prototype.textLeftMargin = 3;
	Pathtree.prototype.textRightMargin = 3;
	Pathtree.prototype.textBottomBorder = 3;
	Pathtree.prototype.flagsLeftMargin = 14;
	Pathtree.prototype.flagsRightMargin = 14;
	Pathtree.prototype.flagSpacing = 5;
	Pathtree.prototype.stemHeight = 3;
	Pathtree.prototype.otherColor = "#bbbbbb";
	Pathtree.prototype.textDetailLeftMargin = 10; /* textLeftMargin; */
	Pathtree.prototype.textDetailRightMargin = 10; /* textRightMargin; */
	Pathtree.prototype.detailTextSpacing = 2;		/* The space between lines of text in the detail box. */
	Pathtree.prototype.pathBackground = "white";
	Pathtree.prototype.showDetailIconWidth = 18;
	
	Pathtree.prototype.user = null;
	Pathtree.prototype.allExperiences = [];
	Pathtree.prototype.sitePanel = null;
	Pathtree.prototype.containerDiv = null;
	Pathtree.prototype.pathwayContainer = null;
	Pathtree.prototype.timeContainer = null;
	Pathtree.prototype.svg = null;
	Pathtree.prototype.svgTime = null;
	Pathtree.prototype.loadingMessage = null;
	Pathtree.prototype.defs = null;
	Pathtree.prototype.bg = null;
	Pathtree.prototype.bgTime = null;
	Pathtree.prototype.loadingText = null;
	Pathtree.prototype.promptAddText = null;
	Pathtree.prototype.experienceGroup = null;
	Pathtree.prototype.yearGroup = null;
	Pathtree.prototype.detailGroup = null;
	Pathtree.prototype.detailBackRect = null;
	Pathtree.prototype.detailFrontRect = null;
	
	Pathtree.prototype.detailFlagData = null;
	Pathtree.prototype.flagElement = null;
	Pathtree.prototype.flagHeight = 0;
	Pathtree.prototype.flagWidth = 0;
	
	Pathtree.prototype.minDate = null;
	Pathtree.prototype.maxDate = null;
	Pathtree.prototype.timespan = 0;
	Pathtree.prototype.isLayoutDirty = true;
	Pathtree.prototype.isMinHeight = false;
	Pathtree.prototype.dayHeight = 0;
	Pathtree.prototype.years = [];
	
	Pathtree.prototype.nextClipID = 1;
	Pathtree.prototype.clipID = null;
	
	//This is the accessor function we talked about above
	Pathtree.prototype._lineFunction = d3.svg.line()
		.x(function(d) { return d.x; })
		.y(function(d) { return d.y; })
		.interpolate("linear");

	Pathtree.prototype.getService = function(experience)
	{
		var offering = experience.getValue("Offering");
		if (offering && offering.getValueID())
		{
			var service = offering.getValue("Service");
			if (service)
				return service;
		}
		return experience.getValue("Service");
	}
	
	Pathtree.prototype.getServiceDomain = function(experience)
	{
		var service = this.getService(experience);
		return service && crp.getInstance(service.getValueID()).getValue("Service Domain")
	}

	Pathtree.prototype._compareExperiences = function(a, b, ordered)
	{
		var aServiceDomain = this.getServiceDomain(a);
		var bServiceDomain = this.getServiceDomain(b);
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
			var aOrder = ordered.indexOf(aDescription);
			var bOrder = ordered.indexOf(bDescription);
			if (aOrder < 0) 
			{
				ordered.push(aDescription);
				aOrder = ordered.length;
			}
			if (bOrder < 0)
			{
				ordered.push(bDescription);
				bOrder = ordered.length;
			}
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

	Pathtree.prototype.DateToY = function(d)
	{
		var daySpan = (new TimeSpan(d-this.minDate)).days;
		return this.dataTopMargin + (this.timespan - daySpan) * this.dayHeight;
	}

	Pathtree.prototype.getExperienceY = function(fd)
	{
		return this.DateToY(Date.parse(getEndDate(fd.experience)));
	}

	Pathtree.prototype.getExperienceHeight = function(experience)
	{
		var startDate = getStartDate(experience);
		var endDate = getEndDate(experience);
		var days = (new TimeSpan(Date.parse(endDate)-Date.parse(startDate))).days;
		return days * this.dayHeight;
	}

	Pathtree.prototype.getExperiencePath = function(g, fd)
	{
		var h = fd.height;
		var x1 = 0;
		var x2 = x1 + fd.width;
		var y1 = 0;
		var y4 = y1 + h;
		return this._lineFunction([{x: x1, y: y1}, 
							 {x: x2, y: y1}, 
							 {x: x2, y: y4}, 
							 {x: x1, y: y4}, 
							 {x: x1, y: y1}]);
	}
	
	Pathtree.prototype.clearLayout = function()
	{
		/* Do whatever it takes to force layout when checkLayout is called. */
		this.isLayoutDirty = true;
	}
	
	Pathtree.prototype.truncatedText = function(text, textNode, maxWidth)
	{
		var t = d3.select(textNode);
		t.text(text);
		if (text.length <= 1)
			return;
		else if (textNode.getBBox().width <= maxWidth)
			return;
		
		var testText = text.slice(0, -1);
		while (testText.length > 0)
		{
			t.text(testText + "...");
			if (textNode.getBBox().width <= maxWidth)
				return;
			testText = testText.slice(0, -1);
		}
		t.text("...");
	}
	
	Pathtree.prototype.scaleDayHeightToSize = function()
	{
		var containerHeight = $(this.svg.node()).height();
		var dataHeight = containerHeight - this.dataTopMargin - this.dataBottomMargin;
		var oldDayHeight = this.dayHeight;
		this.dayHeight = dataHeight / this.timespan;
		return oldDayHeight != this.dayHeight;
	}
	
	Pathtree.prototype.getRectOverlap = function(r1, r2)
	{
		if (r1 == r2)
			return 0;
			
// 		var c1 = r1.x + r1.width / 2;
// 		var c2 = r2.x + r2.width / 2;
// 		var dx = Math.abs(c1 - c2);
// 		var maxX = (r1.width + r2.width)/2 + this.flagSpacing;
//   		var y_overlap = Math.max(0, Math.min(r1.y + r1.height,r2.y + r2.height) - Math.max(r1.y,r2.y));
// 		
// 		if (dx > maxX || y_overlap == 0)
// 			return 0;	/* cutoff */
// 		return Math.acos(dx / maxX) / Math.PI * 2 * y_overlap * 16;
			
		var x_overlap = Math.max(0, Math.min(r1.x + r1.width,r2.x + r2.width) - Math.max(r1.x,r2.x));
  		var y_overlap = Math.max(0, Math.min(r1.y + r1.height,r2.y + r2.height) - Math.max(r1.y,r2.y));
  		if (x_overlap == r2.width)
  			x_overlap += (r1.x + r1.width) - (r2.x + r2.width);
  		else if (x_overlap == r1.width)
  			x_overlap += (r2.x + r2.width) - (r1.x + r1.width);
  		
  		if (x_overlap * y_overlap > 0)
  			return x_overlap * y_overlap;
  		
  		if (x_overlap == 0 && y_overlap > 0)
  		{
			var x_distance = Math.max(r1.x,r2.x) - Math.min(r1.x + r1.width,r2.x + r2.width);
			if (x_distance <= this.flagSpacing)
				return Math.acos((x_distance * x_distance) / (this.flagSpacing * this.flagSpacing)) * 8;
			if (x_distance <= 32)
			{
				var n = 32 - x_distance;
				var d = 32 - this.flagSpacing;
				return Math.acos((n * n) / (d * d)) * 4;
			}
			else
				return Math.PI * 2;	/* For numbers > 32, use the value at 32. */
		}
		else
			return 0;
	}
	
	Pathtree.prototype.getXBoundEnergy = function(fi)
	{
		if (fi.x < 0)
			return 999999999; /* (0 - fi.x) * 1024; */
		else if (fi.x + fi.width > $(this.svg.node()).width())
			return 999999999; /* (fi.x + fi.width - $(this.svg.node()).width()) * 1024; */
		else
			return 0;
	}
	
	Pathtree.prototype.getEnergyX = function(fds, fi)
	{
		var _this = this;
		return fds.map(function (j) { return _this.getRectOverlap(fi, j); })
		 	.reduce(function(a, b) { return a + b; }) +
		 	this.getXBoundEnergy(fi);
	}
	
	/* Get the change in energy of fd[i] when its x value changes by dx. */
	Pathtree.prototype.getDeltaX = function(fds, fi, e0, dx)
	{
		 fi.x += dx;
		 var e2 = this.getEnergyX(fds, fi);
		 fi.x -= dx;
		 return e2 - e0;
	}
	
	Pathtree.prototype.iterate = function(fds, delta)
	{
		var _this = this;
		var e0s = fds.map(function(fi) { return _this.getEnergyX(fds, fi); });
		var dPlus = fds.map(function(fi, i) { return _this.getDeltaX(fds, fi, e0s[i], delta); });
		var dMinus = fds.map(function(fi, i) { return _this.getDeltaX(fds, fi, e0s[i], -delta); });
		var best = {e: 0.0, delta: 0.0, index: -1};
		best = dMinus.reduce(function(previous, current, index)
			{
				if (current < previous.e)
					return {e: current, delta: -delta, index: index};
				else
					return previous;
			}, best);
		best = dPlus.reduce(function(previous, current, index)
			{
				if (current < previous.e)
					return {e: current, delta: delta, index: index};
				else
					return previous;
			}, best);
			
		if (best.e < -0.01)
		{
			fds[best.index]["x"] += best.delta;
			return true;
		}
		else
			return false;
	}
	
	Pathtree.prototype.getEnergy = function(fds)
	{
		/*
			t1 is the area of overlap between two rectangles.
			t2 is the area of an object outside the bounds of the display area.
			t3 is the square of the distance from a fixed edge.
			t4 is the square of the cut-off of the text.
			t5 is the square of the vertical distance of the time middle from the rectangle's middle.
		 */
		 var f1 = 0.0;
		 var f2 = 0.0;
		 var f3 = 0.0;
		 var f4 = 0.0;
		 var f5 = 0.0;
		 var edgeMaxX = $(this.svg.node()).width();
		 var edgeMaxY = $(this.svg.node()).height();
		 fds.sort(function(a, b) {
		 	if (a.x != b.x)
		 		return a.x - b.x;
		 	return 0;
		 });
		 
		 for (var i = 0; i < fds.length - 1; ++i)
		 {
		 	var fi = fds[i];
		 	var maxX = fi.x + fi.width;
		 	var minY = fi.y;
		 	var maxY = fi.y + fi.height;
		 	for (var j = i + 1; i < fds.length; ++j)
		 	{
		 		var fj = fds[j];
		 		if (fj.x > maxX)
		 			break;
		 		if (fj.y > maxY || fj.y + fj.height < minY)
		 			continue;
		 		else {
		 			var overlapX = maxX - fj.x;
		 			var overlapY = fi.height;
		 			if (fj.y > minY)
		 				overlapY -= fj.y - minY;
		 			if (fj.y + fj.height < maxY)
		 				overlapY -= maxY - (fj.y + fj.height);
		 			f += overlapX + overlapY;
		 		}
		 	}
		 	
		 	if (fi.x < 0)
		 		f2 += (fi.x * fi.x);
		 		
		 	if (fi.x + fi.width > edgeMaxX)
		 	{
		 		var delta = fi.x + fi.width - edgeMaxX;
		 		f2 += delta * delta;
		 	}
		 	if (f1.y < 0)
		 		f2 += (f1.y * f1.y);
		 	if (f1.y + f1.height > edgeMaxY)
		 	{
		 		var delta = fi.y + fi.height - edgeMaxY;
		 		f2 += delta * delta;
		 	}
		 	
		 	f3 += (f1.x * f1.x);
		 	
		 	if (f1.width < f1.bestWidth)
		 	{
		 		var delta = f1.bestWidth - f1.width;
		 		f4 += delta * delta;
		 	}
		 	
		 	f5 += Math.pow(f1.bestY - f1.y, 2);
		 }
	}
	
	Pathtree.prototype.drawExperiences = function(g)
	{
		var _this = this;
		g.attr("transform", 
			function(fd)
			{
				return "translate(" + fd.x + "," + fd.y + ")";
			})
			
		if (g.size() > 0)
		{
			/* Transform each text node relative to its containing group. */
// 			g.selectAll('text')
// 				.each(function(fd) { _this.truncatedText(fd.getDescription(), this, 
// 						Math.max(fd.width - _this.textLeftMargin - _this.textRightMargin, 0)); });
			
			/* Calculate the path for each containing group. */
			g.selectAll('rect')
				.attr("width", function(fd) { return fd.width; } )
				.attr("height", function(fd) { return fd.height; });
			g.selectAll('line')
				.attr('y2', function(fd) { return fd.height; });
		}

		/* Hide the detail so that if detail is visible before a resize, it isn't left behind. */	
		if (this.detailFlagData != null)
		{
			this.refreshDetail();
		}
	}
	
	Pathtree.prototype.optimize = function(g)
	{
		var fds = g.data();
		var delta = 32;
		while (delta >= 1)
		{
			while (this.iterate(fds, delta))
			{
				continue;
			}
			delta /= 2;
		}
		this.drawExperiences(g);
	}
	
	/* Lay out all of the contents within the svg object. */
	Pathtree.prototype.layout = function()
	{
		var svgHeight = $(this.svg.node()).height();
		
		this.isMinHeight = (svgHeight == $(this.containerDiv).height());
		$(this.bg.node()).height(svgHeight);
		$(this.bg.node()).width($(this.svg.node()).width());
		$(this.bgTime.node()).height(svgHeight);
		
		this.sitePanel.contractButton
			.classed('disabled', svgHeight <= $(this.containerDiv).height())
			.classed('enabled', svgHeight > $(this.containerDiv).height());
	
		var g = this.experienceGroup.selectAll('g');
		var y = this.yearGroup.selectAll('text');
		
		var _thisPathway = this;
		
		var ordered = ["Housing", "Education", "Extra Curricular", "Wellness", "Career & Finance", "Helping Out"];
		
		/* Restore the sort order to startDate/endDate */
		g.sort(function(a, b)
		{
			return _thisPathway._compareExperiences(a.experience, b.experience, ordered);
		});
	
		var columns = ordered.map(function(d) { return []; }).concat([[]]);

		/* MaxHeight is the maximum height of the top of a column before skipping to the
			next column.
			this represents the SVG group being added. */
		function addToBestColumn(fd, columns)
		{
			var sd = _thisPathway.getServiceDomain(fd.experience);
			if (sd)
			{
				var i = ordered.indexOf(sd.getDescription());
				if (i < 0)
					columns[ordered.length].push(this);
				else
					columns[i].push(this);
			}
			else
				columns[ordered.length].push(this);
		}
		
		/* Compute the y attribute for every item */
		
		/* Fit each item to a column, according to the best layout. */	
		g.each(function(fd, i)
			{
				fd.y = _thisPathway.getExperienceY(fd);
				fd.height = _thisPathway.getExperienceHeight(fd.experience);
				var textNode = d3.select(this).selectAll('text').node();
				if (fd.height < _thisPathway.flagHeight)
				{
					$(textNode).css('font-size', '10px');
					if (fd.height < _thisPathway.smallFlagHeight)
						fd.height = _thisPathway.smallFlagHeight;
					$(textNode).attr('y', 0 - _thisPathway.smallFlagY);
				}
				else
				{
					$(textNode).css('font-size', '');
					$(textNode).attr('y', 0 - _thisPathway.flagY);
				}
				
				fd.width = textNode.getBBox().width + 
							_thisPathway.textLeftMargin + _thisPathway.textRightMargin;
				fd.bestWidth = fd.width;
				fd.bestY = fd.y;
				addToBestColumn.call(this, fd, columns);
			});
		
		/* Compute the column width for each column of flags + spacing to its right. 
			Add flagSpacing before dividing so that the rightmost column doesn't need spacing to its right.
		 */
	
		var flagColumnWidth = ($(this.svg.node()).width() - this.flagsRightMargin + this.flagSpacing) / columns.length;
		this.flagWidth = flagColumnWidth - this.flagSpacing;
		
		/* Compute the x attribute for every item */
		/* Then, Add the items to the flag columns in the column order for better results than
			the current sort order.
		 */
		for (var j = 0; j < columns.length; ++j)
		{
			var x = (flagColumnWidth * j);
			var column = columns[j];
			for (var i = 0; i < column.length; ++i)
			{
				var fd = d3.select(column[i]).datum();
				fd.x = x;
			}
		}
		
		if (this.detailFlagData != null)
		{
			/*( Restore the flagElement */
			 g.each(function(fd)
			 {
				if (fd === _thisPathway.detailFlagData)
					_thisPathway.flagElement = this;
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
				y.attr("display", null);
			else
			{
				// Set the target so that the latest year is always visible.
				var target = (y.size() - 1) % yearPeriod;
				y.attr("display", function(d, i) { if (i % yearPeriod == target) return null; else return "none";});
			}
		}
		
		this.defs.selectAll('clipPath').remove();
		
		/* Add a clipPath for the text box size. */
		this.defs.append('clipPath')
			.attr('id', 'id_detailClipPath{0}'.format(this.clipID))
			.append('rect');
		this.defs.append('clipPath')
			.attr('id', 'id_detailIconClipPath{0}'.format(this.clipID))
			.append('rect');

		/* Here optimize the positions of all of the fd's. */
		/*
			t1 is the area of overlap between two rectangles.
			t2 is the area of an object outside the bounds of the display area.
			t3 is the square of the distance from a fixed edge.
			t4 is the square of the cut-off of the text.
			t5 is the square of the distance of the time middle from the rectangle's middle.
			
			v1 = x
			v2 = y
			v3 = width
		 */
	
		this.optimize(g);
	}

	Pathtree.prototype.checkLayout = function()
	{
		if ($(this.containerDiv).width() === 0)
			return;
		
		if (!this.isLayoutDirty)
			return;
		
		/* Calculate the height of the area where data appears and the height of a single day. */
		var dataHeight = this.dayHeight * this.timespan;
		var svgHeight = dataHeight + this.dataTopMargin + this.dataBottomMargin;
		var containerHeight = $(this.containerDiv).height();
		var containerWidth = $(this.containerDiv).width();

		$(this.svg.node()).height(svgHeight);
		$(this.svgTime.node()).height(svgHeight);
		
		this.layout();
		this.isLayoutDirty = false;
	}
	
	Pathtree.prototype.scale = function(multiple, done)
	{
		var newDataHeight = this.dayHeight * multiple * this.timespan;
		var newContainerHeight = Math.max(newDataHeight + this.dataTopMargin + this.dataBottomMargin, 
										  $(this.containerDiv).height());
										  
		var _this = this;
		$(this.svg.node()).animate({height: newContainerHeight},
		   {duration: 400, easing: "swing",
			progress: function(animation, progress, remainingMs)
				{
					var containerNode = _this.pathwayContainer.node();
					var newContainerHeight = $(_this.svg.node()).height();
					var newContainerWidth = Math.max($(containerNode).width(),
													 newContainerHeight * $(_this.containerDiv).width() / $(_this.containerDiv).height()
														- _this.dataLeftMargin);
					var oldCenter = containerNode.scrollTop + $(containerNode).height() / 2;
					var oldDayHeight = _this.dayHeight;
					$(_this.svg.node()).width(newContainerWidth);
					$(_this.svgTime.node()).height(newContainerHeight);
					if (_this.scaleDayHeightToSize())
					{
						_this.layout();
						var newCenter = (oldCenter - _this.dataTopMargin) * (_this.dayHeight / oldDayHeight) + _this.dataTopMargin;
						if (containerNode.scrollTop > 0)
						{
							containerNode.scrollTop += newCenter - oldCenter;
							_this.timeContainer.node().scrollTop = containerNode.scrollTop;
						}
					}
				},
			 complete: done
			});
	}
	
	Pathtree.prototype.setDateRange = function()
	{
		var birthday = this.user.getValue("Birthday");
		if (birthday && birthday.text)
			this.minDate = new Date(birthday.text);
		else
			this.minDate = new Date();
		
		this.maxDate = new Date();
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
;
	}
	
	Pathtree.prototype.checkDateRange = function(experience)
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
	
	Pathtree.prototype.setColorByService = function(service)
	{
		var serviceInstance = crp.getInstance(service.getValueID());
		var serviceDomain = serviceInstance && serviceInstance.getValue("Service Domain");
		if (serviceDomain && serviceDomain.getValueID())
		{
			var sdInstance = crp.getInstance(serviceDomain.getValueID());
			color = sdInstance.getValue("Color");
			if (color && color.text)
				this.attr("fill", color.text)
					 .attr("stroke", color.text);
		}
		else
			this.attr("fill", otherColor)
				.attr("stroke", otherColor);
	}

	Pathtree.prototype.setColor = function(fd)
	{
		var _this = d3.select(this);

		var offering = fd.experience.getValue("Offering");
		if (offering && offering.getValueID())
		{
			var experienceColor = otherColor;
			var service = offering.getValue("Service");
			if (service)
				Pathtree.prototype.setColorByService.call(_this, service);
			else
				_this.attr("fill", otherColor)
					 .attr("stroke", otherColor);
		}
		else
		{
			var service = fd.experience.getValue("Service");
			if (service && service.getValueID())
				Pathtree.prototype.setColorByService.call(_this, service);
			else
				_this.attr("fill", otherColor)
					 .attr("stroke", otherColor);
		}
	}

	Pathtree.prototype.showDetailPanel = function(fd, i)
	{
		if (prepareClick('click', 'show experience detail: ' + fd.getDescription()))
		{
			var panel = $(this).parents(".site-panel")[0];
			var editPanel = new EditExperiencePanel(fd.experience, panel, revealPanelLeft);
												  
			revealPanelLeft(editPanel.node());
			d3.event.stopPropagation();
		}
	}
	
	Pathtree.prototype.showDetailGroup = function(g, fd, duration)
	{
		duration = (duration !== undefined ? duration : 700);
		var _this = this;
		
		this.detailGroup.datum(fd);
		this.detailGroup.selectAll('rect').datum(fd);
		var detailText = this.detailGroup.append('text')
			.attr("width", "100")
			.attr("height", "1")
			.attr('clip-path', 'url(#id_detailClipPath{0})'.format(this.clipID));
			
		var hasEditChevron = fd.experience.typeName == "More Experience" && fd.experience.canWrite();

		var lines = [];
	
		var s;
		s = fd.pickedOrCreatedValue("Offering", "User Entered Offering");
		if (s && s.length > 0 && lines.indexOf(s) < 0)
		{
			var tspan = detailText.append('tspan')
				.style("font-weight", "bold")
				.text(s)
				.attr("x", this.textDetailLeftMargin)
				.attr("dy", 
					function(d) {
						return $(this).height() + _this.detailTextSpacing;
					});
		}
			
		s = fd.pickedOrCreatedValue("Organization", "User Entered Organization");
		if (s && s.length > 0 && lines.indexOf(s) < 0)
		{
			var tspan = detailText.append('tspan')
				.text(s)
				.attr("x", this.textDetailLeftMargin)
				.attr("dy", 
					function(d) {
						return $(this).height() + _this.detailTextSpacing;
					});
		}

		s = fd.pickedOrCreatedValue("Site", "User Entered Site");
		if (s && s.length > 0 && lines.indexOf(s) < 0)
		{
			var tspan = detailText.append('tspan')
				.classed('address-line', true)
				.text(s)
				.attr("x", this.textDetailLeftMargin);
				
			tspan.attr("dy", 
					function(d) {
						return $(this).height() + _this.detailTextSpacing;
					});
		}

		s = getDateRange(fd.experience);
		if (s && s.length > 0)
		{
			var tspan = detailText.append('tspan')
				.text(s)
				.attr("x", this.textDetailLeftMargin);
				
			tspan.attr("dy", 
					function(d) {
						return $(this).height() + _this.detailTextSpacing;
					});
		}
		
		var x = fd.x;
		var y = fd.y;

		var textBox = detailText.node().getBBox();
		
		var iconAreaWidth = (hasEditChevron ? this.showDetailIconWidth + this.textDetailLeftMargin : 0);
		var maxX = $(this.svg.node()).width() - textBox.width - iconAreaWidth - (this.textDetailLeftMargin * 2);
		if (x > maxX)
			x = maxX;
		var rectWidth = textBox.width + iconAreaWidth + (this.textDetailLeftMargin * 2);
		if (rectWidth < this.flagWidth)
		{
			rectWidth = this.flagWidth;
			textBox.width = rectWidth - iconAreaWidth - (this.textDetailLeftMargin * 2);
		}

		s = getMarkerList(fd.experience);
		if (s && s.length > 0)
		{
			var text = d3.select(this),
				words = s.split(/\s+/).reverse(),
				word,
				line = [],
				tspan = detailText.append("tspan").attr("x", this.textDetailLeftMargin).classed('markers', true);
			while (word = words.pop()) {
			  line.push(word);
			  tspan.text(line.join(" "));
			  if (tspan.node().getComputedTextLength() > textBox.width) {
				line.pop();
				tspan.text(line.join(" "));
				tspan.attr("dy", 
					function(d) {
						return $(this).height() + _this.detailTextSpacing;
					});
				line = [word];
				tspan = detailText.append("tspan").attr("x", this.textDetailLeftMargin).classed('markers', true).text(word);
			  }
			}
			tspan.attr("dy", 
				function(d) {
					return $(this).height() + _this.detailTextSpacing;
				});

			textBox = detailText.node().getBBox();
		}

		var rectHeight = textBox.height + (textBox.y * 2);
		var strokeWidth = parseInt($(this.detailFrontRect.node()).css("stroke-width"));
		var maxY = $(this.svg.node()).height() - rectHeight - strokeWidth;
		if (y > maxY)
			y = maxY;
			
		this.detailGroup.attr("x", x)
				 .attr("y", y)
				 .attr("transform", "translate("+x + "," + y+")")
				 .attr("height", 0);
		this.detailGroup.selectAll('rect')
			.attr("width", rectWidth)
		   .attr("x", textBox.x - this.textDetailLeftMargin)
		   .attr("y", 0);
		this.detailFrontRect.each(this.setColor)
					   .each(this.setupServicesTriggers);
		if (duration > 0)
		{
			this.detailGroup.selectAll('rect').attr("height", 0)
					   .transition()
					   .duration(duration)
					   .attr("height", rectHeight);
		}
		else
		{
			this.detailGroup.selectAll('rect').attr("height", rectHeight);
		}
	   
		/* Set the clip path of the text to grow so the text is revealed in parallel */
		var textClipRect = d3.select("#id_detailClipPath{0}".format(this.clipID)).selectAll('rect')
			.attr('x', textBox.x)
			.attr('y', textBox.y)
			.attr('width', textBox.width); 
		
		var iconClipRect;
		
		if (hasEditChevron)
		{	
			iconClipRect = d3.select("#id_detailIconClipPath{0}".format(this.clipID)).selectAll('rect')
				.attr('x', rectWidth - this.showDetailIconWidth - this.textDetailLeftMargin)
				.attr('y', textBox.y)
				.attr('width', this.showDetailIconWidth);
				
			var detailChevron = this.detailGroup.append('image')
				.attr("width", this.showDetailIconWidth)
				.attr("height", this.showDetailIconWidth)
				.attr("xlink:href", rightChevronPath)
				.attr('clip-path', 'url(#id_detailIconClipPath{0})'.format(this.clipID))

			detailChevron.attr('x', rectWidth - this.showDetailIconWidth - this.textDetailLeftMargin)
				.attr('y', textBox.y + (textBox.height - this.showDetailIconWidth) / 2);
		}
			
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

			if (hasEditChevron)
				iconClipRect.attr('height', 0)
					.transition()
					.duration(duration)
					.attr('height', textBox.height);
		}
		else
		{
			textClipRect.attr('height', textBox.height); 
			detailText.attr("height", textBox.height);
			if (hasEditChevron)
				iconClipRect.attr('height', textBox.height);
		}
		
		this.detailFlagData = fd;
		this.flagElement = g;
		
		var experience = this.detailFlagData.experience;
		[experience.getCell("Organization"),
		 experience.getCell("User Entered Organization"),
		 experience.getCell("Site"),
		 experience.getCell("User Entered Site"),
		 experience.getCell("Start"),
		 experience.getCell("End"),
		 experience.getCell("Service"),
		 experience.getCell("User Entered Service")].forEach(function(d)
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
		[experience.getCell("Service"),
		 experience.getCell("User Entered Service")].forEach(function(d)
		 {
			/* d will be null if the experience came from the organization for the 
				User Entered Organization and User Entered Site.
			 */
			if (d)
			{
				$(d).on("valueDeleted.cr", null, _this, _this.handleChangeDetailGroup);
			}
		 });
		 
	}
	
	Pathtree.prototype.handleChangeDetailGroup = function(eventObject, newValue)
	{
		if (!(eventObject.type == "valueAdded" && newValue && newValue.isEmpty()))
			eventObject.data.refreshDetail();
	}
	
	Pathtree.prototype.clearDetail = function()
	{
		this.detailGroup.selectAll('text').remove();
		this.detailGroup.selectAll('rect').attr('height', 0);
		/* Remove the image here instead of when the other clipPath ends
			so that it is sure to be removed when the done method is called. 
		 */
		this.detailGroup.selectAll('image').remove();
		d3.select("#id_detailClipPath{0}".format(this.clipID)).attr('height', 0);
		d3.select("#id_detailIconClipPath{0}".format(this.clipID)).attr('height', 0);
		
		var _this = this;
		if (this.detailFlagData)
		{
			var experience = this.detailFlagData.experience;
			[experience.getCell("Organization"),
			 experience.getCell("User Entered Organization"),
			 experience.getCell("Site"),
			 experience.getCell("User Entered Site"),
			 experience.getCell("Start"),
			 experience.getCell("End"),
			 experience.getCell("Service"),
			 experience.getCell("User Entered Service")].forEach(function(d)
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
			[experience.getCell("Service"),
			 experience.getCell("User Entered Service")].forEach(function(d)
			 {
				/* d will be null if the experience came from the organization for the 
					User Entered Organization and User Entered Site.
				 */
				if (d)
				{
					$(d).off("valueDeleted.cr", null, _this.handleChangeDetailGroup);
				}
			 });
			 
			 this.detailFrontRect.each(this.clearServicesTriggers);
			 
		}
		
		this.detailGroup.datum(null);
		this.detailGroup.selectAll('rect').datum(null);
		this.detailFlagData = null;
		this.flagElement = null;
	}

	Pathtree.prototype.hideDetail = function(done, duration)
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
				d3.select("#id_detailClipPath{0}".format(this.clipID)).selectAll('rect')
					.transition()
					.attr("height", 0)
					.duration(duration)
					.each("end", function() {
						_this.clearDetail();
						if (done)
							done();
					});
				d3.select("#id_detailIconClipPath{0}".format(this.clipID)).selectAll('rect')
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
	
	Pathtree.prototype.refreshDetail = function()
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
	Pathtree.prototype.setupDelete = function(fd, node) 
	{
		var _this = this;
		var valueDeleted = function(eventObject)
		{
			d3.select(eventObject.data).remove();
			_this.handleValueDeleted(this);
		};
		
		var dataChanged = function(eventObject)
		{
			var g = d3.select(eventObject.data);
			var t = g.selectAll('text');
			t.text(function(d) { return d.getDescription(); })
			fd.width = t.node().getBBox().width + 
						_this.textLeftMargin + _this.textRightMargin;
			g.selectAll('rect').attr("x", 0)
				.attr("y", 0 )
				.attr("width", function(fd) { return fd.width; } )
				.attr("height", function(fd) { return fd.height; });
			_this.checkOfferingCells(this,
				function()
				{
					_this.optimize(_this.experienceGroup.selectAll('g'))
				});
		}
		
		$(fd.experience).one("valueDeleted.cr", null, node, valueDeleted);
		$(fd.experience).on("dataChanged.cr", null, node, dataChanged);
		
		$(node).on("remove", null, fd.experience, function()
		{
			$(eventObject.data).off("valueDeleted.cr", null, valueDeleted);
			$(eventObject.data).off("dataChanged.cr", null, dataChanged);
		});
	}
	
	Pathtree.prototype.handleChangeServices = function(eventObject)
	{
		var rect = d3.select(eventObject.data);
		var experience = rect.datum();
		
		Pathtree.prototype.setColor.call(eventObject.data, experience);
	}
	
	Pathtree.prototype.setupServicesTriggers = function(fd)
		{
			var e = fd.experience;
			var serviceCell = e.getCell("Service");
			var userServiceCell = e.getCell("User Entered Service");
			$(serviceCell).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this, Pathtree.prototype.handleChangeServices);
			$(userServiceCell).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this, Pathtree.prototype.handleChangeServices);
		}
	
	Pathtree.prototype.clearServicesTriggers = function(fd)
		{
			var e = fd.experience;
			var serviceCell = e.getCell("Service");
			var userServiceCell = e.getCell("User Entered Service");
			$(serviceCell).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, Pathtree.prototype.handleChangeServices);
			$(userServiceCell).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, Pathtree.prototype.handleChangeServices);
		}
	
	Pathtree.prototype.appendExperiences = function()
	{
		var _this = this;

		this.experienceGroup.selectAll('g').remove();
		var g = this.experienceGroup.selectAll('g')
			.data(this.allExperiences.map(function(e) { return new FlagData(e); }))
			.enter()
			.append('g')
			.each(function(d)
				{
					_this.setupDelete(d, this);
				});
		
		function showDetail(fd, i)
		{
			cr.logRecord('click', 'show detail: ' + fd.getDescription());
			var g = this.parentNode;
			var pathtree = this.pathtree;
			
			pathtree.hideDetail(function() {
					pathtree.showDetailGroup(g, fd); 
				});
		}
		
		/* Set up a clipID that uniquely identifies the clip paths for this Pathtree. */
		this.clipID = Pathtree.prototype.nextClipID;
		Pathtree.prototype.nextClipID += 1;

		g.append('rect')
			.each(function()
				{ this.pathtree = _this; })
			.attr("fill", '#FFFFFF')
			.attr("stroke", '#FFFFFF')
			.attr('x', 0)
			.attr('y', 0);
			
		var handleChangedExperience = function(fd)
		{
			var r = this;
			
			var expChanged = function(eventObject)
			{
				Pathtree.prototype.setColor.call(eventObject.data, fd);
			}
			
			$(fd.experience).on("dataChanged.cr", null, this, expChanged);
			$(this).on("remove", null, fd.experience, function(eventObject)
			{
				$(eventObject.data).off("dataChanged.cr", null, expChanged);
			});
		}

		g.append('rect')
			.each(function()
				{ this.pathtree = _this; })
			.attr("fill-opacity", "0.3")
			.attr("stroke-width", "0")
			.on("click", function() 
				{ 
					d3.event.stopPropagation(); 
				})
			.on("click.cr", showDetail)
			.each(this.setColor)
			.each(handleChangedExperience)
			.each(this.setupServicesTriggers)
			.attr('x', 0)
			.attr('y', 0);
			
		g.append('line')
			.each(this.setColor)
			.each(handleChangedExperience)
			.each(this.setupServicesTriggers)
			.attr('x1', 1)
			.attr('x2', 1)
			.attr('y1', 0)
			.attr('stroke-width', 2);

		/* t is the set of all text nodes. */
		var t = g.append('text')
			.each(function() { this.pathtree = _this; })
			.attr("x", 0)
			.attr("dy", "1.1")
			.attr("transform", "translate({0}, 0)".format(_this.textLeftMargin))
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
		this.flagY = bbox.y;
		
		var smallBBox;
		t.style('font-size', '10px');
		if (t.node())
			smallBBox = t.node().getBBox();
		else
			smallBBox = {height: 20, y: -18};
		this.smallFlagHeight = smallBBox.height + this.textBottomBorder;
		this.smallFlagY = smallBBox.y;
		t.style('font-size', null);

		this.clearLayout();
		this.checkLayout();
	}
	
	Pathtree.prototype.handleValueDeleted = function(experience)
	{
		var index = this.allExperiences.indexOf(experience);
		if (index >= 0)
			this.allExperiences.splice(index, 1);
		if (experience == this.detailFlagData.experience)
			this.hideDetail(function() { }, 0);
		this.clearLayout();
		this.checkLayout();
	};

	Pathtree.prototype.handleExperienceDateChanged = function(eventObject)
	{
		var _this = eventObject.data;
		_this.setDateRange();
		_this.appendExperiences();
	}
		
	Pathtree.prototype.setupExperienceTriggers = function(experience)
	{
		var _this = this;
		
		var handleDataChanged = function(eventObject)
		{
			var exp = this;
			_this.checkOfferingCells(exp,
				function()
				{
					_this.clearLayout();
					_this.checkLayout();
				});
		}
	
		$(experience).on("dataChanged.cr", null, this, handleDataChanged);
		$(experience.getCell("Start")).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this, this.handleExperienceDateChanged);
		$(experience.getCell("End")).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this, this.handleExperienceDateChanged);
		
		$(this.sitePanel.node()).on("remove", null, experience, function(eventObject)
		{
			$(eventObject.data).off("dataChanged.cr", null, handleDataChanged);
			$(eventObject.data.getCell("Start")).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this.handleExperienceDateChanged);
			$(eventObject.data.getCell("End")).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this.handleExperienceDateChanged);
		});
	}
	
	Pathtree.prototype.checkOfferingCells = function(experience, done)
	{
		offering = experience.getValue("Offering");
		if (offering && offering.getValueID() && !offering.isDataLoaded)
		{
			var storedI = crp.getInstance(offering.getValueID());
			if (storedI != null)
			{
				offering.importCells(storedI.cells);
				if (done) done();
			}
			else
			{
				offering.checkCells(undefined, done, asyncFailFunction);
			}
		}
		else
		{
			if (done) done();
		}
	}
	
	Pathtree.prototype.addMoreExperience = function(experience)
	{
		this.checkDateRange(experience);
		experience.typeName = "More Experience";
		
		this.checkOfferingCells(experience);
		
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
	
	Pathtree.prototype.handleResize = function()
	{
		this.sitePanel.calculateHeight();
		
		var newHeight = this.sitePanel.scrollAreaHeight();
		var pathwayContainer = $(this.pathwayContainer.node());
		$(this.timeContainer.node()).height(newHeight);
		pathwayContainer.height(newHeight);
		pathwayContainer.width(this.sitePanel.scrollAreaWidth() - this.dataLeftMargin);
		
		var svg = $(this.svg.node());
		var isPinnedHeight = (this.isMinHeight && svg.height() > newHeight);
		var isPinnedWidth = (this.isMinHeight && svg.width() > pathwayContainer.width());
		
		if (svg.height() < newHeight ||
			isPinnedHeight ||
			svg.width() != pathwayContainer.width())
		{
			if (svg.height() < newHeight ||
				isPinnedHeight)
			{
				svg.height(newHeight);
				this.scaleDayHeightToSize();
			}
				
			if (svg.width() < pathwayContainer.width() ||
				isPinnedHeight ||
				isPinnedWidth)
				svg.width(pathwayContainer.width());
				
			this.clearLayout();
			this.checkLayout();
		}
	}
	
	Pathtree.prototype.showAllExperiences = function()
	{
		this.setDateRange();
		this.scaleDayHeightToSize();
		
		var _this = this;
		
		var resizeFunction = function()
		{
			_this.handleResize();
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

		$(window).on("resize", null, this, resizeFunction);
		$(this).on("clearing.cr", function()
		{
			$(window).off("resize", null, resizeFunction);
		});
		$(this).on("clear.cr", function()
		{
			$(window).off("resize", null, resizeFunction);
		});
	
		this.appendExperiences();
	}
		
	Pathtree.prototype.clear = function()
	{
		$(this).trigger("clear.cr");
		
		d3.select(this.containerDiv).selectAll('div').remove();
		
		this.user = null;
		this.allExperiences = [];
		this.pathwayContainer = null;
		this.timeContainer = null;
		this.svg = null;
		this.svgTime = null;
		this.defs = null;
		this.bg = null;
		this.bgTime = null;
		this.loadingText = null;
		this.promptAddText = null;
		this.experienceGroup = null;
		this.yearGroup = null;
		this.detailGroup = null;
		this.detailFrontRect = null;
		this.detailBackRect = null;
	
		this.detailFlagData = null;
		this.flagElement = null;
		this.flagHeight = 0;
		this.flagWidth = 0;
	
		this.minDate = null;
		this.maxDate = null;
		this.timespan = 0;
		this.isLayoutDirty = true;
		this.isMinHeight = false;
		this.dayHeight = 0;
		this.years = [];
	}
	
	Pathtree.prototype.setUser = function(user, editable)
	{
		if (user.privilege === '_find')
			throw "You do not have permission to see information about {0}".format(user.getDescription());
		if (this.user)
			throw "user has already been set for this pathtree";
			
		var _this = this;
		
		this.user = user;
		editable = (editable !== undefined ? editable : true);
		
		var container = d3.select(this.containerDiv);
		
		this.timeContainer = container.append('div')
			.classed("years", true)
			.style("width", this.dataLeftMargin)
			.style("height", "100%");
		
		this.svgTime = this.timeContainer.append('svg')
			.style("width", this.dataLeftMargin)
			.style("height", "100%");

		this.pathwayContainer = container.append('div')
			.classed("pathway", true)
			.style("width", $(this.containerDiv).width() - this.dataLeftMargin)
			.style("height", "100%");
			
		this.svg = this.pathwayContainer.append('svg')
			.classed("pathway", true)
			.style("width", $(this.containerDiv).width() - this.dataLeftMargin)
			.style("height", "100%");
		
		/* Keep the scrolling of the timeContainer and the pathwayContainer synchronized */
		var timeScroller = function()
			{
				var n = _this.pathwayContainer.node();
				if (this.scrollTop != n.scrollTop)
				{
					$(n).off("scroll", pathwayScroller);
					$(n).one("scroll", pathwayScrollReset);
					n.scrollTop = this.scrollTop;
				}
			}
		var timeScrollReset = function()
			{
				$(this).scroll(timeScroller);
			}
			
		var pathwayScroller = function()
			{
				var n = _this.timeContainer.node();
				if (this.scrollTop != n.scrollTop)
				{
					$(n).off("scroll", timeScroller);
					$(n).one("scroll", timeScrollReset);
					n.scrollTop = this.scrollTop;
				}
			}
		var pathwayScrollReset = function()
			{
				$(this).scroll(pathwayScroller);
			}
			
			
		$(this.timeContainer.node()).scroll(timeScroller);
		$(this.pathwayContainer.node()).scroll(pathwayScroller);

		this.defs = this.svg.append('defs');
	
		/* bg is a rectangle that fills the background with the background color. */
		this.bg = this.svg.append('rect')
			.attr("x", 0).attr("y", 0)
			.style("width", "100%")
			.style("height", "100%")
			.attr("fill", this.pathBackground);
			
		/* bgTime is a rectangle that fills the background of the timeline with the background color. */
		this.bgTime = this.svgTime.append('rect')
			.attr("x", 0).attr("y", 0)
			.style("width", "100%")
			.style("height", "100%")
			.attr("fill", this.pathBackground);
			
		this.loadingMessage = crv.appendLoadingMessage(this.containerDiv)
			.style("position", "absolute")
			.style("left", "0")
			.style("top", "0");
		
		this.experienceGroup = this.svg.append('g')
				.attr("font-family", "San Francisco,Helvetica Neue,Arial,Helvetica,sans-serif")
				.attr("font-size", "1.3rem");
		this.yearGroup = this.svgTime.append('g')
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
		this.detailBackRect = this.detailGroup.append('rect')
			.attr("fill", this.pathBackground)
			.attr("width", "100%");
		this.detailFrontRect = this.detailGroup.append('rect')
			.attr("fill-opacity", "0.3")
			.attr("stroke-opacity", "0.8")
			.attr("width", "100%");
			
		$(_this.sitePanel.node()).one("revealing.cr", function()
			{
				$(_this.svg.node()).width(_this.sitePanel.scrollAreaWidth() - _this.dataLeftMargin);
			});

		d3.select(this.containerDiv).selectAll('svg')
			.on("click", function() 
			{ 
				d3.event.stopPropagation(); 
			})
			.on("click.cr", function() {
				cr.logRecord('click', 'hide details');
				_this.hideDetail();
			});
		
		var successFunction1 = function(experiences)
		{
			_this.allExperiences = experiences;
			$(experiences).each(function()
			{
				this.typeName = "Experience";
				this.setDescription(this.getValue("Offering").getDescription());
			});
		
			crp.getData({path: "#" + _this.user.getValueID() + '::reference(Experience)::reference(Experiences)' + 
								'::reference(Session)::reference(Sessions)::reference(Offering)',
						 done: function(newInstances)
							{
							},
							fail: asyncFailFunction});
			crp.getData({path: "#" + _this.user.getValueID() + '>"More Experiences">"More Experience">Offering',
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
										if (color && color.text)
											otherColor = color.text;
										break;
									}
								}
							},
						fail: asyncFailFunction});
								
			crp.pushCheckCells(_this.user, undefined, 
				function() {
					var m = _this.user.getValue("More Experiences");
					if (m && m.getValueID())
					{
						m.getCellData("More Experience",
									  successFunction2, 
									  asyncFailFunction);
					}
					else
						successFunction2([]);	/* There are none. */
				},
				function(err)
				{
					asyncHidePanelRight(_this.sitePanel.node());
					asyncFailFunction(err);
				});
		}

		var successFunction2 = function(experiences)
		{
			_this.allExperiences = _this.allExperiences.concat(experiences);
			
			$(experiences).each(function()
			{
				this.typeName = "More Experience";
				this.calculateDescription();
			});
			
			/* Ensure that all of the offerings have their associated cells. */
			_this.allExperiences.forEach(function(experience)
				{
					_this.checkOfferingCells(experience, null);
				});
		
			_this.showAllExperiences();
			
			crv.stopLoadingMessage(_this.loadingMessage);
			_this.loadingMessage.remove();
			
			if (_this.allExperiences.length == 0 && editable)
			{
				_this.loadingText = _this.svg.append('text')
					.attr("x", 0).attr("y", 0)
					.attr("fill", "#777")
					.text('Ready to record an experience?');
				
				_this.loadingText
					.attr("y", _this.loadingText.node().getBBox().height);
			
				var bbox = _this.loadingText.node().getBBox();
				_this.promptAddText = _this.svg.append('text')
					.attr("fill", "#2C55CC")
					.text(" Record one now.")
					.on("click", function(d) {
						if (prepareClick('click', 'Record one now prompt'))
						{
							try
							{
								showClickFeedback(this);
								var newPanel = new NewExperiencePanel(_this, _this.sitePanel.node());
							}
							catch (err)
							{
								syncFailFunction(err);
							}
						}
						d3.event.preventDefault();
					})
					.attr("cursor", "pointer");
				
				var newBBox = _this.promptAddText.node().getBBox();
				if (bbox.x + bbox.width + _this.textLeftMargin + newBBox.width >
					$(_this.bg.node()).width - _this.flagsRightMargin)
				{
					_this.promptAddText.attr("x", _this.loadingText.attr("x"))
						.attr("y", parseFloat(_this.loadingText.attr("y")) + bbox.height);
				}
				else
				{
					_this.promptAddText.attr("x", bbox.x + bbox.width + _this.textLeftMargin)
						.attr("y", _this.loadingText.attr("y"));
				}
			}
			
			$(_this).trigger("userSet.cr");
		}
		
		var path = "#" + this.user.getValueID() + '::reference(Experience)';
		cr.getData({path: path, 
				   fields: ["parents"], 
				   done: successFunction1, 
				   fail: asyncFailFunction});
	}

	function Pathtree(sitePanel, containerDiv) {
		this.containerDiv = containerDiv;
		this.sitePanel = sitePanel;
		this.detailFlagData = null;
		this.flagElement = null;
		this.allExperiences = [];
		
		$(this).on("clear.cr", null, null, function() {
			this.clearDetail();
		});
		
	}
	
	return Pathtree;
})();

var PathtreePanel = (function () {
	PathtreePanel.prototype = new SitePanel();
	PathtreePanel.prototype.pathtree = null;
	
	function PathtreePanel(user, previousPanel, canDone) {
		canDone = canDone !== undefined ? canDone : true;
		var _this = this;

		SitePanel.call(this, previousPanel, null, "My Pathtree", "pathway");
		var navContainer = this.appendNavContainer();
		if (canDone)
		{
			var backButton = navContainer.appendLeftButton()
				.on("click", handleCloseRightEvent);
			backButton.append("span").text("Done");
		}
		
		if (user == cr.signedinUser)
		{
			var signinSpan = navContainer.appendRightButton()
				.on("click", function()
					{
						showClickFeedback(this);
						if (prepareClick('click',  'Sign Out button'))
						{
							if (cr.signedinUser.getValueID())
							{
								var successFunction = function()
								{
									cr.signedinUser.clearValue();
									$(cr.signedinUser).trigger("signout.cr");
									unblockClick();
								};
					
								sign_out(successFunction, syncFailFunction);
							}
							else
							{
								showFixedPanel(_this.node(), "#id_sign_in_panel");
							}
						}
						d3.event.preventDefault();
					})
				.append('span').text('Sign Out');
			
			updateSignoutText = function(eventObject) {
				var panel = new WelcomePanel(previousPanel);
				if (_this.pathtree)
					$(_this.pathtree).trigger("clearing.cr");
				showPanelLeft(panel.node(),
					function()
					{
						$(_this.node()).remove();
					});
			};
			
			$(cr.signedinUser).on("signout.cr", null, signinSpan.node(), updateSignoutText);
			$(this.node()).on("remove", null, cr.signedinUser, function(eventObject)
				{
					$(cr.signedinUser).off("signout.cr", null, updateSignoutText);
				});
		}

		navContainer.appendTitle(getUserDescription(user));
		
		var panel2Div = this.appendScrollArea();
		panel2Div.classed('vertical-scrolling', false)
			.classed('no-scrolling', true);

		var bottomNavContainer = this.appendBottomNavContainer();

		var settingsButton = bottomNavContainer.appendLeftButton()
			.on("click", 
				function() {
					if (prepareClick('click', "Settings"))
					{
						var settings = new Settings(user, _this.node());
					}
					d3.event.preventDefault();
				});
		settingsButton.append("i").classed("site-active-text fa fa-lg fa-cog", true);
		settingsButton.style("display", "none");

		var sharingButton = bottomNavContainer.appendLeftButton()
			.on("click", 
				function() {
					if (prepareClick('click', "Sharing"))
					{
						var settings = new SharingPanel(user, _this.node());
					}
		
					d3.event.preventDefault();
				});
		sharingButton.append("i").classed("site-active-text fa fa-lg fa-users", true);
		sharingButton.style("display", "none");
		
		var findButton = bottomNavContainer.appendRightButton()
				.on("click",
					function() {
						if (prepareClick('click', 'find experience'))
						{
							showClickFeedback(this);
							var newPanel = new FindExperiencePanel(cr.signedinUser, null, null, _this.node());
							showPanelLeft(newPanel.node(), unblockClick);
						}
						d3.event.preventDefault();
					});
		findButton.append("i").classed("site-active-text fa fa-lg fa-search", true);
		findButton.style("display", "none");
		
		var addExperienceButton = bottomNavContainer.appendRightButton()
			.on("click", function(d) {
				if (prepareClick('click', 'add experience'))
				{
					showClickFeedback(this);
	
					var newPanel = new NewExperiencePanel(_this.pathtree, _this.node());
				}
				d3.event.preventDefault();
			});
		addExperienceButton.append("i").classed("site-active-text fa fa-lg fa-plus", true);
		addExperienceButton.style("display", "none");
		
		/* Add buttons that sit on top of the scroll area. */
		this.expandButton = this.panelDiv.append('button')
			.classed('expand', true)
			.on('click', function(d)
				{
					if (prepareClick('click', 'expand'))
					{
						var _thisButton = d3.select(this);
						_thisButton.classed('pressed', true);
						_this.pathtree.scale(1.3,
							function() { _thisButton.classed('pressed', false); unblockClick(); });
						d3.event.preventDefault();
					}
				});
		this.expandButton
			.append('span').text("+");
		this.contractButton = this.panelDiv.append('button')
			.classed('contract', true)
			.on('click', function(d)
				{
					var _thisButton = d3.select(this);
					if (!_thisButton.classed('disabled'))
					{
						if (prepareClick('click', 'contract'))
						{
							_thisButton.classed('pressed', true);
							_this.pathtree.scale(1/1.3,
								function() { _thisButton.classed('pressed', false); unblockClick(); });
							d3.event.preventDefault();
						}
					}
				});
		this.contractButton
			.append('span').text("—");
		
		if (this.pathtree)
			throw "pathtree already assigned to pathtree panel";
			
		this.pathtree = new Pathtree(this, panel2Div.node());
		
		$(this.node()).on("remove", function()
		{
			_this.pathtree.clear();
		});
		
		$(this.pathtree).on("userSet.cr", function()
			{
				var moreExperiences = user.getValue("More Experiences");
				var canAddExperience = (moreExperiences.getValueID() === null ? user.canWrite() : moreExperiences.canWrite());
				addExperienceButton.style("display", canAddExperience ? null : "none");
				settingsButton.style("display", user.privilege === "_administer" ? null : "none");
				sharingButton.style("display", user.privilege === "_administer" ? null : "none");
				findButton.style("display", user.privilege === "_administer" ? null : "none");
			});
	}
	
	return PathtreePanel;
})();

