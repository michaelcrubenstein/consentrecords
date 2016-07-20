/* pathtreePanel.js */

var FlagData = (function() {
	FlagData.prototype.experience = null;
	FlagData.prototype.x = null;
	FlagData.prototype.y = null;
	FlagData.prototype.height = null;
	FlagData.prototype.width = null;
	
	FlagData.prototype.getDescription = function()
	{
		var _this = this;
		var f = function(name)
		{
			var d = _this.experience.getValue(name);
			return d && d.getValueID() && d.getDescription();
		}
		return f("Offering") ||
			this.experience.getDatum("User Entered Offering") ||
			f("Service") ||
			this.experience.getDatum("User Entered Service") ||
			f("Organization") ||
			this.experience.getDatum("User Entered Organization") ||
			"None";
	}
	
	FlagData.prototype.pickedOrCreatedValue = function(pickedName, createdName)
	{
		return getPickedOrCreatedValue(this.experience, pickedName, createdName);
	}
	
	FlagData.prototype.getService = function()
	{
		var offering = this.experience.getValue("Offering");
		if (offering && offering.getValueID())
		{
			var service = offering.getValue("Service");
			if (service)
				return service;
		}
		return this.experience.getValue("Service");
	}
	
	FlagData.prototype.getServiceDomain = function()
	{
		var service = this.getService();
		if (!service || !service.getValueID())
			return null;
		service = crp.getInstance(service.getValueID());
		var domain = service.getValue("Domain");
		if (domain)
			var sd = crp.getInstance(domain.getValueID()).getValue("Service Domain");
			if (sd)
				return sd;
		return service.getValue("Service Domain");
	}

	FlagData.prototype.getStage = function()
	{
		var service = this.getService();
		return service && service.getValueID() && crp.getInstance(service.getValueID()).getValue("Stage")
	}

	FlagData.prototype.stageColumns = {
		Studying: 1,
		Certificate: 1,
		Training: 2,
		Whatever: 2,
		Working: 3,
		Teaching: 3,
		Expert: 3,
		Mentoring: 4,
		Tutoring: 4,
		Coaching: 4,
		Volunteering: 4
	};
	FlagData.prototype.getColumn = function()
	{
		var sd = this.getServiceDomain();
		if (sd && sd.getDescription() == "Housing")
			return 0;

		var stage = this.getStage();
		var stageDescription = stage && stage.getDescription();
		if (stageDescription &&
			stageDescription in this.stageColumns)
			return this.stageColumns[stageDescription];

		if (sd && sd.getDescription() == "Wellness")
			return 5;
		/* Other */
		return 6;
	}
	
	FlagData.prototype.getStartDate = function()
	{
		return this.experience.getDatum("Start") || "9999-12-31";
	}
	
	FlagData.prototype.getEndDate = function()
	{
		return this.experience.getDatum("End") || 
			(this.experience.getDatum("Start") ? new Date().toISOString().substr(0, 10) : "9999-12-31");
	}
	
	FlagData.prototype.getYearArray = function()
	{
		var e = this.experience.getDatum("End");
		var s = this.experience.getDatum("Start");
		var top;
		
		if (e)
			top = new Date(e).getUTCFullYear();
		else if (s)
			top = "Now";
		else
			top = "Goal";
		var bottom = s ? new Date(s).getUTCFullYear() : "Goal";
		
		return {top: top, bottom: bottom};
	}
	
	FlagData.prototype.getColor = function()
	{
		var column = this.getColumn();
		return PathLines.prototype.guideData[column].color;
	}
	
	FlagData.prototype.colorElement = function(r)
	{
		var colorText = this.getColor();
		r.setAttribute("fill", colorText);
		r.setAttribute("stroke", colorText);
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
	
	/* Constants related to the detail rectangle. */
	PathView.prototype.textBottomMargin = 2;
	PathView.prototype.yearTextX = "3.0em";
	PathView.prototype.flagHeightEM = 2.333;
	PathView.prototype.flagSpacing = 2;
	PathView.prototype.flagSpacingEM = 0.1;

	/* Variables related to the detail rectangle. */
	PathView.prototype.nextClipID = 1;
	PathView.prototype.clipID = null;
	PathView.prototype.defs = null;
	PathView.prototype.detailGroup = null;
	PathView.prototype.detailBackRect = null;
	PathView.prototype.detailFrontRect = null;
	PathView.prototype.detailRectHeight = 0;
	PathView.prototype.detailFlagData = null;
	
	PathView.prototype.guideHSpacing = 30;
	PathView.prototype.labelYs = [11, 33];
	PathView.prototype.guideData = [{name: "Housing", labelY: PathView.prototype.labelYs[0], color: "#804040"},
							  {name: "School", labelY: PathView.prototype.labelYs[1], color: "#2828E7"},
							  {name: "Interests", labelY: PathView.prototype.labelYs[0], color: "#8328E7"},
							  {name: "Career", labelY: PathView.prototype.labelYs[1], color: "#805050"},
							  {name: "Giving Back", labelY: PathView.prototype.labelYs[0], color: "#D55900"},
							  {name: "Wellness", labelY: PathView.prototype.labelYs[1], color: "#0694F3"},
							  {name: "Other", labelY: PathView.prototype.labelYs[0], color: "#0BBB0B"}];
							  
	PathView.prototype.emToPX = 11;
							  
	PathView.prototype.appendWrappedText = function(s, newSpan, maxWidth)
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
	
	PathView.prototype.handleChangeServices = function(r, fd)
	{
		fd.colorElement(r);
	}
	
	PathView.prototype.handleChangedExperience = function(r, fd)
	{
		var _this = this;
		
		var expChanged = function(eventObject)
		{
			fd.colorElement(eventObject.data);
		}
		
		$(fd.experience).on("dataChanged.cr", null, r, expChanged);
		$(this).on("remove", null, fd.experience, function(eventObject)
		{
			$(eventObject.data).off("dataChanged.cr", null, expChanged);
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
			
			$(serviceCell).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, r, f);
			$(userServiceCell).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, r, f);
			$(r).one("clearTriggers.cr remove", function()
				{
					$(serviceCell).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, f);
					$(userServiceCell).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, f);
				});
		}
	
	/* Sets up a trigger when a service changes, or a non-empty service is added or deleted.
		The trigger sets the color of the specified element (r).
	 */	
	PathView.prototype.setupColorWatchTriggers = function(r, fd)
	{
		var _this = this;
		this.setupServiceTriggers(r, fd, function(eventObject)
				{
					var fd = d3.select(eventObject.data).datum();
					fd.colorElement(eventObject.data);
				});
	}
	
	PathView.prototype.checkOfferingCells = function(experience, done)
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
				offering.checkCells(undefined, function() { if (done) done(); }, asyncFailFunction);
			}
		}
		else
		{
			if (done) done();
		}
	}
	
	PathView.prototype.setupClipID = function()
	{
		/* Set up a clipID that uniquely identifies the clip paths for this PathView. */
		this.clipID = PathView.prototype.nextClipID;
		PathView.prototype.nextClipID += 1;
	}
	
	PathView.prototype.setupClipPaths = function()
	{
		this.defs.selectAll('clipPath').remove();
		
		/* Add a clipPath for the text box size. */
		this.defs.append('clipPath')
			.attr('id', 'id_detailClipPath{0}'.format(this.clipID))
			.append('rect');
		this.defs.append('clipPath')
			.attr('id', 'id_detailIconClipPath{0}'.format(this.clipID))
			.append('rect');
	}
	
	PathView.prototype.clearDetail = function()
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
		$(this).trigger("clearTriggers.cr");
		$(this.detailFrontRect).trigger("clearTriggers.cr");
		
		this.detailGroup.datum(null);
		this.detailGroup.selectAll('rect').datum(null);
		this.detailFlagData = null;
	}

	PathView.prototype.hideDetail = function(done, duration)
	{
		duration = (duration !== undefined ? duration : 250);
		
		var _this = this;
		if (this.detailFlagData != null)
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
	
	PathView.prototype.refreshDetail = function()
	{
		var oldFlagData = this.detailFlagData;
		var _this = this;
		this.hideDetail(
			function() { _this.showDetailGroup(oldFlagData, 0); },
			0);
	}
	
	PathView.prototype.clearLayout = function()
	{
		/* Do whatever it takes to force layout when checkLayout is called. */
		this.isLayoutDirty = true;
	}
	
	PathView.prototype.showDetailPanel = function(fd, i)
	{
		if (fd.experience.typeName == "Experience") {
			;	/* Nothing to edit */
		}
		else
		{
			if (prepareClick('click', 'show experience detail: ' + fd.getDescription()))
			{
				try
				{
					var panel = this.sitePanel.node();
					var editPanel = new EditExperiencePanel(fd.experience, this.path, panel, revealPanelLeft);
												  
					revealPanelLeft(editPanel.node());
				}
				catch(err)
				{
					syncFailFunction(err);
				}
				d3.event.stopPropagation();
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
	
	PathView.prototype.addMoreExperience = function(experience)
	{
		this.checkOfferingCells(experience);
		
		this.allExperiences.push(experience);
		
		this.setupExperienceTriggers(experience);
		
		this.appendExperiences();

		this.redoLayout();
	}
	
	PathView.prototype.layoutYears = function(g)
	{
		var _this = this;
		
		this.yearGroup.selectAll('text').remove();
		var yearHeight = this.flagHeightEM / 2;
		var fds = g.data();
		fds.forEach(function(fd)
		{
			fd.yearBounds = fd.getYearArray();
		});
		
		// Eliminate aboves >= aboves, tops or belows of previous items.
		for (var i = 0; i < fds.length - 1; ++i)
		{
			var fdi = fds[i];
			var ybi = fdi.yearBounds;
			var ybj = fds[i+1].yearBounds;
			if (ybi.top == ybi.bottom ||
			    ybi.top == ybj.top ||
			    ybi.top == ybj.bottom)
			    ybi.top = undefined;
			else if (fdi.y2 > fdi.y + this.flagHeightEM) {	/* Overlapping flag-pole */
				for (var j = i + 1; j < fds.length; ++j)
				{
					var fdj = fds[j];
					ybj = fdj.yearBounds;
					if (ybi.top == ybj.top ||
						ybi.top == ybj.bottom)
					{
						ybi.top = undefined;
						break;
					}
				}
			}
			
			var thisYear = new Date().getUTCFullYear();
			function compareDates(d1, d2)
			{
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
			
			ybj = fds[i+1].yearBounds;
			if (ybi.bottom == ybj.top)
				ybi.bottom = undefined;
			else if (fdi.y2 > fdi.y + this.flagHeightEM) {	/* Overlapping flag-pole */
				for (var j = i + 1; j < fds.length; ++j)
				{
					var fdj = fds[j];
					if (fdj.y < fdi.y2 && fdj.y2 >= fdi.y2)	/* If this crosses the bottom,  */
					{
						if (j < fds.length - 1)
						{
							var isShortFlagpole = fdj.y + this.flagHeightEM == fdj.y2;
							var fdk = fds[j+1];
							/* If the item after i's flag-pole has the same top year
									then eliminate i's bottom (it is a duplicate year marker). 
								or if the item at i's flag-pole has a lesser bottom year than i's flag-pole
									then if that item doesn't extend below i,
										then eliminate i's bottom (two labels will overlap)
									otherwise, if the lower item's top is the same as i's bottom,
										then eliminate the lower item's top (it is a duplicate year marker and higher.)
								otherwise, eliminate j's top.
							 */
							if (isShortFlagpole && fds[j+1].yearBounds.top == fdi.yearBounds.bottom)
								fdi.yearBounds.bottom = undefined;
							else if (compareDates(fdj.yearBounds.bottom, fdi.yearBounds.bottom) < 0)
							{
								if (isShortFlagpole)
									fdi.yearBounds.bottom = undefined;
								else if (fdj.yearBounds.top == fdi.yearBounds.bottom)
									fdj.yearBounds.top = undefined;
							}
							else if (fdi.yearBounds.bottom && fdj.yearBounds.bottom)
							{
								if (fdj.y2 <= fdi.y2 + this.flagSpacing)
								{
									// The bottoms overlap.
									if (fdj.yearBounds.bottom == fdi.yearBounds.bottom)
										fdi.yearBounds.bottom = undefined;
									else
										fdj.yearBounds.bottom = undefined;
								}
							}
						}
						else
							fdj.yearBounds.top = undefined;
					}
					else if (ybi.bottom == fdj.yearBounds.top ||
						     ybi.bottom == fdj.yearBounds.bottom)
					{
						ybi.bottom = undefined;
					}
					if (!ybi.bottom)
						break;
				}
			}
		}
		
		fds.forEach(function(fd)
		{
			if (fd.yearBounds.top)
			{
				_this.yearGroup.append('text')
					.text(fd.yearBounds.top)
					.attr("x", _this.yearTextX)
					.attr('y', _this.experienceGroupDY + (fd.y + yearHeight) * _this.emToPX);
			}
			if (fd.yearBounds.bottom)
			{
				_this.yearGroup.append('text')
					.text(fd.yearBounds.bottom)
					.attr("x", _this.yearTextX)
					.attr('y', _this.experienceGroupDY + (fd.y2 * _this.emToPX));
			}
		});
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
					if (lastFD.getStartDate() < fd.getEndDate())
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
					if (nextDatum.getEndDate() > fd.getStartDate())
						fd.y2 = nextDatum.y + _this.flagHeightEM;
					else
						break;
				}
			});
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
		this.detailFlagData = null;
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
	PathLines.prototype.poleSpacing = 4;
		
	PathLines.prototype.textLeftMargin = 3;
	PathLines.prototype.textDetailLeftMargin = 3; /* textLeftMargin; */
	PathLines.prototype.textDetailRightMargin = 7; /* textRightMargin; */
	PathLines.prototype.detailTextSpacing = "1.1em";		/* The space between lines of text in the detail box. */
	PathLines.prototype.pathBackground = "white";
	PathLines.prototype.showDetailIconWidth = 18;
	PathLines.prototype.loadingMessageTop = "4.5em";
	PathLines.prototype.promptRightMargin = 14;		/* The minimum space between the prompt and the right margin of the svg's container */
	PathLines.prototype.bottomNavHeight = 0;	/* The height of the bottom nav container; set by container. */
	
	/* Translate coordinates for the elements of the experienceGroup within the svg */
	PathLines.prototype.experienceGroupDX = 40;
	PathLines.prototype.experienceGroupDY = 37;
	
	PathLines.prototype.detailRectX = 1.5;
	
	PathLines.prototype.pathwayContainer = null;
	PathLines.prototype.svg = null;
	PathLines.prototype.loadingMessage = null;
	PathLines.prototype.defs = null;
	PathLines.prototype.bg = null;
	PathLines.prototype.loadingText = null;
	PathLines.prototype.promptAddText = null;
	PathLines.prototype.yearGroup = null;
	PathLines.prototype.guideGroup = null;
	PathLines.prototype.experienceGroup = null;

	PathLines.prototype.flagWidth = 0;
	
	PathLines.prototype.columnData = PathView.prototype.guideData;

	PathLines.prototype.handleValueDeleted = function(experience)
	{
		var index = this.allExperiences.indexOf(experience);
		var _this = this;
		if (index >= 0)
			this.allExperiences.splice(index, 1);
		if (this.detailFlagData && experience == this.detailFlagData.experience)
			this.hideDetail(function() {
					_this.setupHeights();
					_this.setupWidths();
				}, 0);
		this.clearLayout();
		this.checkLayout();
	};

	PathLines.prototype.handleExperienceDateChanged = function(eventObject)
	{
		var _this = eventObject.data;
		var g = _this.experienceGroup.selectAll('g.flag');
		_this.transitionPositions(g);
	}
	
	PathLines.prototype.setFlagText = function(node)
	{
		var g = d3.select(node);
		g.selectAll('text').selectAll('tspan:nth-child(1)')
			.text(function(d) { return d.getDescription(); })
	}
		
	/* Sets up each group (this) that displays an experience to delete itself if
		the experience is deleted.
	 */
	PathLines.prototype.setupDelete = function(fd, node) 
	{
		var _this = this;
		var valueDeleted = function(eventObject)
		{
			$(eventObject.data).remove();
			_this.handleValueDeleted(this);
		};
		
		var dataChanged = function(eventObject)
		{
			_this.setFlagText(eventObject.data);
		}
		
		$(fd.experience).one("valueDeleted.cr", null, node, valueDeleted);
		$(fd.experience).on("dataChanged.cr", null, node, dataChanged);
		
		$(node).on("remove", null, fd.experience, function(eventObject)
		{
			$(eventObject.data).off("valueDeleted.cr", null, valueDeleted);
			$(eventObject.data).off("dataChanged.cr", null, dataChanged);
		});
	}
	
	/* Lay out all of the contents within the svg object. */
	PathLines.prototype.layout = function()
	{
		var g = this.experienceGroup.selectAll('g.flag');
		var y = this.yearGroup.selectAll('text');
		
		var _this = this;
		
		g.each(function(fd)
		{
			fd.column = fd.getColumn();
		});
		numColumns = 7;
		
		g.selectAll('rect')
			.attr('height', "{0}em".format(this.flagHeightEM))
			.attr('width', function(fd)
				{
					return $(this.parentNode).children('text').outerWidth() + 5;
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
			
		if (this.detailFlagData != null)
		{
			/*( Restore the detailFlagData */
			var fds = g.data();
			var i = fds.findIndex(function(fd) { return fd.experience === _this.detailFlagData.experience; });
			if (i >= 0)
			{
				_this.hideDetail(function()
					{
						_this.setupClipPaths();
						_this.showDetailGroup(fds[i], 0);
					}, 0
				);
			}
			else
				throw "experience lost in layout";
		}
		else
			this.setupClipPaths();
		
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
	
	PathLines.prototype.transitionPositions = function(g)
	{
		var _this = this;
		g.sort(this._compareExperiences);
		this._setCoordinates(g);
		g.transition()
			.duration(1000)
			.ease("in-out")
			.attr("transform", function(fd) { return "translate({0},{1})".format(fd.x, fd.y * _this.emToPX);});
		
		/* Set the line length to the difference between fd.y2 and fd.y, since g is transformed
			to the fd.y position.
		 */
		g.selectAll('line.flag-pole')
			.transition()
			.duration(1000)
			.ease("in-out")
			.attr('y2', function(fd) { return "{0}em".format(fd.y2 - fd.y); });

		this.layoutYears(g);
	}
	
	PathLines.prototype.showDetailGroup = function(fd, duration)
	{
		duration = (duration !== undefined ? duration : 700);
		var _this = this;
		
		this.detailGroup.datum(fd);
		this.detailGroup.selectAll('rect').datum(fd);
		var detailText = this.detailGroup.append('text')
			.attr('clip-path', 'url(#id_detailClipPath{0})'.format(this.clipID));
			
		var hasEditChevron = fd.experience.typeName == "More Experience" && fd.experience.canWrite();

		var lines = [];
		
		var s;
		var maxWidth = 0;
		var tspan;
		s = fd.pickedOrCreatedValue("Offering", "User Entered Offering");
		if (s && s.length > 0 && lines.indexOf(s) < 0)
		{
			tspan = detailText.append('tspan')
				.classed('flag-label', true)
				.text(s)
				.attr("x", this.textDetailLeftMargin)
				.attr("dy", this.detailTextSpacing);
			maxWidth = Math.max(maxWidth, tspan.node().getComputedTextLength());
		}
		
		function checkSpacing(dy)
		{
			if (maxWidth > 0)
				detailText.append('tspan')
						  .text(' ')
						  .attr("x", this.textDetailLeftMargin)
						  .attr("dy", dy);
		}
			
		var orgString = fd.pickedOrCreatedValue("Organization", "User Entered Organization");
		if (orgString && orgString.length > 0 && lines.indexOf(orgString) < 0)
		{
			checkSpacing("4px");
			tspan = detailText.append('tspan')
				.classed('detail-organization', true)
				.text(orgString)
				.attr("x", this.textDetailLeftMargin)
				.attr("dy", this.detailTextSpacing);
			maxWidth = Math.max(maxWidth, tspan.node().getComputedTextLength());
		}

		s = fd.pickedOrCreatedValue("Site", "User Entered Site");
		if (s && s.length > 0 && s !== orgString)
		{
			checkSpacing("2px");
			tspan = detailText.append('tspan')
				.classed('site', true)
				.text(s)
				.attr("x", this.textDetailLeftMargin)
				.attr("dy", this.detailTextSpacing);
			maxWidth = Math.max(maxWidth, tspan.node().getComputedTextLength());
		}

		s = getDateRange(fd.experience);
		if (s && s.length > 0)
		{
			checkSpacing("4px");
			tspan = detailText.append('tspan')
				.classed('detail-dates', true)
				.text(s)
				.attr("x", this.textDetailLeftMargin)
				.attr("dy", this.detailTextSpacing);
			maxWidth = Math.max(maxWidth, tspan.node().getComputedTextLength());
		}
		
		var x = fd.x;
		var y = fd.y;

		var iconAreaWidth = (hasEditChevron ? this.showDetailIconWidth + this.textDetailLeftMargin : 0);
		var rectWidth = maxWidth + iconAreaWidth + (this.textDetailLeftMargin * 2);

		s = getTagList(fd.experience);
		if (s && s.length > 0)
		{
			checkSpacing("4px");
			
			this.appendWrappedText(s, function()
				{
					return detailText.append("tspan")
						.classed('tags', true)
						.attr("x", _this.textDetailLeftMargin)
						.attr("dy", _this.detailTextSpacing);
				},
				maxWidth);
		}

			
		var textBox = detailText.node().getBBox();
		this.detailRectHeight = textBox.height + (textBox.y * 2) + this.textBottomMargin;

		this.detailGroup.attr("transform", 
		                      "translate({0},{1})".format(x + this.experienceGroupDX, (fd.y * this.emToPX) + this.experienceGroupDY));
		this.detailGroup.selectAll('rect')
			.attr("width", rectWidth)
			.attr("x", this.detailRectX)	/* half the stroke width */;
		this.detailFrontRect.datum().colorElement(this.detailFrontRect.node());
		this.detailFrontRect.each(function(d) { _this.setupColorWatchTriggers(this, d); });
		if (duration > 0)
		{
			
			this.detailGroup.selectAll('rect').attr("height", 0)
					   .transition()
					   .duration(duration)
					   .attr("height", this.detailRectHeight);
		}
		else
		{
			this.detailGroup.selectAll('rect').attr("height", this.detailRectHeight);
		}
	   
		/* Set the clip path of the text to grow so the text is revealed in parallel */
		var textClipRect = d3.select("#id_detailClipPath{0}".format(this.clipID)).selectAll('rect')
			.attr('x', textBox.x)
			.attr('y', textBox.y)
			.attr('width', maxWidth); 
		
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
				.attr('height', this.detailRectHeight); 
			detailText				
				.transition()
				.duration(duration)
				.attr("height", this.detailRectHeight);

			if (hasEditChevron)
				iconClipRect.attr('height', 0)
					.transition()
					.duration(duration)
					.attr('height', this.detailRectHeight);
		}
		else
		{
			textClipRect.attr('height', this.detailRectHeight); 
			detailText.attr("height", this.detailRectHeight);
			if (hasEditChevron)
				iconClipRect.attr('height', this.detailRectHeight);
		}
		
		this.detailFlagData = fd;
		
		var experience = this.detailFlagData.experience;
		
		function handleChangeDetailGroup(eventObject, newValue)
		{
			if (!(eventObject.type == "valueAdded" && newValue && newValue.isEmpty()))
				_this.refreshDetail();
		}
		
		var allCells = [experience.getCell("Organization"),
		 experience.getCell("User Entered Organization"),
		 experience.getCell("Site"),
		 experience.getCell("User Entered Site"),
		 experience.getCell("Start"),
		 experience.getCell("End"),
		 experience.getCell("Service"),
		 experience.getCell("User Entered Service")];
		 
		var serviceCells = [experience.getCell("Service"),
		 experience.getCell("User Entered Service")];
		 
		allCells.forEach(function(d)
		 {
			/* d will be null if the experience came from the organization for the 
				User Entered Organization and User Entered Site.
			 */
			if (d)
			{
				$(d).on("dataChanged.cr", null, _this, handleChangeDetailGroup);
				$(d).on("valueAdded.cr", null, _this, handleChangeDetailGroup);
			}
		 });
		serviceCells.forEach(function(d)
		 {
			/* d will be null if the experience came from the organization for the 
				User Entered Organization and User Entered Site.
			 */
			if (d)
			{
				$(d).on("valueDeleted.cr", null, _this, handleChangeDetailGroup);
			}
		 });
		 
		 $(this).one("clearTriggers.cr", function(eventObject)
		 {
			allCells.forEach(function(d)
			 {
				/* d will be null if the experience came from the organization for the 
					User Entered Organization and User Entered Site.
				 */
			 	if (d)
			 	{
					$(d).off("dataChanged.cr", null, handleChangeDetailGroup);
					$(d).off("valueAdded.cr", null, handleChangeDetailGroup);
				}
			 });
			serviceCells.forEach(function(d)
			 {
				/* d will be null if the experience came from the organization for the 
					User Entered Organization and User Entered Site.
				 */
				if (d)
				{
					$(d).off("valueDeleted.cr", null, handleChangeDetailGroup);
				}
			 });
		 });
		
		this.setupHeights();
		this.setupWidths();
		
		if (duration > 0)
		{
			this.scrollToRectangle(this.containerDiv, 
							   {y: (y * this.emToPX) + this.experienceGroupDY,
							    x: x + this.experienceGroupDX,
							    height: this.detailRectHeight,
							    width: rectWidth},
							   parseFloat(this.pathwayContainer.style('top')),
							   this.bottomNavHeight,
							   duration);
		}
	}
	
	PathLines.prototype.appendExperiences = function()
	{
		var _this = this;

		this.setupClipID();
		
		$(this.experienceGroup.selectAll('g.flag')[0]).remove();
		var g = this.experienceGroup.selectAll('g')
			.data(this.allExperiences.map(function(e) { return new FlagData(e); }))
			.enter()
			.append('g')
			.classed('flag', true)
			.each(function(d)
				{
					_this.setupDelete(d, this);
				})
			.on("click", function() 
				{ 
					d3.event.stopPropagation(); 
				})
			.on("click.cr", showDetail)
			.each(function(d) 
					{ 
						_this.setupServiceTriggers(this, d, function(eventObject)
							{
								d.column = d.getColumn();
								_this.transitionPositions(g);
							});
					});
		
		function showDetail(fd, i)
		{
			cr.logRecord('click', 'show detail: ' + fd.getDescription());
			
			_this.hideDetail(function() {
					_this.showDetailGroup(fd); 
				});
		}
		
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
		var text = g.append('text').classed('flag-label', true)
			.attr('x', this.textDetailLeftMargin);
		text.append('tspan')
			.attr('dy', '1.1em');
		
		g.each(function() { _this.setFlagText(this); });
	}
	
	PathLines.prototype.handleResize = function()
	{
		this.bottomNavHeight = $(this.sitePanel.bottomNavContainer.nav.node()).outerHeight();
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
		var firstTime = true;
		
		var resizeFunction = function()
		{
			/* Wrap handleResize in a setTimeout call so that it happens after all of the
				css positioning.
			 */
			setTimeout(function()
				{
					if (firstTime)
					{
						_this.appendExperiences();
						firstTime = false;
					}
					_this.handleResize();
				}, 0);
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

		$(this.sitePanel.mainDiv.node()).on("resize.cr", resizeFunction);
	}
	
	PathLines.prototype.setupHeights = function()
	{
		var containerBounds = this.containerDiv.getBoundingClientRect();
		var pathwayBounds = this.pathwayContainer.node().getBoundingClientRect();
		var svgHeight = containerBounds.height - (pathwayBounds.top - containerBounds.top);
		
		if (this.detailFlagData != null)
		{
			var h = (this.detailFlagData.y * this.emToPX) + this.detailRectHeight + this.experienceGroupDY + this.bottomNavHeight;
			if (svgHeight < h)
				svgHeight = h;
		}
		
		var _this = this;
		var lastFlag = this.experienceGroup.selectAll('g.flag:last-child');
		var flagHeights = (lastFlag.size() ? (lastFlag.datum().y2 * this.emToPX) + this.experienceGroupDY : this.experienceGroupDY) + this.bottomNavHeight;
		if (svgHeight < flagHeights)
			svgHeight = flagHeights;

		$(this.svg.node()).height(svgHeight);
		$(this.bg.node()).height(svgHeight);
		this.guideGroup.selectAll('line')
			.attr('y2', svgHeight - this.bottomNavHeight);
	}
	
	PathLines.prototype.setupWidths = function()
	{
		var newWidth = this.sitePanel.scrollAreaWidth();
		var _this = this;
		
		if (this.detailFlagData != null)
		{
			var w = this.experienceGroupDX + this.detailFlagData.x + parseFloat(this.detailFrontRect.attr('width'));
			if (newWidth < w)
				newWidth = w;
		}
		
		this.experienceGroup.selectAll('g.flag').each(function (fd)
			{
				var w = _this.experienceGroupDX + fd.x +parseFloat(d3.select(this).selectAll('rect').attr('width'));
				if (newWidth < w)
					newWidth = w;
			});
		$(this.svg.node()).width(newWidth);
		$(this.bg.node()).width(newWidth);

		/* Position the promptAddText based on the width. */
		if (this.promptAddText)
		{
			this.loadingText
				.attr("y", this.experienceGroupDY + this.loadingText.node().getBBox().height);
	
			var bbox = this.loadingText.node().getBBox();
			var newBBox = this.promptAddText.node().getBBox();
			if (bbox.x + bbox.width + this.textLeftMargin + newBBox.width >
				newWidth - this.experienceGroupDX - this.promptRightMargin)
			{
				this.promptAddText.attr("x", this.loadingText.attr("x"))
					.attr("y", parseFloat(this.loadingText.attr("y")) + bbox.height);
			}
			else
			{
				this.promptAddText.attr("x", bbox.x + bbox.width + this.textLeftMargin)
					.attr("y", this.loadingText.attr("y"));
			}
		}
	}
	
	PathLines.prototype.getUser = function()
	{
		return this.path.getValue("_user");
	}
	
	PathLines.prototype.showInitialPrompt = function()
	{
		var _this = this;
		this.loadingText = this.svg.append('text')
			.attr("x", this.experienceGroupDX).attr("y", this.experienceGroupDY)
			.attr("fill", "#777")
			.text('Ready to record an experience?');
		
		this.promptAddText = this.svg.append('text')
			.attr("fill", "#2C55CC")
			.text(" Record one now.")
			.on("click", function(d) {
				if (prepareClick('click', 'Record one now prompt'))
				{
					try
					{
						showClickFeedback(this);
						_this.sitePanel.startNewExperience();
					}
					catch (err)
					{
						syncFailFunction(err);
					}
				}
				d3.event.preventDefault();
			})
			.attr("cursor", "pointer");
	}
	
	PathLines.prototype.setUser = function(path, editable)
	{
		if (path.privilege === '_find')
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
			.classed("pathway pathlines", true);
		
		this.defs = this.svg.append('defs');
	
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
			.data(this.guideData)
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
			
		this.detailGroup = this.svg.append('g')
			.classed('detail', true)
			.on("click", function(d) 
				{ 
					d3.event.stopPropagation(); 
				})
			.on("click.cr", function(fd, i)
				{
					_this.showDetailPanel(fd, i);
				});
		this.detailBackRect = this.detailGroup.append('rect')
			.classed('bg', true);
		this.detailFrontRect = this.detailGroup.append('rect')
			.classed('detail', true);
			
		d3.select(this.containerDiv).selectAll('svg')
			.on("click", function() 
			{ 
				d3.event.stopPropagation(); 
			})
			.on("click.cr", function() {
				if (_this.detailFlagData)
				{
					cr.logRecord('click', 'hide details');
					_this.hideDetail(function()
						{
							_this.setupHeights();
							_this.setupWidths();
						});
				}
			});
		
		/* setupHeights now so that the initial height of the svg and the vertical lines
			consume the entire container. */
		this.setupHeights();
		
		var successFunction2 = function()
		{
			if (_this.path == null)
				return;	/* The panel has been closed before this asynchronous action occured. */
				
			var cell = _this.path.getCell("More Experience");
			var addedFunction = function(eventObject, newData)
				{
					eventObject.data.addMoreExperience(newData);
				}
			$(cell).on("valueAdded.cr", null, _this, addedFunction);
			$(_this.pathwayContainer.node()).on("remove", function()
				{
					$(cell).off("valueAdded.cr", null, addedFunction);
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
			
			crv.stopLoadingMessage(_this.loadingMessage);
			_this.loadingMessage.remove();
			
			$(_this).trigger("userSet.cr");
		}
		
		crp.getData({path:  "#" + this.path.getValueID() + '::reference(_user)::reference(Experience)', 
				   fields: ["parents", "type"], 
				   done: function(experiences)
					{
						_this.allExperiences = experiences.slice();
						$(experiences).each(function()
						{
							this.setDescription(this.getValue("Offering").getDescription());
						});
					}, 
				   fail: asyncFailFunction});
		crp.getData({path: "#" + this.path.getValueID() + '::reference(_user)::reference(Experience)::reference(Experiences)' + 
							'::reference(Session)::reference(Sessions)::reference(Offering)',
					 done: function(newInstances)
						{
						},
						fail: asyncFailFunction});
		crp.getData({path: "#" + this.path.getValueID() + '>"More Experience">Offering',
					 done: function(newInstances)
						{
						},
						fail: asyncFailFunction});			
		crp.getData({path: "(Service,Domain,Stage)", 
					 done: function(newInstances)
						{
						},
						fail: asyncFailFunction});
		crp.getData({path: '"Service Domain"', 
					 done: function(newInstances)
						{
						},
					fail: asyncFailFunction});
							
		crp.pushCheckCells(this.path, ["More Experience", "parents", "type"],
					  successFunction2, 
					  asyncFailFunction);
	}
	
	function PathLines(sitePanel, containerDiv) {
		PathView.call(this, sitePanel, containerDiv);
		d3.select(containerDiv).classed('vertical-scrolling', false)
			.classed('all-scrolling', true);
	}
	
	return PathLines;
})();

var PathlinesPanel = (function () {
	PathlinesPanel.prototype = new SitePanel();
	PathlinesPanel.prototype.user = null;
	PathlinesPanel.prototype.pathtree = null;
	PathlinesPanel.prototype.navContainer = null;
	PathlinesPanel.prototype.bottomNavContainer = null;
	
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
							var panel = new Settings(user, _this.node());
							showPanelUp(panel.node(), unblockClick);
						}
						catch(err)
						{
							syncFailFunction(err);
						}
					}
					d3.event.preventDefault();
				})
			.classed("settings", true)
			.style("display", "none")
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
	
	PathlinesPanel.prototype.startNewExperience = function()
	{
		var experience = this.createExperience();
		var panel = new NewExperiencePanel(experience, this.node());
		
		showPanelUp(panel.node(), unblockClick);
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
						showClickFeedback(this);
						_this.startNewExperience();
					}
					catch(err)
					{
						syncFailFunction(err);
					}
				}
				d3.event.preventDefault();
			})
			.classed('add-experience-button', true)
			.style("display", "none");
		addExperienceButton.append("span")
			.classed('site-active-text', true)
			.text("+");
			
		var moreExperiences = user.getValue("More Experiences");
		var canAddExperience = (moreExperiences.getValueID() === null ? user.canWrite() : moreExperiences.canWrite());
		addExperienceButton.style("display", canAddExperience ? null : "none");
	}
	
	function PathlinesPanel(user, previousPanel, canDone) {
		canDone = canDone !== undefined ? canDone : true;
		var _this = this;
		this.user = user;
		
		SitePanel.call(this, previousPanel, null, "My Pathway", "pathway");

		var panel2Div = this.appendScrollArea();

		this.navContainer = this.appendNavContainer();
		this.navContainer.nav
			.classed("transparentTop", true);

		var settingsButton;
		
		if (canDone)
		{
			var backButton = this.navContainer.appendLeftButton()
				.on("click", handleCloseRightEvent);
			backButton.append("span").text("Done");
			settingsButton = this.navContainer.appendRightButton();
		}
		else
			settingsButton = this.navContainer.appendLeftButton();

		this.setupSettingsButton(settingsButton, user);

		var addExperienceButton = this.navContainer.appendRightButton();
		
		this.navContainer.appendTitle(getUserDescription(user));
		
		this.bottomNavContainer = this.appendBottomNavContainer();
		this.bottomNavContainer.nav
			.classed("transparentBottom", true);

		var findButton = this.bottomNavContainer.appendRightButton()
				.on("click",
					function() {
						if (prepareClick('click', 'find experience'))
						{
							try
							{
								showClickFeedback(this);
								var newPanel = new FindExperiencePanel(cr.signedinUser, null, null, _this.node());
								showPanelLeft(newPanel.node(), unblockClick);
							}
							catch(err)
							{
								syncFailFunction(err);
							}
						}
						d3.event.preventDefault();
					});
		findButton.append("i").classed("site-active-text fa fa-lg fa-search", true);
		findButton.style("display", "none");
		
		var shareButton = this.bottomNavContainer.appendLeftButton()
			.classed("share", true)
			.on('click', function()
				{
					if (prepareClick('click', 'share'))
					{
						try
						{
							new ShareOptions(_this.node());
						}
						catch(err)
						{
							syncFailFunction(err);
						}
					}
				});
		shareButton.append("img")
			.attr("src", shareImagePath);
		
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
				
		$(this.node()).on("remove", function()
		{
			$(user.getCell("_access request"))
				.off("valueDeleted.cr", checkSettingsBadge)
				.off("valueAdded.cr", checkSettingsBadge);
			$(user.getCell("_first name"))
				.off("dataChanged.cr", checkTitle);
			$(user.getCell("_last name"))
				.off("dataChanged.cr", checkTitle);
			$(user.getCell("_email"))
				.off("dataChanged.cr", checkTitle);
		});
		
		$(this.pathtree).on("userSet.cr", function()
			{
				_this.setupAddExperienceButton(user, addExperienceButton);
				
				settingsButton.style("display", user.privilege === "_administer" ? null : "none");
				
				$(user.getCell("_access request")).on("valueDeleted.cr valueAdded.cr", checkSettingsBadge);
				checkSettingsBadge();
				
				$(user.getCell("_first name")).on("dataChanged.cr", checkTitle);
				$(user.getCell("_last name")).on("dataChanged.cr", checkTitle);
				$(user.getCell("_email")).on("dataChanged.cr", checkTitle);
				
				findButton.style("display", user.privilege === "_administer" ? null : "none");
				
				if (_this.pathtree.allExperiences.length == 0 && _this.pathtree.editable)
				{
					_this.pathtree.showInitialPrompt();
				}
			
				this.isMinHeight = true;
				_this.calculateHeight();
				
			});
	}
	
	return PathlinesPanel;
})();

