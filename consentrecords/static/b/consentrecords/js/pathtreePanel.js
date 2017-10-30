/* pathtreePanel.js */

var FlagController = (function() {
	FlagController.prototype.experience = null;
	FlagController.prototype.x = null;
	FlagController.prototype.y = null;
	FlagController.prototype.height = null;
	FlagController.prototype.width = null;
	FlagController.prototype._selected = false;
	
	FlagController.prototype.previousDateString = "0000-00";
	FlagController.prototype.goalDateString = "9999-12-31";
	
	/* Constants related to the detail text. */
	FlagController.prototype.detailTopSpacing = "1.5em";		/* The space between lines of text in the detail box. */
	FlagController.prototype.detailOrganizationSpacing = "1.5em";	/* The space between lines of text in the detail box. */
	FlagController.prototype.detailSiteSpacing = "1.3em";	/* The space between lines of text in the detail box. */
	FlagController.prototype.detailDateSpacing = "1.5em";	/* The space between lines of text in the detail box. */
	FlagController.prototype.detailTagSpacing = "1em";		/* The space between lines of text in the detail box. */
	
	FlagController.prototype.getDescription = function()
	{
		e = this.experience;
		return (e.offering() && e.offering().description()) ||
		    (e instanceof cr.Experience &&
		     (e.customOffering() ||
		      (e.experienceServices() &&
		       e.experienceServices().length &&
		       e.experienceServices()[0].description()) ||
		      (e.customServices() &&
		       e.customServices().length &&
		       e.customServices()[0].description()))) ||
		    "None";
	}
	
	FlagController.prototype.subHeading = function()
	{
		e = this.experience;
		return (e.organization() && e.organization().description()) ||
		       (e instanceof cr.Experience && e.customOrganization()) ||
		       (e.site() && e.site().description()) ||
		       (e instanceof cr.Experience && e.customSite()) ||
		       "";
	}
	
	FlagController.prototype.pickedOrCreatedText = function(picked, created)
	{
		return this.experience.pickedOrCreatedText(picked, created);
	}
	
	/* Returns the column of the first service (either from 
		the experience's offering or the experience itself)
		that has a designated column.
	 */
	FlagController.prototype.getColumn = function()
	{
		var minColumn = PathGuides.data.length - 1;
		var maxColumn = minColumn;
		
		var offering = this.experience.offering();
		if (offering && offering.id())
		{
			var services = offering.offeringServices();
			
			/* Services will not be instantiated if the currently logged-in
				user does not have read access to the offering.
			 */
			if (services)
			{
				minColumn = services.map(function(s) {
						return s.service().getColumn();
					})
					.reduce(function(a, b) {
						if (a < maxColumn)
							return a;
						else
							return b;
					}, minColumn);
			}
		}
		
		if (this.experience instanceof cr.Experience)
		{
			var services = this.experience.experienceServices();
			minColumn = services.map(function(s) {
						return s.service().getColumn();
					})
					.reduce(function(a, b) {
						if (a < maxColumn)
							return a;
						else
							return b;
					}, minColumn);
		}
		return minColumn;
	}
	
	FlagController.prototype.getStartDate = function()
	{
		return this.experience.start() || this.getTimeframeText() || this.goalDateString;
	}
	
	FlagController.prototype.getTimeframe = function()
	{
		if (this.experience.engagement())
		{
			var end = this.experience.end();
			if (end && end < getUTCTodayDate().toISOString().substr(0, 10))
			{
				return "Previous";
			}
			else
			{
				var start = this.experience.start();
				if (start && start < getUTCTodayDate().toISOString().substr(0, 10))
					return "Current";
				else
					return "Goal";
			}
		}
		else
			return this.experience.timeframe();
	}
	
	FlagController.prototype.getEndDate = function()
	{
		var s = this.experience.end();
		if (s) return s;
		
		var timeframe = this.getTimeframe();
		s = this.experience.start();
		if (s)
		{
			if (timeframe == "Previous" || timeframe == "Current" ||
				s < getUTCTodayDate().toISOString().substr(0, 10))
			{
				return getUTCTodayDate().toISOString().substr(0, 10);
			}
			return this.goalDateString;
		}
		else
		{
			return this.getTimeframeText() || this.goalDateString;
		}
	}
	
	FlagController.prototype.getTimeframeText = function()
	{
		var text = this.getTimeframe();
		if (!text)
			return text;
		else if (text == "Previous")
			return this.previousDateString;
		else if (text == "Current")
			return getUTCTodayDate().toISOString().substr(0, 10);
		else if (text == "Goal")
			return this.goalDateString;
		else
			throw new Error("Unrecognized timeframe");
	}
	
	FlagController.prototype.startsBeforeOtherEnd = function(otherFD)
	{
		return this.getStartDate() < otherFD.getEndDate();
	}
	
	FlagController.prototype.getYearArray = function()
	{
		var e = this.experience.end();
		var s = this.experience.start();
		var t;
		var top, bottom;
		
		if (e)
			top = new Date(e).getUTCFullYear();
		else if (s)
			top = (new Date().toISOString().substr(0, s.length) < s) ? "Goal" : "Now"
		else {
			t = this.experience.timeframe();
			if (t == "Previous")
				top = "Done";
			else if (t == "Current")
				top = "Now";
			else
				top = "Goal";
		}
			
		if (s)
			bottom = new Date(s).getUTCFullYear();
		else if (t == "Previous")
			bottom = "Done";
		else if (t == "Current")
			bottom = "Now";
		else
			bottom = "Goal";
		
		return {top: top, bottom: bottom};
	}
	
	FlagController.prototype.getColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].color;
	}
	
	FlagController.prototype.fontColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].fontColor;
	}
	
	FlagController.prototype.checkOfferingCells = function(done)
	{
		// Is this needed any longer?
// 		var offering = this.experience.getValue("Offering");
// 		if (offering && offering.id() && !offering.areCellsLoaded())
// 		{
// 			offering.promiseCellsFromCache()
// 				.then(done, cr.asyncFail);
// 		}
// 		else
			done();
	}
	
	FlagController.prototype.colorHTMLElement = function(r)
	{
		var _this = this;
		var f = function()
			{
				PathGuides.fillNode(r, _this.getColumn());
			}
		this.checkOfferingCells(f);
	}
	
	FlagController.prototype.colorElement = function(r)
	{
		var _this = this;
		var f = function()
			{
				var column = _this.getColumn();
				var colorText = PathGuides.data[column].color;
				r.setAttribute('fill', colorText);
				r.setAttribute('stroke', colorText);
			}
		this.checkOfferingCells(f);
	}
	
	FlagController.appendWrappedText = function(s, newSpan, maxWidth)
	{
		var words = s.split(/\s+/).reverse(),
			word,
			line = [];
		tspan = newSpan(0);
		var nextIndex = 1;
		
		while (word = words.pop()) {
			line.push(word);
			tspan.text(line.join(" "));
			if (tspan.node().getComputedTextLength() > maxWidth) {
				line.pop();
				tspan.text(line.join(" "));
				line = [word];
				tspan = newSpan(nextIndex).text(word);
				++nextIndex;
			}
		}
	}
	
	FlagController.prototype.appendElements = function(detailGroup)
	{
		detailGroup.selectAll('div').remove();
		
		var title;
		var e = this.experience;
		title = e.pickedOrCreatedText(e.offering(), e.customOffering());
		if (!title)
		{
			var service = e.experienceServices().length > 0 ? e.experienceServices()[0] : null;
			var customService = e.customServices().length > 0 ? e.customServices()[0] : null;

			if (service)
				title = service.description();
			else if (customService)
				title = customService.description();
		}
		var orgString = e.pickedOrCreatedText(e.organization(), e.customOrganization());
		var siteString = e.pickedOrCreatedText(e.site(), e.customSite());
		if (siteString == orgString)
			siteString = "";
		var dateRange = e.dateRange();
		var tagDescriptions = e.getTagList();
		var containerDiv = null;
		
		if (title)
		{
			containerDiv = containerDiv || detailGroup.append('div');
			containerDiv.append('div')
				.classed('flag-label', true)
				.text(title);
		}
		
		if (orgString)
		{
			containerDiv = containerDiv || detailGroup.append('div');
			containerDiv.append('div')
				.classed('detail-organization', true)
				.text(orgString);
		}

		if (siteString)
		{
			containerDiv = containerDiv || detailGroup.append('div');
			containerDiv.append('div')
				.classed('site', true)
				.text(siteString);
		}

		if (dateRange)
		{
			detailGroup.append('div')
				.classed('detail-dates', true)
				.text(dateRange);
		}
		
		if (tagDescriptions)
		{
			var _this = this;
			var detailText = detailGroup.append('div')
				.classed('tags', true)
				.text(tagDescriptions);
		}
	}
	
	FlagController.prototype.setupChangeEventHandler = function(data, handler)
	{
		var experience = this.experience;
		setupOnViewEventHandler(this.experience, "experienceServiceAdded.cr experienceServiceDeleted.cr customServiceAdded.cr customServiceDeleted.cr changed.cr", data, handler);
	}
	
	FlagController.prototype.selected = function(newValue)
	{
		if (newValue === undefined)
			return this._selected;
		else
		{
			if (this._selected != newValue)
			{
				this._selected = newValue;
				$(this).trigger("selectedChanged.cr");
			}
		}
	}

	function FlagController(experience)
	{
		this.experience = experience;
		this.y = null;
		this.x = null;
		this.height = null;
		this.width = null;
	}
	return FlagController;
})();

