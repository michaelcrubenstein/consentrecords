/* pathtreePanel.js */

var Service = (function() {
	Service.prototype.service = null;
	
	Service.prototype._getStage = function()
	{
		var service = this.service;
		return service && service.getInstanceID() && crp.getInstance(service.getInstanceID()).getValue("Stage")
	}

	Service.prototype.stageColumns = {
		Housing: 0,
		Studying: 1,
		Certificate: 1,
		Training: 2,
		Whatever: 2,
		Working: 3,
		Teaching: 3,
		Expert: 3,
		Skills: 4,
		Mentoring: 5,
		Tutoring: 5,
		Coaching: 5,
		Volunteering: 5,
		Wellness: 6,
	};
	
	Service.prototype.columnPriorities = [0, 2, 4, 1, 3, 5, 6, 7];
	
	Service.prototype.getStageDescription = function(stage)
	{
		var stageDescription = stage && stage.getDescription();
		return stageDescription in this.stageColumns && stageDescription;
	}
	
	Service.prototype.getColumn = function()
	{
		var stage = this._getStage();
		var stageDescription = this.getStageDescription(stage);
		if (stageDescription)
			return this.stageColumns[stageDescription];
		var _this = this;
			
		if (this.service && this.service.getInstanceID())
		{
			var services = crp.getInstance(this.service.getInstanceID()).getCell("Service");
			var s = services.data.find(function(s)
				{
					var stage =  s.getInstanceID() && crp.getInstance(s.getInstanceID()).getValue("Stage");
					return _this.getStageDescription(stage);
				});
			if (s)
				return this.stageColumns[
					this.getStageDescription(crp.getInstance(s.getInstanceID()).getValue("Stage"))
				];
		}

		/* Other */
		return 7;
	}
	
	Service.prototype.getColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].color;
	}
	
	Service.prototype.fontColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].fontColor;
	}
	
	Service.prototype.getDescription = function()
	{
		return this.service.getDescription();
	}
	
	/* Returns True if the service contains the specified text. */
	Service.prototype.contains = function(s)
	{
		if (this.service)
		{
			if (this.service.getDescription().toLocaleUpperCase().indexOf(s) >= 0)
				return true;
			
			var cell = this.service.getCell("Service");
			return cell.data.find(function(d) { return d.getDescription().toLocaleUpperCase() == s; });	
		}
		return false;
	}
	
	Service.prototype.colorElement = function(r)
	{
		var colorText = this.getColor();
		r.setAttribute("fill", colorText);
		r.setAttribute("stroke", colorText);
	}
	
	function Service(dataObject) {
		this.service = dataObject;
	}
	
	return Service;
})();