var ShareOptions = (function () {

	function ShareOptions(panelNode)
	{
		var dimmer = d3.select(panelNode).append('div')
			.classed('dimmer', true);
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
						panel.remove();
						unblockClick();
					});
					$(dimmer.node()).animate({opacity: 0}, {duration: 400, complete:
						function()
						{
							dimmer.remove();
						}});
				}
				catch(err)
				{
					syncFailFunction(err);
				}
			}
			e.preventDefault();
		}
		
		var confirmButton = div.append('button')
			.text("Email Pathway Link")
			.classed("site-active-text", true)
			.on("click", function()
				{
					if (prepareClick('click', "Email Pathway Link"))
					{
						$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
							panel.remove();
							var user = panelNode.sitePanel.pathtree.getUser();
							if (user)
							{
								user = crp.getInstance(user.getValueID());
								if (user.getValueID() == cr.signedinUser.getValueID())
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
							}
							else
								syncFailFunction('the specified user is not available');
						});
						$(dimmer.node()).animate({opacity: 0}, {duration: 400, complete:
							function()
							{
								dimmer.remove();
							}});
					}
				});
				
		$(confirmButton.node()).on('blur', onCancel);
		var cancelButton = div.append('button')
			.text("Cancel")
			.classed("site-active-text", true);
		
		$(cancelButton.node()).click(onCancel);
		
		$(dimmer.node()).animate({opacity: 0.3}, 400);
		$(panel.node()).toggle("slide", {direction: "down", duration: 0});
		$(panel.node()).effect("slide", {direction: "down", duration: 400, complete: 
			function() {
				$(confirmButton.node()).focus();
				unblockClick();
			}});
		$(dimmer.node()).mousedown(onCancel);
		$(panel.node()).mousedown(function(e)
			{
				e.preventDefault();
			});
	}
	
	return ShareOptions;
})();