var PathView = (function() {
	PathView.prototype.path = null;
	PathView.prototype.allExperiences = [];
	PathView.prototype.sitePanel = null;
	PathView.prototype.containerDiv = null;

	PathView.prototype.isLayoutDirty = true;
		
	PathView.prototype.topNavHeight = 0;		/* The height of the top nav container; set by container. */
	PathView.prototype.bottomNavHeight = 0;	/* The height of the bottom nav container; set by container. */

	/* Constants related to the detail rectangle. */
	PathView.prototype.poleSpacing = 4;	/* The distance between two flags that are on the same line with overlapping poles. */
	PathView.prototype.textBottomMargin = 5;
	PathView.prototype.yearTextX = "3.0em";
	PathView.prototype.yearTextX2 = "0.6em";
	PathView.prototype.flagLineOneDY = '1.4em';
	PathView.prototype.flagLineTwoDY = '1.3em';
	PathView.prototype.flagHeightEM = 3.5;
	PathView.prototype.flagSpacing = 2;
	PathView.prototype.flagSpacingEM = 0.1;
	PathView.prototype.textDetailLeftMargin = 10; /* textLeftMargin; */
	PathView.prototype.topYearMarginEM = 1.4;	/* The distance between the top of a flagpole and a year marker. */
	PathView.prototype.bottomYearMarginEM = 0.5;	/* The distance between the bottom of a flagpole and a year marker. */

	PathView.prototype.guideHSpacing = 30;
							  
	/* Translate coordinates for the elements of the experienceGroup within the svg */
	PathView.prototype.experienceGroupDX = 40;
	PathView.prototype.experienceGroupDY = 6.5; /* em */
	PathView.prototype.loadingMessageTop = "6.5em";
	
	PathView.prototype.pathBackground = "white";
	PathView.prototype.emToPX = 11;
							  
	PathView.prototype.handleChangedExperience = function(r, fd)
	{
		setupOnViewEventHandler(fd.experience, "changed.cr", r, function(eventObject)
		{
			fd.colorElement(eventObject.data);
		});
	}

	/* Sets up a trigger when a service changes, or a non-empty service is added or deleted.
		The trigger runs the specified handler.
	 */
	PathView.prototype.setupServiceTriggers = function(r, fd, handler)
	{
		setupOnViewEventHandler(fd.experience, "experienceServiceAdded.cr experienceServiceDeleted.cr changed.cr", r, handler);
	}
	
	/* Sets up a trigger when a service changes, or a non-empty service is added or deleted.
		The trigger sets the color of the specified element (r).
	 */	
	PathView.prototype.setupColorWatchTriggers = function(r, fd)
	{
		var f = function(eventObject)
		{
			fd.colorElement(eventObject.data);
		}
		
		this.setupServiceTriggers(r, fd, f);
	}
	
	PathView.prototype.canEditExperience = function(fd)
	{
		return fd.experience instanceof cr.Experience && fd.experience.canWrite();
	}
	
	PathView.prototype.clearDetail = function()
	{
		$(this).trigger("clearTriggers.cr");
	}

	PathView.prototype.updateDetail = function(flag, fd)
	{
		var _this = this;
		fd.checkOfferingCells(function()
			{
				_this.showCommentsPanel(flag, fd);
			});
	}
	
	PathView.prototype.clearLayout = function()
	{
		/* Do whatever it takes to force layout when checkLayout is called. */
		this.isLayoutDirty = true;
	}
	
	PathView.prototype.showDetailPanel = function(fd)
	{
		if (prepareClick('click', 'show experience detail: ' + fd.getDescription()))
		{
			try
			{
				var experienceController = new ExperienceController(fd.experience.path(), fd.experience, true);
				experienceController.oldInstance(fd.experience);
				
				var editPanel = new NewExperiencePanel(experienceController, revealPanelLeft);
				
				editPanel.showLeft().then(unblockClick);
			}
			catch(err)
			{
				cr.syncFail(err);
			}
			d3.event.stopPropagation();
		}
	}
	
	PathView.prototype.showCommentsPanel = function(flag, fd)
	{
		if (prepareClick('click', 'show experience comments: ' + fd.getDescription()))
		{
			try
			{
				if (!fd.selected())
				{
					d3.select(flag).selectAll('rect.bg')
						.transition()
						.duration(200)
						.style('fill-opacity', 0.4);
				}
				var newPanel = new ExperienceCommentsPanel(fd, this.sitePanel.headerText);
				newPanel.showLeft()
					.always(function()
						{
							if (!fd.selected())
							{
								d3.select(flag).selectAll('rect.bg')
									.style('fill-opacity', 0.2);
							}
						})
					.always(unblockClick);
				return newPanel;
			}
			catch(err)
			{
				cr.syncFail(err);
			}
		}
	}
	
	/* Sets up triggers that fire when the data associated with an experience changes.
		Also, sets up triggers that fire when the start date or end date are added, deleted or changed
			and that dynamically move the flags to their correct locations.
	 */
	PathView.prototype.setupExperienceTriggers = function(experience)
	{
		var _this = this;
		
		var handleDataChanged = function(eventObject)
		{
			var exp = this;
			checkOfferingCells(exp)
				.then(function()
					{
						_this.clearLayout();
						_this.checkLayout();
						_this.transitionPositions();
					},
					cr.asyncFail);
		}
	
		var node = this.sitePanel.node();
		setupOnViewEventHandler(experience, "changed.cr", node, handleDataChanged);
	}
	
	PathView.prototype._setFlagText = function(node)
	{
		var g = d3.select(node);
		g.selectAll('text>tspan:nth-child(1)')
			.text(function(d) { return d.getDescription(); });
		g.selectAll('text>tspan:nth-child(2)')
			.text(function(d) { return d.subHeading(); });
			
	}
		
	/* Sets up each group (this) that displays an experience to delete itself if
		the experience is deleted.
	 */
	PathView.prototype.setupDelete = function(fd, node) 
	{
		var _this = this;
		
		setupOneViewEventHandler(fd.experience, "deleted.cr", node, function(eventObject)
			{
				$(eventObject.data).remove();
				_this.handleExperienceDeleted(this);
			});
		
		var flagDataChanged =  function(eventObject)
			{
				_this._setFlagText(eventObject.data);

				/* Make sure that the rectangles match the widths. */
				var g = d3.select(eventObject.data);
				g.selectAll('rect')
					.attr('width', function(fd)
						{
							return $(this.parentNode).children('text').outerWidth() + 
								(2 * _this.textDetailLeftMargin);
						});	
			}
						
		setupOnViewEventHandler(fd.experience, "experienceServiceAdded.cr experienceServiceDeleted.cr customServiceAdded.cr customServiceDeleted.cr changed.cr", node, flagDataChanged);
	}
	
	PathView.prototype.compareDates = function (d1, d2)
	{
		if (d1 === "Done")
			d1 = -10000;
		if (d2 === "Done")
			d2 = -10000;
			
		// negative numbers mean d1 is earlier than d2 chronologically
		if (d1 === "Goal")
			return d2 === "Goal" ? 0 : 1;
		else if (d2 === "Goal")
			return -1;
		else if (d1 === "Now")
		{
			if (d2 === "Now")
				return 0;
			else 
			{
				var thisDate = new Date();
				var thisYear = thisDate.getUTCFullYear();
				return d2 <= thisYear ? 1 : -1;
			}
		}
		else if (d2 === "Now")
		{
			var thisDate = new Date();
			var thisYear = thisDate.getUTCFullYear();
			return d1 <= thisYear ? -1 : 1;
		}
		else
			return d1 - d2;
	}

	
	PathView.prototype.setupFlags = function(g)
	{
		var _this = this;

		g.classed('flag', true)
			.each(function(d)
				{
					_this.setupDelete(d, this);
				})
			.on("click", function() 
				{ 
					d3.event.stopPropagation(); 
				})
			.on("click.cr", function(fd)
				{
					if (!d3.event.defaultPrevented)
						_this.updateDetail(this, fd);
				})
			.each(function(d) 
				{ 
					_this.setupServiceTriggers(this, d, function(eventObject)
						{
							d.column = _this.getColumn(d);
							_this.transitionPositions();
						});
					setupOnViewEventHandler($(d), "selectedChanged.cr", this, function(eventObject)
						{
							var g = d3.select(eventObject.data);
							g.classed('selected', d.selected());
							g.selectAll('tspan').attr('fill', d.selected() ? '#FFFFFF' : d.fontColor());
						});
				});
					
		g.append('line').classed('flag-pole', true)
			.each(function(d)
				{
					d.colorElement(this);
					_this.handleChangedExperience(this, d);
					_this.setupColorWatchTriggers(this, d);
				});
		g.append('rect').classed('opaque', true)
			.attr('x', '1.5');
		g.append('rect').classed('bg', true)
			.attr('x', '1.5')
			.each(function(d)
				{
					d.colorElement(this);
					_this.handleChangedExperience(this, d);
					_this.setupColorWatchTriggers(this, d);
				});
		var text = g.append('text').classed('flag-label', true);
		text.append('tspan')
			.attr('x', this.textDetailLeftMargin)
			.attr('dy', this.flagLineOneDY)
			.attr('fill', function(d) { return d.fontColor(); })
			.each(function(d)
				{
					setupOnViewEventHandler(d.experience, "changed.cr", this, function(eventObject)
					{
						d3.select(eventObject.data).attr('fill', d.selected() ? '#FFFFFF' : d.fontColor());
					});
					_this.setupServiceTriggers(this, d, function(eventObject)
						{
							d3.select(eventObject.data).attr('fill', d.selected() ? '#FFFFFF' : d.fontColor());
						});
				});
		text.append('tspan')
			.attr('x', this.textDetailLeftMargin)
			.attr('dy', this.flagLineTwoDY)
			.attr('fill', function(d) { return d.fontColor(); })
			.each(function(d)
				{
					setupOnViewEventHandler(d.experience, "changed.cr", this, function(eventObject)
					{
						d3.select(eventObject.data).attr('fill', d.fontColor());
					});
					_this.setupServiceTriggers(this, d, function(eventObject)
						{
							d3.select(eventObject.data).attr('fill', d.fontColor());
						});
				});
		
		g.each(function() { _this._setFlagText(this); });
		
		return g;
	}
	
	PathView.prototype.addMoreExperience = function(experience)
	{
		var _this = this;
		checkOfferingCells(experience)
			.then(function()
				{
					_this.allExperiences.push(experience);
					_this.setupExperienceTriggers(experience);
		
					var flags = _this.appendExperiences(experience);
					_this.redoLayout();
					_this.updateDetail(flags.node(), flags.datum());
				},
				cr.asyncFail);
		
	}
	
	PathView.prototype.layoutYears = function(g)
	{
		var _this = this;
		
		this.yearGroup.selectAll('line').remove();
		this.yearGroup.selectAll('text').remove();
		var fds = g.data();
		var years = {};
		
		fds.forEach(function(fd)
		{
			fd.yearBounds = fd.getYearArray();
			if (!(fd.y in years) || _this.compareDates(years[fd.y].text, fd.yearBounds.top) > 0)
				years[fd.y] = {y: fd.y + _this.topYearMarginEM, text: fd.yearBounds.top};
			if (!(fd.y2 in years) || _this.compareDates(years[fd.y2].text, fd.yearBounds.bottom) > 0)
				years[fd.y2] = {y: fd.y2 - _this.bottomYearMarginEM, text: fd.yearBounds.bottom};
		});
		
		var yearKeys = Object.keys(years);
		
		var sortedKeys = yearKeys.sort(function(a, b)
		{
			return parseFloat(a) - parseFloat(b);
		});
		
		var lastText = "";
		var needLine = false;
		for (i = 0; i < sortedKeys.length; ++i)
		{
			var keyI = sortedKeys[i];
			if (i == 0 ||
				years[keyI].text != lastText)
			{
				if (needLine)
					_this.yearGroup.append('line')
						.attr('x1', _this.yearTextX)
						.attr('y1', (_this.experienceGroupDY + (years[keyI].y - 1.3)) * _this.emToPX)
						.attr('x2', _this.yearTextX2)
						.attr('y2', (_this.experienceGroupDY + (years[keyI].y - 1.3)) * _this.emToPX)
						.attr('stroke', '#CCC');
				_this.yearGroup.append('text')
					.text(years[keyI].text)
					.attr('x', _this.yearTextX)
					.attr('y', (_this.experienceGroupDY + years[keyI].y) * _this.emToPX);
				lastText = years[keyI].text;
				needLine = false;
			}
			else
				needLine = true;
		}
	}
	
	PathView.prototype._compareExperiences = function(a, b)
	{
		function compareDates(d1, d2)
		{
			/* null dates come first, because they are the future. */
			if (!d2)
				return d1 ? 1 : 0;
			else if (!d1)
				return -1;
							
			return (d1 > d2) ? 1 :
				   ((d2 > d1) ? -1 :
				   0);
		}
		
		var diff = -compareDates(a.getEndDate(), b.getEndDate()) ||
				a.column - b.column;
		if (diff)
			return diff;
			
		var thisDate = new Date().toISOString().substr(0, 10);
		if ((a.getStartDate() <= thisDate) != (b.getStartDate() <= thisDate))
			return -compareDates(a.getStartDate(), b.getStartDate());
		else
			return compareDates(a.getStartDate(), b.getStartDate());
	}
	
	/* Sets the x, y and y2 coordinates of each flag. */
	PathView.prototype._setCoordinates = function(g)
	{
		var _this = this;

		var numColumns = this.columnData.length;
		var columns = new Array(numColumns);
		for (var i = 0; i < numColumns; ++i)
			columns[i] = [];

		var nextY = 0;
		g.each(function(fd, i)
			{
				fd.x = _this.guideHSpacing * (fd.column);
				var column = columns[fd.column];
				column.push(fd);
				for (var j = column.length - 2; j >= 0; --j)
				{
					var lastFD = column[j];
					if (lastFD.startsBeforeOtherEnd(fd))
					{
						fd.x = lastFD.x + _this.poleSpacing;
						break;
					}
				}
				
				fd.y = nextY;
				nextY += _this.flagHeightEM + _this.flagSpacingEM;
			});
			
		g.each(function(fd, i)
			{
				fd.y2 = fd.y + _this.flagHeightEM;
				var parent = d3.select(this.parentNode);
				for (var j = i + 1; j < g.size(); ++j)
				{
					var n =  parent.selectAll('g:nth-child({0})'.format(j+1));
					nextDatum = n.datum();
					if (fd.startsBeforeOtherEnd(nextDatum))
						fd.y2 = nextDatum.y + _this.flagHeightEM;
					else
						break;
				}
			});
	}
	
	/** Returns the column in this pathview for displaying the specified FlagController */
	PathView.prototype.getColumn = function(fd)
	{
		return fd.getColumn();
	}

	PathView.prototype.transitionPositions = function()
	{
		var g = this.experienceFlags();
		var _this = this;
		g.sort(this._compareExperiences);
		this._setCoordinates(g);
		g.transition()
			.duration(700)
			.ease("in-out")
			.attr("transform", function(fd) { return "translate({0},{1})".format(fd.x, fd.y * _this.emToPX);});
		
		/* Set the line length to the difference between fd.y2 and fd.y, since g is transformed
			to the fd.y position.
		 */
		g.selectAll('line.flag-pole')
			.transition()
			.duration(700)
			.ease("in-out")
			.attr('y2', function(fd) { return "{0}em".format(fd.y2 - fd.y); });

		this.layoutYears(g);
	}
	
	/*
		r has x, y, height and width for the rectangle to be displayed.
		bottomPadding: number of pixels below r that must be visible within container.
		topMargin: number of pixels above r that need not be visible when scrolling up.
	 */
	PathView.prototype.scrollToRectangle = function(container, r, topPadding, bottomPadding, duration)
	{
		var bottomToContainer = r.y + r.height;
		var rightToContainer = r.x + r.width;
		
		if (container.scrollTop < 
			(topPadding + bottomToContainer + bottomPadding - $(container).height()))
		{
			$(container).animate(
				{ scrollTop: "{0}px".format(topPadding + bottomToContainer + bottomPadding - ($(container).height())) });
		}
		else if (container.scrollTop > r.y)
		{
			$(container).animate(
				{ scrollTop: "{0}px".format(r.y) });
		}
	
		if (container.scrollLeft < 
			rightToContainer - $(container).width())
		{
			$(container).animate(
				{ scrollLeft: "{0}px".format(rightToContainer - $(container).width()) });
		}
		else if (container.scrollLeft > r.x)
		{
			$(container).animate(
				{ scrollLeft: "{0}px".format(r.x) });
		}
	}
	
	PathView.prototype.experienceFlags = function()
	{
		return this.experienceGroup.selectAll('g.flag');
	}
	
	/* Returns an array of all of the flag controllers */
	PathView.prototype.flagControllers = function()
	{
		return this.experienceFlags().data();
	}
	
	PathView.prototype.appendPathSVG = function()
	{
		var container = d3.select(this.containerDiv);
		
		this.pathwayContainer = container.append('div')
			.classed('pathlines', true);
			
		this.svg = this.pathwayContainer.append('svg')
			.classed('pathway pathlines', true)
			.attr('xmlns', "http://www.w3.org/2000/svg")
			.attr('version', "1.1")
			.on('click', function() 
			{ 
				d3.event.stopPropagation(); 
			});
		
			
		this.emToPX = parseFloat(this.svg.style('font-size'));
		
		/* bg is a rectangle that fills the background with the background color. */
		this.bg = this.svg.append('rect')
			.style('width', '100%')
			.style('height', '100%')
			.attr('fill', this.pathBackground);
			
		this.loadingMessage = crv.appendLoadingMessage(this.containerDiv)
			.style('position', 'absolute')
			.style('left', '0')
			.style('top', this.loadingMessageTop);
		
		this.yearGroup = this.svg.append('g')
			.classed('year', true);
				
		this.guideGroup = this.svg.append('g')
				.classed('guide', true)
				.attr('transform', 'translate({0}, 0)'.format(this.experienceGroupDX));
		
		this.experienceGroup = this.svg.append('g')
				.classed('experiences', true)
				.attr('transform', 'translate({0},{1})'.format(this.experienceGroupDX, this.experienceGroupDY * this.emToPX));
			
	}
	
	PathView.prototype.appendGuides = function(data)
	{
		var _this = this;
		
		var guides = this.guideGroup.selectAll('g')
			.data(data)
			.enter()
			.append('g')
			.attr('transform', function(d, i) { return "translate({0}, 0)".format(i * _this.guideHSpacing); });
			
		guides.append('text')
			.classed('column-label', true)
			.attr('x', 0)
			.attr('y', function(d, i) { return d.labelY; })
			.selectAll('tspan')
			.data(function(d) { return d.name.split(' '); })
			.enter()
			.append('tspan')
			.attr('x', 0)
			.attr('dy', function(d, i) { return "{0}em".format(i); })
			.text(function(d) { return d; });
		guides.append('line')
			.classed('column', true)
			.attr('x1', 0)
			.attr('y1', function(d) { 
				return "{0}em".format(parseFloat(d.labelY) + 0.25 + (1 * (d.name.split(' ').length - 1))); 
				})
			.attr('x2', 0)
			.attr('y2', 500)
			.attr('stroke', function(d) { return d.color; });
	}
	
	PathView.prototype.setupHeights = function()
	{
		var containerBounds = this.containerDiv.getBoundingClientRect();
		var pathwayBounds = this.pathwayContainer.node().getBoundingClientRect();
		var svgHeight = containerBounds.height;
		
		var lastFlag = this.experienceGroup.selectAll('g.flag:last-child');
		var flagHeights = (lastFlag.size() ? lastFlag.datum().y2 + this.experienceGroupDY : this.experienceGroupDY) * this.emToPX + this.bottomNavHeight;
		if (svgHeight < flagHeights)
			svgHeight = flagHeights;

		$(this.svg.node()).height(svgHeight);
		$(this.bg.node()).height(svgHeight);
		this.guideGroup.selectAll('line')
			.attr('y2', svgHeight - this.bottomNavHeight);
	}
		
	/* Set up the widths of the objects based on the data. */
	PathView.prototype.setupWidths = function()
	{
		var guideGroupBounds = this.guideGroup.node().getBBox();
		var newWidth = guideGroupBounds.x + guideGroupBounds.width + this.experienceGroupDX;
		var _this = this;
		
		this.experienceGroup.selectAll('g.flag').each(function (fd)
			{
				var w = _this.experienceGroupDX + fd.x +parseFloat(d3.select(this).selectAll('rect').attr('width'));
				if (newWidth < w)
					newWidth = w;
			});
		$(this.svg.node()).width(newWidth);
		$(this.bg.node()).width(newWidth);
	}
	
	function PathView(sitePanel, containerDiv)
	{
		this.containerDiv = containerDiv;
		this.sitePanel = sitePanel;
		this.allExperiences = [];
		
		if (sitePanel)
		{
			$(this).on("clear.cr", null, null, function() {
				this.clearDetail();
			});
		
			$(containerDiv).on("remove", null, this, function(eventObject)
			{
				eventObject.data.clear();
			});
		}
	}
	
	return PathView;
})();