var FlagData = (function() {
	FlagData.prototype.experience = null;
	FlagData.prototype.x = null;
	FlagData.prototype.y = null;
	FlagData.prototype.height = null;
	FlagData.prototype.width = null;
	
	FlagData.prototype.previousDateString = "0000-00";
	FlagData.prototype.goalDateString = "9999-12-31";
	
	FlagData.prototype.textDetailLeftMargin = 10; /* textLeftMargin; */

	/* Constants related to the detail text. */
	FlagData.prototype.detailTopSpacing = "1.5em";		/* The space between lines of text in the detail box. */
	FlagData.prototype.detailOrganizationSpacing = "1.5em";	/* The space between lines of text in the detail box. */
	FlagData.prototype.detailSiteSpacing = "1.3em";	/* The space between lines of text in the detail box. */
	FlagData.prototype.detailDateSpacing = "1.5em";	/* The space between lines of text in the detail box. */
	FlagData.prototype.detailTagSpacing = "1em";		/* The space between lines of text in the detail box. */
	
	FlagData.prototype.getDescription = function()
	{
		var _this = this;
		var f = function(name)
		{
			var d = _this.experience.getValue(name);
			return d && d.getInstanceID() && d.getDescription();
		}
		return f("Offering") ||
			this.experience.getDatum("User Entered Offering") ||
			f("Service") ||
			this.experience.getDatum("User Entered Service") ||
			"None";
	}
	
	FlagData.prototype.subHeading = function()
	{
		var _this = this;
		var f = function(name)
		{
			var d = _this.experience.getValue(name);
			return d && d.getInstanceID() && d.getDescription();
		}
		return f("Organization") ||
			this.experience.getDatum("User Entered Organization") ||
			f("Site") ||
			this.experience.getDatum("User Entered Site") ||
			"";
	}
	
	FlagData.prototype.pickedOrCreatedValue = function(pickedName, createdName)
	{
		return getPickedOrCreatedValue(this.experience, pickedName, createdName);
	}
	
	FlagData.prototype.getColumn = function()
	{
		var minColumn = Service.prototype.columnPriorities[Service.prototype.columnPriorities.length - 1];
		
		var offering = this.experience.getValue("Offering");
		if (offering && offering.getInstanceID())
		{
			if (!offering.areCellsLoaded())
				throw ("Runtime error: offering data is not loaded");
				
			var services = offering.getCell("Service");
			minColumn = services.data.map(function(s) {
					return new Service(s).getColumn();
				})
				.reduce(function(a, b) {
					return a < b ? a : b; }, minColumn);
		}
		
		var service = this.experience.getCell("Service");
		if (service)
		{
			minColumn = service.data.map(function(s) {
						return new Service(s).getColumn();
					})
					.reduce(function(a, b) {
						return a < b ? a : b; }, minColumn);
		}
		return minColumn;
	}
	
	FlagData.prototype.getStartDate = function()
	{
		return this.experience.getDatum("Start") || this.getTimeframeText() || this.goalDateString;
	}
	
	FlagData.prototype.getTimeframe = function()
	{
		var timeframeValue = this.experience.getValue("Timeframe");
		return timeframeValue && timeframeValue.getInstanceID() && timeframeValue.getDescription();
	}
	
	FlagData.prototype.getEndDate = function()
	{
		var s = this.experience.getDatum("End");
		if (s) return s;
		
		var timeframe = this.getTimeframe();
		s = this.experience.getDatum("Start");
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
	
	FlagData.prototype.getTimeframeText = function()
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
	
	FlagData.prototype.startsBeforeOtherEnd = function(otherFD)
	{
		return this.getStartDate() < otherFD.getEndDate();
	}
	
	FlagData.prototype.getYearArray = function()
	{
		var e = this.experience.getDatum("End");
		var s = this.experience.getDatum("Start");
		var t = this.experience.getValue("Timeframe");
		var top, bottom;
		
		if (e)
			top = new Date(e).getUTCFullYear();
		else if (s)
			top = "Now";
		else if (t && t.getDescription() == "Previous")
			top = "Done";
		else if (t && t.getDescription() == "Current")
			top = "Now";
		else
			top = "Goal";
			
		if (s)
			bottom = new Date(s).getUTCFullYear();
		else if (t && t.getDescription() == "Previous")
			bottom = "Done";
		else if (t && t.getDescription() == "Current")
			bottom = "Now";
		else
			bottom = "Goal";
		
		return {top: top, bottom: bottom};
	}
	
	FlagData.prototype.getColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].color;
	}
	
	FlagData.prototype.fontColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].fontColor;
	}
	
	FlagData.prototype.checkOfferingCells = function(done)
	{
		var offering = this.experience.getValue("Offering");
		if (offering && offering.getInstanceID() && !offering.areCellsLoaded())
		{
			offering.promiseCellsFromCache()
				.then(done, cr.asyncFail);
		}
		else
			done();
	}
	
	FlagData.prototype.colorElement = function(r)
	{
		var _this = this;
		var f = function()
			{
				var column = _this.getColumn();
				var colorText = PathGuides.data[column].color;
				r.setAttribute("fill", colorText);
				r.setAttribute("stroke", colorText);
			}
		this.checkOfferingCells(f);
	}
	
	FlagData.appendWrappedText = function(s, newSpan, maxWidth)
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
	
	FlagData.prototype.appendTSpans = function(detailGroup, maxWidth, x)
	{
		x = x !== undefined ? x : this.textDetailLeftMargin;
		
		detailGroup.selectAll('text').remove();
		detailGroup.selectAll('line').remove();
		
		var title;
		var tspan;
		title = this.pickedOrCreatedValue("Offering", "User Entered Offering");
		if (!title)
		{
			var serviceValue = this.experience.getValue("Service");
			var userServiceValue = this.experience.getValue("User Entered Service");

			if (serviceValue)
				title = serviceValue.getDescription();
			else if (userServiceValue)
				title = userServiceValue.getDescription();
		}
		var orgString = this.pickedOrCreatedValue("Organization", "User Entered Organization");
		var siteString = this.pickedOrCreatedValue("Site", "User Entered Site");
		if (siteString == orgString)
			siteString = "";
		var dateRange = getDateRange(this.experience);
		var tagDescriptions = getTagList(this.experience);
		var lineHeight = 0;
		var lineMargin = 3;
		
		if (title)
		{
			tspan = detailGroup.append('text')
				.classed('flag-label', true)
				.text(title)
				.attr("x", x)
				.attr("dy", this.detailTopSpacing)
				.attr("fill", this.fontColor());
			lineHeight = tspan.node().getBBox().y + tspan.node().getBBox().height + lineMargin;
		}
		
		if (orgString)
		{
			tspan = detailGroup.append('text')
				.classed('detail-organization', true)
				.text(orgString)
				.attr("x", x)
				.attr("fill", this.fontColor());
			tspan.attr('y', lineHeight + tspan.node().getBBox().height || this.detailTopSpacing)
			lineHeight = tspan.node().getBBox().y + tspan.node().getBBox().height + lineMargin;
		}

		if (siteString)
		{
			if (orgString)
				lineHeight -= lineMargin;
			tspan = detailGroup.append('text')
				.classed('site', true)
				.text(siteString)
				.attr("x", x)
				.attr("fill", this.fontColor());
			tspan.attr('y', lineHeight + tspan.node().getBBox().height || this.detailTopSpacing)
			lineHeight = tspan.node().getBBox().y + tspan.node().getBBox().height + lineMargin;
		}

		if (dateRange)
		{
			if (lineHeight > 0)
			{
				detailGroup.append('line')
					.attr('x1', x)
					.attr('x2', maxWidth)
					.attr('y1', lineHeight)
					.attr('y2', lineHeight)
					.attr('stroke', this.fontColor());
				lineHeight += lineMargin;
			}
			tspan = detailGroup.append('text')
				.classed('detail-dates', true)
				.text(dateRange)
				.attr("x", x)
				.attr("fill", this.fontColor());
			tspan.attr('y', lineHeight + tspan.node().getBBox().height || this.detailTopSpacing)
			lineHeight = tspan.node().getBBox().y + tspan.node().getBBox().height + lineMargin;
		}
		
		if (tagDescriptions)
		{
			var _this = this;
			if (lineHeight > 0)
			{
				detailGroup.append('line')
					.attr('x1', x)
					.attr('x2', maxWidth)
					.attr('y1', lineHeight)
					.attr('y2', lineHeight)
					.attr('stroke', this.fontColor());
				lineHeight += lineMargin;
			}
			var detailText = detailGroup.append('text')
				.attr("x", x)
				.attr("y", lineHeight || this.detailTopSpacing);
			FlagData.appendWrappedText(tagDescriptions, function(spanIndex)
				{
					return detailText.append("tspan")
						.classed('tags', true)
						.attr("x", x)
						.attr("dy", _this.detailTagSpacing)
						.attr("fill", _this.fontColor());
				},
				maxWidth);
		}
	}
	
	FlagData.prototype.appendText = function(container, maxWidth)
	{
		var detailText = container.append('text');
		maxWidth = maxWidth !== undefined ? maxWidth : 0;
		
		this.appendTSpans(detailText, maxWidth);
		
		return detailText;
	}
	
	FlagData.prototype.setupChangeEventHandler = function(data, handler)
	{
		var experience = this.experience;
		
		var allCells = [experience.getCell("Organization"),
		 experience.getCell("User Entered Organization"),
		 experience.getCell("Site"),
		 experience.getCell("User Entered Site"),
		 experience.getCell("Offering"),
		 experience.getCell("User Entered Offering"),
		 experience.getCell("Start"),
		 experience.getCell("End"),
		 experience.getCell("Timeframe"),
		 experience.getCell("Service"),
		 experience.getCell("User Entered Service")];
		 
		var serviceCells = [experience.getCell("Service"),
		 experience.getCell("User Entered Service")];
		 
		allCells.forEach(function(cell)
		 {
			/* cell will be null if the experience came from the organization for the 
				User Entered Organization and User Entered Site.
			 */
			if (cell)
			{
				setupOnViewEventHandler(cell, "valueAdded.cr valueDeleted.cr dataChanged.cr", data, handler);
			}
		 });
		serviceCells.forEach(function(cell)
		 {
			/* cell will be null if the experience came from the organization for the 
				User Entered Organization and User Entered Site.
			 */
			if (cell)
			{
				setupOnViewEventHandler(cell, "valueDeleted.cr", data, handler);
			}
		 });
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
							  
	PathView.prototype.emToPX = 11;
							  
	PathView.prototype.handleChangedExperience = function(r, fd)
	{
		var _this = this;
		
		var expChanged = function(eventObject)
		{
			fd.colorElement(eventObject.data);
		}
		
		fd.experience.on("dataChanged.cr", r, expChanged);
		$(this).on("remove", null, fd.experience, function(eventObject)
		{
			eventObject.data.off("dataChanged.cr", expChanged);
		});
	}

	/* Sets up a trigger when a service changes, or a non-empty service is added or deleted.
		The trigger runs the specified handler.
	 */
	PathView.prototype.setupServiceTriggers = function(r, fd, handler)
		{
			var e = fd.experience;
			var serviceCell = e.getCell("Service");
			var userServiceCell = e.getCell("User Entered Service");
			var f = function(eventObject, v)
			{
				if (!v.isEmpty())
					handler(eventObject, v);
			}
			
			setupOnViewEventHandler(serviceCell, "valueAdded.cr valueDeleted.cr dataChanged.cr", r, f);
			setupOnViewEventHandler(userServiceCell, "valueAdded.cr valueDeleted.cr dataChanged.cr", r, f);
		}
	
	/* Sets up a trigger when a service changes, or a non-empty service is added or deleted.
		The trigger sets the color of the specified element (r).
	 */	
	PathView.prototype.setupColorWatchTriggers = function(r, fd)
	{
		var e = fd.experience;
		var offeringCell = e.getCell("Offering");
		
		var f = function(eventObject)
			{
				var fd = d3.select(eventObject.data).datum();
				fd.colorElement(eventObject.data);
			}
		
		setupOneViewEventHandler(offeringCell, "valueAdded.cr valueDeleted.cr dataChanged.cr", r, f);
		this.setupServiceTriggers(r, fd, f);
	}
	
	PathView.prototype.checkOfferingCells = function(experience, done)
	{
		offering = experience.getValue("Offering");
		if (offering && offering.getInstanceID() && !offering.areCellsLoaded())
		{
			var storedI = crp.getInstance(offering.getInstanceID());
			if (storedI != null)
			{
				offering.importCells(storedI.getCells());
				if (done) done();
			}
			else
			{
				var r1 = offering.promiseCells()
					.fail(cr.asyncFail);
				if (done)
					r1.done(done);
			}
		}
		else
		{
			if (done) done();
		}
	}
	
	PathView.prototype.canEditExperience = function(fd)
	{
		return fd.experience.getTypeName() == "More Experience" && fd.experience.canWrite();
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
		if (fd.experience.getTypeName() == "Experience") {
			;	/* Nothing to edit */
		}
		else
		{
			if (prepareClick('click', 'show experience detail: ' + fd.getDescription()))
			{
				try
				{
					var panel = this.sitePanel.node();
					var experience = new Experience(fd.experience.cell.parent, fd.experience);
					experience.replaced(fd.experience);
					
					var editPanel = new NewExperiencePanel(experience, experience.getPhase(), revealPanelLeft);
					
					editPanel.showLeft().then(unblockClick);
				}
				catch(err)
				{
					cr.syncFail(err);
				}
				d3.event.stopPropagation();
			}
		}
	}
	
	PathView.prototype.showCommentsPanel = function(flag, fd)
	{
		if (fd.experience.getTypeName() == "Experience") {
			;	/* Nothing to edit */
		}
		else
		{
			if (prepareClick('click', 'show experience comments: ' + fd.getDescription()))
			{
				try
				{
					d3.select(flag).selectAll('rect.bg')
						.transition()
						.duration(200)
						.style('fill-opacity', 0.4);
					var newPanel = new ExperienceCommentsPanel(fd);
					newPanel.showLeft()
						.always(function()
							{
								d3.select(flag).selectAll('rect.bg')
									.style('fill-opacity', 0.2);
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
			_this.checkOfferingCells(exp,
				function()
				{
					_this.clearLayout();
					_this.checkLayout();
				});
		}
	
		var handleExperienceDateChanged = function(eventObject)
		{
			var g = _this.experienceGroup.selectAll('g.flag');
			_this.transitionPositions(g);
		}
	
		var node = this.sitePanel.node();
		setupOnViewEventHandler(experience, "dataChanged.cr", node, handleDataChanged);
		setupOnViewEventHandler(experience.getCell("Start"), "valueAdded.cr valueDeleted.cr dataChanged.cr", node, handleExperienceDateChanged);
		setupOnViewEventHandler(experience.getCell("End"), "valueAdded.cr valueDeleted.cr dataChanged.cr", node, handleExperienceDateChanged);
		setupOnViewEventHandler(experience.getCell("Timeframe"), "valueAdded.cr valueDeleted.cr dataChanged.cr", node, handleExperienceDateChanged);
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
		
		setupOneViewEventHandler(fd.experience, "valueDeleted.cr", node, function(eventObject)
			{
				$(eventObject.data).remove();
				_this.handleValueDeleted(this);
			});
		
		var flagCells = ["Organization",
		 	"User Entered Organization",
		 	"Site",
		 	"User Entered Site",
		 	"Offering",
		 	"User Entered Offering",
		 	"Service",
		 	"User Entered Service"];
		
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
						
		flagCells.forEach(function(s)
		 {
			/* cell will be null if the experience came from the organization for the 
				User Entered Organization and User Entered Site.
			 */
			var cell = fd.experience.getCell(s);
			if (cell)
			{
				setupOnViewEventHandler(cell, "valueAdded.cr valueDeleted.cr dataChanged.cr", node, flagDataChanged);
			}
		 });
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
				return d2 <= thisYear ? 1 : -1;
		}
		else if (d2 === "Now")
			return d1 <= thisYear ? -1 : 1;
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
							d.column = d.getColumn();
							_this.transitionPositions(g);
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
			.attr('fill', function(d) { return d.fontColor(); });
		text.append('tspan')
			.attr('x', this.textDetailLeftMargin)
			.attr('dy', this.flagLineTwoDY)
			.attr('fill', function(d) { return d.fontColor(); });
		
		g.each(function() { _this._setFlagText(this); });
		
		return g;
	}
	
	PathView.prototype.addMoreExperience = function(experience)
	{
		this.checkOfferingCells(experience);
		
		this.allExperiences.push(experience);
		
		this.setupExperienceTriggers(experience);
		
		var flags = this.appendExperiences(experience);

		this.redoLayout();
		
		this.updateDetail(flags.node(), flags.datum());
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
						.attr('y1', _this.experienceGroupDY + (years[keyI].y - 1.3) * _this.emToPX)
						.attr('x2', _this.yearTextX2)
						.attr('y2', _this.experienceGroupDY + (years[keyI].y - 1.3) * _this.emToPX)
						.attr('stroke', '#CCC');
				_this.yearGroup.append('text')
					.text(years[keyI].text)
					.attr('x', _this.yearTextX)
					.attr('y', _this.experienceGroupDY + years[keyI].y * _this.emToPX);
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
	
	PathView.prototype.transitionPositions = function(g)
	{
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
	PathLines.prototype = new PathView();
		
	PathLines.prototype.textLeftMargin = 10;
	PathLines.prototype.textDetailRightMargin = 7; /* textRightMargin; */
	PathLines.prototype.pathBackground = "white";
	PathLines.prototype.showDetailIconWidth = 18;
	PathLines.prototype.loadingMessageTop = "4.5em";
	PathLines.prototype.promptRightMargin = 14;		/* The minimum space between the prompt and the right margin of the svg's container */
	
	/* Translate coordinates for the elements of the experienceGroup within the svg */
	PathLines.prototype.experienceGroupDX = 40;
	PathLines.prototype.experienceGroupDY = 37;
	
	PathLines.prototype.detailRectX = 1.5;
	
	PathLines.prototype.pathwayContainer = null;
	PathLines.prototype.svg = null;
	PathLines.prototype.loadingMessage = null;
	PathLines.prototype.bg = null;
	PathLines.prototype.loadingText = null;
	PathLines.prototype.promptAddText = null;
	PathLines.prototype.yearGroup = null;
	PathLines.prototype.guideGroup = null;
	PathLines.prototype.experienceGroup = null;

	PathLines.prototype.flagWidth = 0;
	
	PathLines.prototype.columnData = PathGuides.data;
	
	/* A flag indicating whether or not the userSet event has been triggered. */
	PathLines.prototype.isUserSet = false;

	PathLines.prototype.handleValueDeleted = function(experience)
	{
		var index = this.allExperiences.indexOf(experience);
		var _this = this;
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
				.datum(new FlagData(experience));
		}
		else
		{
			g = this.experienceGroup.selectAll('g')
				.data(this.allExperiences.map(function(e) { return new FlagData(e); }))
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
				return d.getTypeName() === "More Experience";
			})
			.forEach(function(d)
			{
				_this.setupExperienceTriggers(d);
			});
	}
	
	PathLines.prototype.setupHeights = function()
	{
		var containerBounds = this.containerDiv.getBoundingClientRect();
		var pathwayBounds = this.pathwayContainer.node().getBoundingClientRect();
		//var svgHeight = containerBounds.height - (pathwayBounds.top - containerBounds.top);
		var svgHeight = containerBounds.height;
		
		var lastFlag = this.experienceGroup.selectAll('g.flag:last-child');
		var flagHeights = (lastFlag.size() ? (lastFlag.datum().y2 * this.emToPX) + this.experienceGroupDY : this.experienceGroupDY) + this.bottomNavHeight;
		if (svgHeight < flagHeights)
			svgHeight = flagHeights;

		$(this.svg.node()).height(svgHeight);
		$(this.bg.node()).height(svgHeight);
		this.guideGroup.selectAll('line')
			.attr('y2', svgHeight - this.bottomNavHeight);
	}
	
	/* Set up the widths of the objects based on the data. */
	PathLines.prototype.setupWidths = function()
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
	
	PathLines.prototype.getUser = function()
	{
		return this.path.getValue("_user");
	}
	
	PathLines.prototype.setUser = function(path, editable)
	{
		if (path.getPrivilege() === '_find')
			throw "You do not have permission to see information about {0}".format(path.getDescription());
		if (this.path)
			throw "path has already been set for this pathtree";
			
		var _this = this;
		
		this.path = path;
		this.editable = (editable !== undefined ? editable : true);
		
		var container = d3.select(this.containerDiv);
		
		this.pathwayContainer = container.append('div')
			.classed("pathlines", true);
			
		this.svg = this.pathwayContainer.append('svg')
			.classed("pathway pathlines", true)
			.attr('xmlns', "http://www.w3.org/2000/svg")
			.attr('version', "1.1");
		
		/* bg is a rectangle that fills the background with the background color. */
		this.bg = this.svg.append('rect')
			.style("width", "100%")
			.style("height", "100%")
			.attr("fill", this.pathBackground);
			
		this.loadingMessage = crv.appendLoadingMessage(this.containerDiv)
			.style("position", "absolute")
			.style("left", "0")
			.style("top", this.loadingMessageTop);
		
		this.yearGroup = this.svg.append('g')
			.classed('year', true);
				
		this.guideGroup = this.svg.append('g')
				.classed("guide", true)
				.attr('transform', "translate({0}, 0)".format(this.experienceGroupDX));
				
		var guides = this.guideGroup.selectAll('g')
			.data(PathGuides.data)
			.enter()
			.append('g')
			.attr('transform', function(d, i) { return "translate({0}, 0)".format(i * _this.guideHSpacing); });
			
		guides.append('rect')
			.classed('column-icon', true)
			.attr('x', -10)
			.attr('y', function(d) { return d.labelY - 31; })
			.attr('height', 20)
			.attr('width', 20)
			.attr('stroke', function(d) { return d.color; })
			.attr('fill', function(d) { return d.color; });
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
				return d.labelY + 3 + (9 * (d.name.split(' ').length - 1)); 
				})
			.attr('x2', 0)
			.attr('y2', 500)
			.attr('stroke', function(d) { return d.color; });
		
		this.experienceGroup = this.svg.append('g')
				.classed("experiences", true)
				.attr('transform', 'translate({0},{1})'.format(this.experienceGroupDX, this.experienceGroupDY));
			
		d3.select(this.containerDiv)
			.on("click", function() 
			{ 
				d3.event.stopPropagation(); 
			});
		
		/* setupHeights now so that the initial height of the svg and the vertical lines
			consume the entire container. */
		this.setupHeights();
		
		$(this.sitePanel.mainDiv.node()).on("resize.cr", function()
			{
				_this.handleResize();
			});

		var successFunction2 = function()
		{
			if (_this.path == null)
				return;	/* The panel has been closed before this asynchronous action occured. */
			
			try
			{	
				var cell = _this.path.getCell("More Experience");
				var addedFunction = function(eventObject, newData)
					{
						eventObject.data.addMoreExperience(newData);
					}
				cell.on("valueAdded.cr", _this, addedFunction);
				$(_this.pathwayContainer.node()).on("remove", function()
					{
						cell.off("valueAdded.cr", addedFunction);
					});
				
				var experiences = cell.data;
			
				_this.allExperiences = _this.allExperiences.concat(experiences);
			
				$(experiences).each(function()
				{
					this.calculateDescription();
				});
			
				/* Ensure that all of the offerings have their associated cells. */
				_this.allExperiences.forEach(function(experience)
					{
						_this.checkOfferingCells(experience, null);
					});
		
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
		
		return crp.promise({path:  "#" + this.path.getInstanceID() + '::reference(_user)::reference(Experience)', 
				   fields: ["parents"]})
		.then(function(experiences)
			{
				_this.allExperiences = experiences.slice();
				$(experiences).each(function()
				{
					this.setDescription(this.getValue("Offering").getDescription());
				});
			})
		.then(function() {
			return crp.promise({path: "#" + _this.path.getInstanceID() + '::reference(_user)::reference(Experience)::reference(Experiences)' + 
								'::reference(Session)::reference(Sessions)::reference(Offering)'});
			})
		.then(function() {
				return crp.promise({path: "#" + _this.path.getInstanceID() + '>"More Experience">Offering'});
			})
		.then(function() {
				return crp.promise({path: "Service"});
			})
		.then(function() {
				return _this.path.promiseCellsFromCache(["More Experience", "parents"]);
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

var PathlinesPanel = (function () {
	PathlinesPanel.prototype = new SitePanel();
	PathlinesPanel.prototype.user = null;
	PathlinesPanel.prototype.pathtree = null;
	PathlinesPanel.prototype.navContainer = null;
	
	PathlinesPanel.prototype.userSettingsBadgeCount = function(user)
	{
		var cell = user.getCell("_access request");
		if (cell && cell.data.length > 0)
			return cell.data.length;
		else
			return "";
	}
	
	PathlinesPanel.prototype.setupSettingsButton = function(settingsButton, user)
	{
		var _this = this;
		settingsButton
			.on("click", 
				function() {
					if (prepareClick('click', "Settings"))
					{
						try
						{
							var panel = new Settings(user);
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
			.style("display", user.getPrivilege() == "_administer" ? null : "none")
			.append("img")
			.attr("src", settingsImagePath);
		settingsButton.append("span")
			.classed("badge", true)
			.text(this.userSettingsBadgeCount(user));
	}
	
	PathlinesPanel.prototype.createExperience = function()
	{
		return new Experience(this.pathtree.path);
	}
	
	PathlinesPanel.prototype.startNewExperience = function(phase, done, fail)
	{
		try
		{
			var experience = this.createExperience();
			if (phase === 'Goal')
				experience.initGoalDateRange();
			else if (phase === 'Current')
				experience.initCurrentDateRange();
			else
				experience.initPreviousDateRange();
				
			new NewExperiencePanel(experience, phase)
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
						new AddOptions(_this);
					}
					catch(err)
					{
						syncFailFunction(err);
					}
				}
				d3.event.preventDefault();
			})
			.classed('add-button', true)
			.style("display", "none");
		addExperienceButton.append("span")
			.classed('site-active-text', true)
			.text("+");
			
		var moreExperiences = user.getValue("Path");
		var canAddExperience = (moreExperiences.getInstanceID() === null ? user.canWrite() : moreExperiences.canWrite());
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
	
	PathlinesPanel.prototype.getFlagData = function(id)
	{
		var $group = $(this.panelDiv.node()).find(".experiences>g")
			.filter(function() { 
				return d3.select(this).datum().experience.id == id; 
				});
		return d3.select($group.get(0)).datum();
	}
	
	PathlinesPanel.prototype.showCommentsPanelAsync = function(id)
	{
		var newPanel = new ExperienceCommentsPanel(this.getFlagData(id));
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
			backButton.append("span").text("Done");
			
			settingsButton = this.navContainer.appendRightButton();
		}
		else
			settingsButton = this.navContainer.appendLeftButton();

		var addExperienceButton = this.navContainer.appendRightButton();
		
		this.navContainer.appendTitle(getUserDescription(user));
		
// 		var findButton = this.bottomNavContainer.appendRightButton()
// 				.on("click",
// 					function() {
// 						if (prepareClick('click', 'find experience'))
// 						{
// 							try
// 							{
// 								showClickFeedback(this);
// 								var newPanel = new FindExperiencePanel(cr.signedinUser, null, null);
//								newPanel.showLeft().then(unblockClick);
// 							}
// 							catch(err)
// 							{
// 								cr.syncFail(err);
// 							}
// 						}
// 						d3.event.preventDefault();
// 					});
// 		findButton.append("i").classed("site-active-text fa fa-lg fa-search", true);
// 		findButton.style("display", "none");
		
		if (this.pathtree)
			throw "pathtree already assigned to pathtree panel";
			
		this.pathtree = new PathLines(this, panel2Div.node());
		
		function checkSettingsBadge()
		{
			settingsButton.selectAll("span").text(_this.userSettingsBadgeCount(user));
		}
		
		function checkTitle()
		{
			_this.navContainer.setTitle(getUserDescription(user));
		}
				
		$(this.pathtree).on("userSet.cr", function()
			{
				_this.setupAddExperienceButton(user, addExperienceButton);
				
				_this.setupSettingsButton(settingsButton, user);

				setupOnViewEventHandler(user.getCell("_access request"), "valueDeleted.cr valueAdded.cr", 
					_this.node(), checkSettingsBadge);
				checkSettingsBadge();
				
				setupOnViewEventHandler(user.getCell("_first name"), "dataChanged.cr", _this.node(), checkTitle);
				setupOnViewEventHandler(user.getCell("_last name"), "dataChanged.cr", _this.node(), checkTitle);
				setupOnViewEventHandler(user.getCell("_email"), "dataChanged.cr", _this.node(), checkTitle);
				
// 				findButton.style("display", user.getPrivilege() === "_administer" ? null : "none");
				
				this.isMinHeight = true;
				this.handleResize();
			});
	}
	
	return PathlinesPanel;
})();

var ShareOptions = (function () {

	function ShareOptions(panelNode, user)
	{
		var dimmer = new Dimmer(panelNode);
		var panel = d3.select(panelNode).append('panel')
			.classed("confirm", true);
		var div = panel.append('div');
		function onCancel(e)
		{
			if (prepareClick('click', 'Cancel'))
			{
				try
				{
					$(confirmButton.node()).off('blur');
					$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
						$(panel.node()).remove();
						unblockClick();
					});
					clipboard.destroy();
					dimmer.hide();
				}
				catch(err)
				{
					syncFailFunction(err);
				}
			}
			e.preventDefault();
		}
		
		var copyButton = div.append('button')
			.text("Copy Path")
			.classed("site-active-text copy", true)
			.attr('data-clipboard-action', 'copy');
		
		var clipboard = new Clipboard('button.copy', {
			text: function(trigger) {
				return '{0}/for/{1}'.format(window.location.origin, user.getDatum("_email"));
			}});
			
		clipboard.on('error', function(e) {
			cr.asyncFail('Press Ctrl+C to copy');
		});
			
		var confirmButton = div.append('button')
			.text("Share Via Mail")
			.classed("site-active-text", true)
			.on("click", function()
				{
					/* Test case: Email Pathway Link. */
					if (prepareClick('click', "Email Pathway Link"))
					{
						$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
							$(panel.node()).remove();
							if (user.getInstanceID() == cr.signedinUser.getInstanceID())
							{
								window.location = 'mailto:?subject=My%20Pathway&body=Here is a link to my pathway: {0}/for/{1}.'
											.format(window.location.origin, user.getDatum("_email"));
							}
							else
							{
								window.location = 'mailto:?subject=Pathway for {0}&body=Here is a link to the pathway for {0}: {1}/for/{2}.'
											.format(getUserDescription(user), window.location.origin, user.getDatum("_email"));
							}
							unblockClick();
						});
						dimmer.hide();
					}
				});
				
		$(confirmButton.node()).on('blur', onCancel);
		var cancelButton = div.append('button')
			.text("Cancel")
			.classed("site-active-text", true);
		
		$(cancelButton.node()).click(onCancel);
		
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
	
	return ShareOptions;
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
		var div = panel.append('div')
			.style('margin-bottom', '{0}px'.format(pathlinesPanel.getBottomNavHeight()));
		
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
				new ExperienceIdeas(panelNode, pathlinesPanel.pathtree.path, unblockClick, cr.syncFail);
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
		
		crp.promise({path: '"Experience Prompt"'})
			.done(function(prompts)
				{
					try
					{
						/* Remove prompts that have disqualifying tags */
						var moreExperienceData = path.getCell("More Experience").data;
						prompts = prompts.filter(function(d)
							{
								return !d.getCell("Disqualifying Tag").data.find(function(dt)
									{
										var dtID = dt.getInstanceID();
										return moreExperienceData.find(function(experience)
											{
												return experience.getCell("Service").data.find(function(service)
													{
														return service.getInstanceID() == dtID;
													}) ||
													experience.getCell("Offering").data.find(function(offering)
														{
															return !offering.isEmpty() && offering.getCell("Service").data.find(function(service)
																{
																	return service.getInstanceID() == dtID;
																});
														});
											});
									});
							});
						data = prompts.map(function(d)
							{
								var datum = {name: d.getDatum('_name'),
											 prompt: d.getDatum('_text'),
											 experience: new Experience(path)};
								var s = d.getNonNullValue('Service');
								if (s) datum.experience.addService({instance: s});
								datum.experience.domain = d.getNonNullValue('Domain');
								datum.experience.stage = d.getNonNullValue('Stage');
								datum.experience.setOrganization({instance: d.getNonNullValue('Organization')});
								datum.experience.setSite({instance: d.getNonNullValue('Site')});
								datum.experience.setOffering({instance: d.getNonNullValue('Offering')});
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
	
	function ExperienceIdeaPanel(panelNode, dimmer, title, prompt, experience, getNext)
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
							experience.initPreviousDateRange();
							var panel = new NewExperiencePanel(experience, 'Previous');
							panel.done = function()
								{
									skipButton.on('click')();
								};
							panel.showUp()
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
	OtherPathlines.prototype = new PathLines();
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
				var tempExperience = new Experience(cr.signedinUser.getValue("Path"), fd.experience);
				new NewExperiencePanel(tempExperience, tempExperience.getPhase())
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
	OtherPathPanel.prototype = new SitePanel();
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
			backButton.append("span").text("Done");
		}

		var title;
		var screenName = path.getDatum("_name");
		var user = path.getValue("_user");
		
		if (screenName)
			title = screenName;
		else if (user)
			title = getUserName(user) || user.getDescription();
		else
			title = (new AgeCalculator(path.getValue("Birthday").getDescription())).toString();
		
		this.navContainer.appendTitle(title);
		
		if (this.pathtree)
			throw "pathtree already assigned to pathtree panel";
			
		this.pathtree = new OtherPathlines(this, panel2Div.node());
		
		$(this.pathtree).on("userSet.cr", function()
			{
				this.isMinHeight = true;
				this.handleResize();
			});
	}
	
	return OtherPathPanel;
})();