var PathLines = (function() {
	PathLines.prototype = Object.create(PathView.prototype);
	PathLines.prototype.constructor = PathLines;

	PathLines.prototype.textLeftMargin = 10;
	PathLines.prototype.textDetailRightMargin = 7; /* textRightMargin; */
	
	PathLines.prototype.pathwayContainer = null;
	PathLines.prototype.svg = null;
	PathLines.prototype.loadingMessage = null;
	PathLines.prototype.bg = null;
	PathLines.prototype.loadingText = null;
	PathLines.prototype.promptAddText = null;
	PathLines.prototype.yearGroup = null;
	PathLines.prototype.guideGroup = null;
	PathLines.prototype.experienceGroup = null;

	PathLines.prototype.columnData = PathGuides.data;
	
	/* A flag indicating whether or not the userSet event has been triggered. */
	PathLines.prototype.isUserSet = false;

	PathLines.prototype.handleExperienceDeleted = function(experience)
	{
		var index = this.allExperiences.indexOf(experience);
		if (index >= 0)
			this.allExperiences.splice(index, 1);
		this.clearLayout();
		this.checkLayout();
	};

	/* Lay out all of the contents within the svg object. */
	PathLines.prototype.layout = function()
	{
		var g = this.experienceGroup.selectAll('g.flag');
		
		var _this = this;
		
		g.each(function(fd)
		{
			fd.column = fd.getColumn();
		});
		numColumns = PathGuides.length;
		
		g.selectAll('rect')
			.attr('height', "{0}em".format(this.flagHeightEM))
			.attr('width', function(fd)
				{
					return $(this.parentNode).children('text').outerWidth() + 
						(2 * _this.textDetailLeftMargin);
				});	
		
		/* Restore the sort order to startDate/endDate */
		g.sort(this._compareExperiences);
	
		this._setCoordinates(g);
		
		g.attr('transform', function(fd) { return "translate({0},{1})".format(fd.x, fd.y * _this.emToPX); });
		
		/* Set the line length to the difference between fd.y2 and fd.y, since g is transformed
			to the fd.y position.
		 */
		g.selectAll('line.flag-pole')
			.attr('y2', function(fd) { return "{0}em".format(fd.y2 - fd.y); });
		
		this.layoutYears(g);
		
		this.setupHeights();
		this.setupWidths();
	}

	PathLines.prototype.checkLayout = function()
	{
		if ($(this.containerDiv).width() === 0)
			return;
		
		if (!this.isLayoutDirty)
			return;
		
		this.layout();
		this.isLayoutDirty = false;
	}
	
	PathLines.prototype.redoLayout = function()
	{
		this.clearLayout();
		this.checkLayout();
	}
	
	PathLines.prototype.appendExperiences = function(experience)
	{
		var _this = this;
		
		var g;
		if (experience)
		{
			g = this.experienceGroup.append('g')
				.datum(new FlagController(experience));
		}
		else
		{
			g = this.experienceGroup.selectAll('g')
				.data(this.allExperiences.map(function(e) { return new FlagController(e); }))
				.enter()
				.append('g');
		}
		
		g = this.setupFlags(g);
		
		return g;
	}
	
	PathLines.prototype.handleResize = function()
	{
		var navs = $(this.sitePanel.node()).children('nav');
		this.topNavHeight = $(navs[0]).outerHeight(false);
		this.bottomNavHeight = this.sitePanel.getBottomNavHeight();
		this.pathwayContainer.style('top', "{0}px".format(this.topNavHeight));
		if (this.isLayoutDirty)
			this.checkLayout();
		else
		{
			this.setupHeights();
			this.setupWidths();
		}
	}
		
	PathLines.prototype.showAllExperiences = function()
	{
		var _this = this;
		
		var node = this.sitePanel.node();
		this.allExperiences.filter(function(d)
			{
				return d instanceof cr.Experience;
			})
			.forEach(function(d)
			{
				_this.setupExperienceTriggers(d);
			});
	}
	
	PathLines.prototype.setUser = function(path, editable)
	{
		if (path.privilege() === cr.privileges.find)
			throw "You do not have permission to see information about {0}".format(path.description());
		if (this.path)
			throw "path has already been set for this pathtree";
			
		var _this = this;
		
		this.path = path;
		this.editable = (editable !== undefined ? editable : true);
		
		this.appendPathSVG();
		
		this.appendGuides(PathGuides.data);		
		
		/* setupHeights now so that the initial height of the svg and the vertical lines
			consume the entire container. */
		this.setupHeights();
		
		this.guideGroup.selectAll('g')
			.append('rect')
			.attr('y', function(d, i) { return "{0}em".format(parseFloat(PathGuides.data[i].labelY) - 1.6); })
			.attr('x', -24)
			.attr('height', function(d, i) 
				{ return "{0}px".format(1.2*parseFloat($(this).parent().css('font-size')) + parseFloat($(this).parent().children('text').outerHeight()))
				})
			.attr('width', 48)
			.attr('fill', 'transparent')
			.on('click', function(d, i)
				{
					new ColumnInfoPanel(_this.sitePanel.node(), _this.path, d, unblockClick, cr.syncFail);
				});
		
		$(this.sitePanel.mainDiv.node()).on("resize.cr", function()
			{
				_this.handleResize();
			});

		var successFunction2 = function(experiences)
		{
			if (_this.path == null)
				return;	/* The panel has been closed before this asynchronous action occured. */
			
			try
			{	
				var addedFunction = function(eventObject, newData)
					{
						eventObject.data.addMoreExperience(newData);
					}
				_this.path.on("experienceAdded.cr", _this, addedFunction);
				$(_this.pathwayContainer.node()).on("remove", function()
					{
						_this.path.off("experienceAdded.cr", addedFunction);
					});
				
				_this.allExperiences = experiences.slice();
			
				_this.showAllExperiences();
			
				$(_this.experienceGroup.selectAll('g.flag')[0]).remove();
				_this.appendExperiences();
				_this.clearLayout();
			
				crv.stopLoadingMessage(_this.loadingMessage);
				_this.loadingMessage.remove();
			
				_this.isUserSet = true;
				$(_this).trigger("userSet.cr");
			}
			catch(err)
			{
				crv.stopLoadingMessage(_this.loadingMessage);
				_this.loadingMessage.remove();
				cr.asyncFail(err);
			}
		}
		
		return cr.Service.servicesPromise()
			.then(function() {
				return _this.path.promiseExperiences();
			})
		.then(successFunction2, cr.asyncFail);
	}
	
	function PathLines(sitePanel, containerDiv) {
		PathView.call(this, sitePanel, containerDiv);
		if (sitePanel)
		{
			d3.select(containerDiv).classed('vertical-scrolling', false)
				.classed('all-scrolling', true);
		}
	}
	
	return PathLines;
})();

var AlertButton = (function() {
	AlertButton.prototype.user = null;
	AlertButton.prototype.button = null;
	
	AlertButton.prototype.badgeCount = function()
	{
		throw new Error("Override badgeCount required");
	}
	
	AlertButton.prototype.onClick = function()
	{
		throw new Error ("Override onClick required");
	}
	
	AlertButton.prototype.checkBadge = function()
	{
		this.button.selectAll("span").text(this.badgeCount());
	}
		
	AlertButton.prototype.setup = function(imagePath)
	{
		var _this = this;
		this.button.on("click", 
				function() {
					_this.onClick();
				})
			.classed("settings", true)
			.style("display", this.user.privilege() == cr.privileges.administer ? null : "none")
			.append("img")
			.attr("src", imagePath);
		this.button.append("span")
			.classed("badge", true);
	}
	
	function AlertButton(button, user)
	{
		this.button = button;
		this.user = user;
	}
	
	return AlertButton;
})();

var SettingsButton = (function() {
	SettingsButton.prototype = Object.create(AlertButton.prototype);
	SettingsButton.prototype.constructor = SettingsButton;

	SettingsButton.prototype.onClick = function()
	{
		if (prepareClick('click', "Settings"))
		{
			try
			{
				var controller = new UserController(this.user, true);
				controller.oldInstance(this.user);
				var panel = new Settings(controller, revealPanelUp);
				panel.showUp().always(unblockClick);
			}
			catch(err)
			{
				cr.syncFail(err);
			}
		}
		d3.event.preventDefault();
	}
	
	SettingsButton.prototype.badgeCount = function()
	{
		var cell = this.user.userGrantRequests();
		if (cell && cell.length > 0)
			return cell.length;
		else
			return "";
	}
	
	SettingsButton.prototype.setup = function()
	{
		AlertButton.prototype.setup.call(this, settingsImagePath);
		
		var _this = this;
		this.user.promiseUserGrantRequests()
			.then(function()
				{
					setupOnViewEventHandler(_this.user, "userGrantRequestDeleted.cr userGrantRequestAdded.cr", 
						_this.button.node(), function() { _this.checkBadge(); });
					_this.checkBadge();
				});
	}
	
	function SettingsButton(button, user)
	{
		AlertButton.call(this, button, user);
	}
	
	return SettingsButton;
})();

var NotificationsButton = (function() {
	NotificationsButton.prototype = Object.create(AlertButton.prototype);
	NotificationsButton.prototype.constructor = NotificationsButton;

	NotificationsButton.prototype.onClick = function()
	{
		if (prepareClick('click', "Notifications"))
		{
			try
			{
				var panel = new NotificationsPanel(this.user);
				panel.showUp().always(unblockClick);
			}
			catch(err)
			{
				cr.syncFail(err);
			}
		}
		d3.event.preventDefault();
	}
	
	NotificationsButton.prototype.badgeCount = function()
	{
		var notifications = this.user.notifications();
		if (!notifications)
			return "";
		else {
			var freshItems = notifications.filter(function (d) 
			{ 
				return d.isFresh() == cr.booleans.yes; 
			});
			return freshItems.length || "";
		}
	}
	
	NotificationsButton.prototype.setup = function()
	{
		AlertButton.prototype.setup.call(this, notificationsImagePath);
		
		var _this = this;
		this.user.promiseNotifications()
			.then(function()
				{
					var cell = _this.user;
					cell.on("notificationDeleted.cr notificationAdded.cr", 
						_this.button.node(), function() { _this.checkBadge(); });
					_this.user.notifications().forEach(function(d)
						{
							setupOnViewEventHandler(d, "changed.cr", _this.button.node(),
								 function() { _this.checkBadge(); });
						})
		
					_this.checkBadge();
				},
				cr.asyncFail)
	}
	
	function NotificationsButton(button, user)
	{
		AlertButton.call(this, button, user);
	}
	
	return NotificationsButton;
})();

var PathlinesPanel = (function () {
	PathlinesPanel.prototype = Object.create(crv.SitePanel.prototype);
	PathlinesPanel.prototype.constructor = PathlinesPanel;

	PathlinesPanel.prototype.user = null;
	PathlinesPanel.prototype.pathtree = null;
	PathlinesPanel.prototype.navContainer = null;
		
	PathlinesPanel.prototype.checkSettingsBadge = function(user)
	{
		settingsButton.selectAll("span").text(this.userSettingsBadgeCount(user));
	}
		
	PathlinesPanel.prototype.notificationsBadgeCount = function(user)
	{
		var length = user.notifications().length;
		if (length > 0)
			return length;
		else
			return "";
	}
	
	PathlinesPanel.prototype.setupNotificationsButton = function(button, user)
	{
		var _this = this;
		button
			.on("click", 
				function() {
					if (prepareClick('click', "Notifications"))
					{
						try
						{
							var panel = new NotificationsPanel(user);
							panel.showUp().always(unblockClick);
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
					d3.event.preventDefault();
				})
			.classed("settings", true)
			.style("display", user.privilege() == cr.privileges.administer ? null : "none")
			.append("img")
			.attr("src", notificationsImagePath);
		button.append("span")
			.classed("badge", true)
			.text(this.notificationsBadgeCount(user));
	}
	
	PathlinesPanel.prototype.createExperience = function()
	{
		return new ExperienceController(this.pathtree.path, null, false);
	}
	
	PathlinesPanel.prototype.startNewExperience = function(phase, done, fail)
	{
		try
		{
			var experienceController = this.createExperience();
			experienceController.initDateRange(phase);
							
			new NewExperiencePanel(experienceController)
				.showUp()
				.done(done);
		}
		catch(err)
		{
			fail(err);
		}
	}
	
	PathlinesPanel.prototype.setupAddExperienceButton = function(user, addExperienceButton)
	{
		var _this = this;
		addExperienceButton
			.on("click", function(d) {
				if (prepareClick('click', 'add experience'))
				{
					try
					{
						var path = _this.pathtree.path;
						var experienceController = new ExperienceController(path, null, false);
						var panel = new QuickAddExperiencePanel(_this.node(), experienceController);
						unblockClick();
					}
					catch(err)
					{
						cr.syncFail(err);
					}
				}
				d3.event.preventDefault();
			})
			.classed('add-button', true)
			.style("display", "none");
		addExperienceButton.append("span")
			.classed('site-active-text', true)
			.text("+");
			
		var moreExperiences = user.path();
		var canAddExperience = (moreExperiences.id() === null ? user.canWrite() : moreExperiences.canWrite());
		addExperienceButton.style("display", canAddExperience ? null : "none");
	}
	
	PathlinesPanel.prototype.checkShowIdeas = function()
	{
		var pathtree = this.pathtree;
		if (pathtree.allExperiences.length == 0 && pathtree.editable &&
			pathtree.path.canWrite())
		{
			var idea = new ExperienceIdeas(pathtree.sitePanel.node(), pathtree.path, undefined, asyncFailFunction);
		}
	}
	
	PathlinesPanel.prototype.getBottomNavHeight = function()
	{
		return this.searchPanel ? $(this.searchPanel.topBox).outerHeight(false) : 0;
	}
	
	PathlinesPanel.prototype.setupSearchPanel = function()
	{
		this.searchPanel = new SearchPathsPanel();
	}
	
	/** Returns the FlagController whose experience matches the specified id. */
	PathlinesPanel.prototype.getFlagData = function(id)
	{
		var $group = $(this.panelDiv.node()).find(".experiences>g")
			.filter(function() { 
				return d3.select(this).datum().experience.id() == id; 
				});
				
		if (!$group.get(0))
			throw new Error("This experience is not in the path of {0}.".format(this.pathtree.path.caption()));
			
		return d3.select($group.get(0)).datum();
	}
	
	PathlinesPanel.prototype.showCommentsPanelAsync = function(id)
	{
		var newPanel = new ExperienceCommentsPanel(this.getFlagData(id), this.user.caption());
		newPanel.showLeft();
		return newPanel;
	}
	
	function PathlinesPanel(user, done) {
		var _this = this;
		this.user = user;
		
		this.createRoot(null, "My Pathway", "pathway");

		var panel2Div = this.appendScrollArea();

		this.navContainer = this.appendNavContainer();
		this.navContainer.nav
			.classed("transparentTop", true);

		var settingsButton;
		var notificationsButton;
		var addExperienceButton;
		
		if (done)
		{
			var backButton = this.navContainer.appendLeftButton();
			if (done === true)
				backButton.on('click', function() { _this.hideRightEvent(); });
			else
				backButton.on("click", function()
					{
						if (prepareClick('click', 'Close Right'))
						{
							_this.hideRight(function()
								{
									unblockClick();
									if (done)
										done();
								});
						}
						d3.event.preventDefault();
					});
			backButton.append("span").text(crv.buttonTexts.done);
			
			this.navContainer.appendTitle(user.caption());
		
			addExperienceButton = this.navContainer.appendRightButton();
			settingsButton = this.navContainer.appendRightButton();
		}
		else
		{
			settingsButton = this.navContainer.appendLeftButton();
			notificationsButton = this.navContainer.appendLeftButton();

			this.navContainer.appendTitle(user.caption());
			addExperienceButton = this.navContainer.appendRightButton();
		}

		if (this.pathtree)
			throw "pathtree already assigned to pathtree panel";
			
		this.pathtree = new PathLines(this, panel2Div.node());
		
		function checkTitle()
		{
			_this.navContainer.setTitle(user.caption());
		}
				
		$(this.pathtree).on("userSet.cr", function()
			{
				_this.setupAddExperienceButton(user, addExperienceButton);
				
				_this.settingsAlertButton = new SettingsButton(settingsButton, user);
				_this.settingsAlertButton.setup();
				if (notificationsButton)
				{
					_this.notificationsAlertButton = new NotificationsButton(notificationsButton, user);
					_this.notificationsAlertButton.setup();
				}
				
				setupOnViewEventHandler(user, "changed.cr", _this.node(), checkTitle);
				
// 				findButton.style("display", user.privilege() === cr.privileges.administer ? null : "none");
				
				this.isMinHeight = true;
				$(window).resize();
			});
	}
	
	return PathlinesPanel;
})();

var AddOptions = (function () {
	AddOptions.prototype.addPreviousExperienceLabel = "Add Experience You Have Done";
	AddOptions.prototype.addCurrentExperienceLabel = "Add Experience You Are Doing";
	AddOptions.prototype.addGoalLabel = "Add Goal";
	
	function AddOptions(pathlinesPanel)
	{
		var panelNode = pathlinesPanel.node();
		var dimmer = new Dimmer(panelNode, 200);
		var panel = d3.select(panelNode).append('panel')
			.classed("confirm", true);
		
		function handleCancel(done)
		{
			$(confirmButton.node()).off('blur');
			$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
				$(panel.node()).remove();
				if (done) done();
			});
		}
		function onCancel(e)
		{
			try
			{
				handleCancel();
				dimmer.hide();
			}
			catch(err)
			{
				asyncFailFunction(err);
			}
			e.preventDefault();
		}
		
		function addButton(div, name, clickFunction)
		{
			var button = div.append('button')
				.text(name)
				.classed('site-active-text', true)
				.on('click', function()
					{
						/* Test case: Add Experience You Have Done. */
						/* Test case: Add Experience You Are Doing. */
						/* Test case: Add Experience Goal. */
						if (prepareClick('click', name))
						{
							try
							{
								$.when(dimmer.hide(), 
									   $(panel.node()).hide("slide", {direction: "down"}, 200))
								 .then(function()
									{
										$(panel.node()).remove();
										clickFunction(unblockClick);
									});
							}
							catch (err)
							{
								cr.syncFail(err);
							}
						}
					});
			return button;
		}
		
		var div = panel.append('div')
			.style('margin-bottom', '{0}px'.format(pathlinesPanel.getBottomNavHeight()));
		$(div.node()).click(onCancel);
		
		var confirmButton = addButton(div, this.addPreviousExperienceLabel, 
			function(done)
			{
				pathlinesPanel.startNewExperience('Previous', done, cr.syncFail);
			})
			.classed('butted-down', true);
		$(confirmButton.node()).on('blur', onCancel);
		
		addButton(div, this.addCurrentExperienceLabel, 
			function(done)
			{
				pathlinesPanel.startNewExperience('Current', done, cr.syncFail);
			})
			.classed('butted-down', true);
		
		addButton(div, this.addGoalLabel, 
			function()
			{
				pathlinesPanel.startNewExperience('Goal', unblockClick, cr.syncFail);
			});
			
		addButton(div, 'More Ideas',
			function()
			{
				try
				{
					var path = pathlinesPanel.pathtree.path;
					var experienceController = new ExperienceController(path, null, false);
					var panel = new QuickAddExperiencePanel(panelNode, experienceController);
					panel.done = function()
						{
							skipButton.on('click')();
						};
					unblockClick();
				}
				catch(err)
				{
					syncFailFunction(err);
				}
			});
		
		var cancelButton = addButton(div, 'Cancel', handleCancel);
		
		dimmer.show();
		$(panel.node()).toggle("slide", {direction: "down", duration: 0});
		$(panel.node()).effect("slide", {direction: "down", duration: 400, complete: 
			function() {
				$(confirmButton.node()).focus();
				unblockClick();
			}});
		dimmer.mousedown(onCancel);
		$(panel.node()).mousedown(function(e)
			{
				e.preventDefault();
			});
	}
	
	return AddOptions;
})();

var ExperienceIdeas = (function() {
	
	function ExperienceIdeas(panelNode, path, done, fail)
	{
		var _this = this;
		this.panelNode = panelNode;
		
		var data;
		
		function shuffle(array) {
		  var currentIndex = array.length, temporaryValue, randomIndex;

		  // While there remain elements to shuffle...
		  while (0 !== currentIndex) {

			// Pick a remaining element...
			randomIndex = Math.floor(Math.random() * currentIndex);
			currentIndex -= 1;

			// And swap it with the current element.
			temporaryValue = array[currentIndex];
			array[currentIndex] = array[randomIndex];
			array[randomIndex] = temporaryValue;
		  }

		  return array;
		}

		crp.promise({path: 'experience prompt',
		             resultType: cr.ExperiencePrompt})
			.done(function(prompts)
				{
					try
					{
						/* Remove prompts that have disqualifying tags */
						var experiences = path.experiences();
						prompts = prompts.filter(function(d)
							{
								return !d.disqualifyingTags().find(function(dt)
									{
										var dtID = dt.id();
										return experiences.find(function(experience)
											{
												return experience.experienceServices().find(function(experienceService)
													{
														return experienceService.service().id() == dtID;
													}) ||
													(experience.offering() &&
													 !experience.offering().isEmpty() &&
													 experience.offering().offeringServices().find(function(offeringService)
																{
																	return offeringService.service().id() == dtID;
																}));
											});
									});
							});
						prompts = shuffle(prompts);
						data = prompts.map(function(d)
							{
								var datum = {name: d.name(),
											 prompt: d.text(),
											 experience: new ExperienceController(path, null, false)};
								if (d.experiencePromptServices().length)
								{
									var s = d.experiencePromptServices()[0].service();
									datum.experience.addService(s);
								}
								datum.experience.domain(d.domain());
								datum.experience.stage(d.stage());
								datum.experience.organization(d.organization())
												.site(d.site())
												.offering(d.offering());
								datum.experience.timeframe(d.timeframe());
								datum.experience.title(d.name());
								return datum;
							});
						getGetNext(0, "Here are some ideas to help fill in your pathway", done)();
					}
					catch(err)
					{
						fail(err)
					}
				})
			.fail(fail);
		
		function getGetNext(nextIndex, title, done)
		{
			return function(oldExperiencePanel)
			{
				var getNext = getGetNext(nextIndex < data.length - 1 ? nextIndex + 1 : 0, "", undefined);
				var dimmer;
				if (oldExperiencePanel)
					dimmer = oldExperiencePanel.dimmer;
				else
				{
					dimmer = new Dimmer(_this.panelNode);
					dimmer.show();
				}

				new ExperienceIdeaPanel(_this.panelNode, 
					dimmer,
					title,
					data[nextIndex].prompt,
					data[nextIndex].experience,
					getNext).show(done);
			}
		}
		
		
	}
	
	return ExperienceIdeas;
})();

var ExperienceIdeaPanel = (function() {
	ExperienceIdeaPanel.prototype.panelNode = null;
	ExperienceIdeaPanel.prototype.dimmer = null;
	
	ExperienceIdeaPanel.prototype.show = function(done)
	{
		$(this.ideaPanel.node()).css('top',
			"{0}px".format(($(this.panelNode).height() - $(this.ideaPanel.node()).outerHeight()) / 2));
		var newLeft = "{0}px".format(($(this.panelNode).width() - $(this.ideaPanel.node()).outerWidth()) / 2);
		$(this.ideaPanel.node()).animate({left: newLeft},
			{done: done});
	}
	
	function ExperienceIdeaPanel(panelNode, dimmer, title, prompt, experienceController, getNext)
	{
		var _this = this;
		this.panelNode = panelNode;
		this.dimmer = dimmer;
		this.ideaPanel = d3.select(panelNode).append('panel')
			.classed('idea', true)
			.style('left', '100%');
			
		var onCancel = function()
		{
			_this.dimmer.hide();
			_this.ideaPanel.remove();
		}
		
		if (title)
			this.ideaPanel.append('div')
				.classed('title', true)
				.text(title);
		
		var promptDiv = this.ideaPanel.append('div')
			.classed('prompt', true)
			.text(prompt);
		
		var footer = this.ideaPanel.append('footer');
		
		var skipButton = footer.append('button')
			.classed('skip', true)
			.text('Skip')
			.on('click', function()
				{
					var newLeft = -($(_this.ideaPanel.node()).width() + $(closeButton.node()).width());
					$(_this.ideaPanel.node()).animate({left: newLeft},
						{done: function()
							{
								_this.ideaPanel.remove();
								getNext(_this);
							}});
				});
		
		var answerButton = footer.append('button')
			.classed('answer', true)
			.text('Answer')
			.on('click', function()
				{
					if (prepareClick('click', 'Answer Experience Prompt'))
					{
						try
						{
							var panel = new QuickAddExperiencePanel(experienceController);
							panel.done = function()
								{
									skipButton.on('click')();
								};
							panel.showLeft()
								.always(unblockClick);
						}
						catch(err)
						{
							syncFailFunction(err);
						}
					}
				});
		
		var closeButton = this.ideaPanel.append('button')
			.classed('close', true)
			.on('click', onCancel);
		var closeSpan = closeButton.append('span')
			.text(String.fromCharCode(215)	/* 215 - unicode value for times character */);
		
		this.dimmer.mousedown(onCancel);
		this.dimmer.show();
	}
	return ExperienceIdeaPanel;
})();

var OtherPathlines = (function() {
	OtherPathlines.prototype = Object.create(PathLines.prototype);
	OtherPathlines.prototype.constructor = OtherPathlines;

	OtherPathlines.prototype.detailAddToPathRect = null;
	
	OtherPathlines.prototype.canEditExperience = function(fd, i)
	{
		return false;
	}
	
	OtherPathlines.prototype.handleAddToPathway = function(fd)
	{
		if (prepareClick('click', "Add to My Pathway"))
		{
			try
			{
				var controller = new ExperienceController(cr.signedinUser.path(), fd.experience, false);
				new NewExperiencePanel(controller)
					.showUp()
					.always(unblockClick);
			}
			catch(err)
			{
				cr.syncFail(err);
			}
		}
	}
	
	function OtherPathlines(sitePanel, containerDiv)
	{
		PathLines.call(this, sitePanel, containerDiv);
	}
	
	return OtherPathlines;
})();

var OtherPathPanel = (function () {
	OtherPathPanel.prototype = Object.create(crv.SitePanel.prototype);
	OtherPathPanel.prototype.constructor = OtherPathPanel;

	OtherPathPanel.prototype.path = null;
	OtherPathPanel.prototype.pathtree = null;
	OtherPathPanel.prototype.navContainer = null;
	
	OtherPathPanel.prototype.getBottomNavHeight = function()
	{
		return 0;
	}
	
	function OtherPathPanel(path, done) {
		var _this = this;
		this.path = path;
		
		this.createRoot(null, "Other Pathway", "pathway");

		var panel2Div = this.appendScrollArea();

		this.navContainer = this.appendNavContainer();
		this.navContainer.nav
			.classed("transparentTop", true);

		if (done)
		{
			var backButton = this.navContainer.appendLeftButton();
			if (done === true)
				backButton.on('click', function() { _this.hideRightEvent(); });
			else
				backButton.on("click", function()
					{
						if (prepareClick('click', 'Close Right'))
						{
							_this.hideRight(function()
								{
									unblockClick();
									if (done)
										done();
								});
						}
						d3.event.preventDefault();
					});
			backButton.append("span").text(crv.buttonTexts.done);
		}

		var user = path.user();
		
		
		this.navContainer.appendTitle(path.caption());
		
		if (this.pathtree)
			throw new Error("pathtree already assigned to pathtree panel");
			
		this.pathtree = new OtherPathlines(this, panel2Div.node());
		
		$(this.pathtree).on("userSet.cr", function()
			{
				this.isMinHeight = true;
				this.handleResize();
			});
	}
	
	return OtherPathPanel;
})();

var ColumnInfoPanel = (function() {
	
	ColumnInfoPanel.prototype.showIdeaPanel = function(done)
	{
		$(this.ideaPanel.node()).css('top',
			"{0}px".format(($(this.panelNode).height() - $(this.ideaPanel.node()).outerHeight()) / 2));
		var newLeft = "{0}px".format(($(this.panelNode).width() - $(this.ideaPanel.node()).outerWidth()) / 2);
		$(this.ideaPanel.node()).animate({left: newLeft},
			{done: done});
	}
	
	function ColumnInfoPanel(panelNode, path, guideData, done, fail)
	{
		var _this = this;
		this.panelNode = panelNode;
		
		var data;
		
		try
		{
			var dimmer = new Dimmer(this.panelNode);
			dimmer.show();
			var onCancel = function()
			{
				dimmer.hide();
				_this.ideaPanel.remove();
			}
		
			dimmer.mousedown(onCancel);
			
			this.ideaPanel = d3.select(panelNode).append('panel')
				.classed('idea', true)
				.style('left', '100%');
			
			this.ideaPanel.append('div')
				.classed('title', true)
				.text(guideData.name);
		
			var promptDiv = this.ideaPanel.append('div')
				.classed('prompt', true)
				.html(PathGuides.help[guideData.name]);
		
			var footer = this.ideaPanel.append('footer');
		
			var column = PathGuides.data.indexOf(guideData);
			var filter = function(fs)
				{
					if (fs instanceof ServiceFlagController)
						return fs.service.getColumn() == column;
					else
						return fs.getColumn() == column;
				}
				
			var skipButton = footer.append('button')
				.classed('skip', true)
				.text("Add {0} Experience".format(guideData.name))
				.on('click', function()
					{
						if (prepareClick('click', "Add {0} Experience".format(guideData.name)))
						{
							try
							{
								var controller = new ExperienceController(path, null, false);
								var panel = new QuickAddExperiencePanel(panelNode, controller, dimmer, filter, ['Previous', 'Current']);
								panel.promise
									.fail(function(err)
									{
										dimmer.hide();
									})
									.always(function()
										{
											var newLeft = -($(_this.ideaPanel.node()).width() + $(closeButton.node()).width());
											$(_this.ideaPanel.node()).animate({left: newLeft},
												{done: function()
													{
														_this.ideaPanel.remove();
														unblockClick();
													}});
										});
							}
							catch(err)
							{
								cr.syncFail(err);
							}
						}
					});
		
			var answerButton = footer.append('button')
				.classed('answer', true)
				.text("Add {0} Goal".format(guideData.name))
				.on('click', function()
					{
						if (prepareClick('click', "Add {0} Goal".format(guideData.name)))
						{
							try
							{
								var controller = new ExperienceController(path, null, false);
								var panel = new QuickAddExperiencePanel(panelNode, controller, dimmer, filter, ['Goal']);
								panel.promise
									.fail(function(err)
									{
										dimmer.hide();
										unblockClick();
									})
									.always(function()
										{
											var newLeft = -($(_this.ideaPanel.node()).width() + $(closeButton.node()).width());
											$(_this.ideaPanel.node()).animate({left: newLeft},
												{done: function()
													{
														_this.ideaPanel.remove();
														unblockClick();
													}});
										});
							}
							catch(err)
							{
								cr.syncFail(err);
							}
						}
					});
		
			var closeButton = this.ideaPanel.append('button')
				.classed('close', true)
				.on('click', onCancel);
			var closeSpan = closeButton.append('span')
				.text(String.fromCharCode(215)	/* 215 - unicode value for times character */);
		
			this.showIdeaPanel();
		}
		catch(err)
		{
			fail(err)
		}
	}
	
	return ColumnInfoPanel;
})();

