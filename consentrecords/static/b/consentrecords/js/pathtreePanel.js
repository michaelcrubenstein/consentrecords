/* pathtreePanel.js */

var Service = (function() {
	Service.prototype.service = null;
	
	Service.prototype._getStage = function()
	{
		var service = this.service;
		return service && service.getValueID() && crp.getInstance(service.getValueID()).getValue("Stage")
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
	Service.prototype.getColumn = function()
	{
		var stage = this._getStage();
		var stageDescription = stage && stage.getDescription();
		if (stageDescription &&
			stageDescription in this.stageColumns)
			return this.stageColumns[stageDescription];

		/* Other */
		return 7;
	}
	
	Service.prototype.getColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].color;
	}
	
	Service.prototype.colorElement = function(r)
	{
		var colorText = this.getColor();
		r.setAttribute("fill", colorText);
		r.setAttribute("stroke", colorText);
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
	FlagData.prototype.detailTagSpacing = "1.5em";		/* The space between lines of text in the detail box. */
	
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
	
	FlagData.prototype._getService = function()
	{
		var offering = this.experience.getValue("Offering");
		if (offering && offering.getValueID())
		{
			if (!offering.isDataLoaded)
				throw ("Runtime error: offering data is not loaded");
				
			var service = offering.getValue("Service");
			if (service)
				return service;
		}
		return this.experience.getValue("Service");
	}
	
	FlagData.prototype.getColumn = function()
	{
		return new Service(this._getService()).getColumn();
	}
	
	FlagData.prototype.getStartDate = function()
	{
		return this.experience.getDatum("Start") || this.getTimeframeText() || this.goalDateString;
	}
	
	FlagData.prototype.getTimeframe = function()
	{
		var timeframeValue = this.experience.getValue("Timeframe");
		return timeframeValue && timeframeValue.getValueID() && timeframeValue.getDescription();
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
		return new Service(this._getService()).getColor();
	}
	
	FlagData.prototype.checkOfferingCells = function(done)
	{
		var offering = this.experience.getValue("Offering");
		if (offering && offering.getValueID() && !offering.isDataLoaded)
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
				new Service(_this._getService()).colorElement(r);
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
	
	FlagData.prototype.appendTSpans = function(detailText, maxWidth, x)
	{
		x = x !== undefined ? x : this.textDetailLeftMargin;
		
		detailText.selectAll('tspan').remove();
		
		var s;
		var tspan;
		s = this.pickedOrCreatedValue("Offering", "User Entered Offering");
		if (!s)
		{
			var serviceCell = this.experience.getCell("Service");
			var userServiceCell = this.experience.getCell("User Entered Service");

			if (serviceCell && serviceCell.data.length > 0)
				s = serviceCell.data[0].getDescription();
			else if (userServiceCell && userServiceCell.data.length > 0)
				s = userServiceCell.data[0].getDescription();
		}
		
		if (s && s.length > 0)
		{
			tspan = detailText.append('tspan')
				.classed('flag-label', true)
				.text(s)
				.attr("x", x)
				.attr("dy", this.detailTopSpacing);
			maxWidth = Math.max(maxWidth, tspan.node().getComputedTextLength());
		}
		
		var orgString = this.pickedOrCreatedValue("Organization", "User Entered Organization");
		if (orgString && orgString.length > 0)
		{
			tspan = detailText.append('tspan')
				.classed('detail-organization', true)
				.text(orgString)
				.attr("x", x)
				.attr("dy", maxWidth ? this.detailOrganizationSpacing : this.detailTopSpacing);
			maxWidth = Math.max(maxWidth, tspan.node().getComputedTextLength());
		}

		s = this.pickedOrCreatedValue("Site", "User Entered Site");
		if (s && s.length > 0 && s !== orgString)
		{
			tspan = detailText.append('tspan')
				.classed('site', true)
				.text(s)
				.attr("x", x)
				.attr("dy", maxWidth ? this.detailSiteSpacing : this.detailTopSpacing);
			maxWidth = Math.max(maxWidth, tspan.node().getComputedTextLength());
		}

		s = getDateRange(this.experience);
		if (s && s.length > 0)
		{
			tspan = detailText.append('tspan')
				.classed('detail-dates', true)
				.text(s)
				.attr("x", x)
				.attr("dy", maxWidth ? this.detailDateSpacing : this.detailTopSpacing);
			maxWidth = Math.max(maxWidth, tspan.node().getComputedTextLength());
		}
		
		s = getTagList(this.experience);
		if (s && s.length > 0)
		{
			var _this = this;
			FlagData.appendWrappedText(s, function(spanIndex)
				{
					return detailText.append("tspan")
						.classed('tags', true)
						.attr("x", x)
						.attr("dy", (spanIndex || !maxWidth) ? _this.detailTopSpacing : _this.detailTagSpacing);
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
	PathView.prototype.textBottomMargin = 5;
	PathView.prototype.yearTextX = "3.0em";
	PathView.prototype.flagHeightEM = 2.333;
	PathView.prototype.flagSpacing = 2;
	PathView.prototype.flagSpacingEM = 0.1;
	PathView.prototype.textDetailTopLineHeight = "1.5em";
	PathView.prototype.textDetailLeftMargin = 10; /* textLeftMargin; */

	PathView.prototype.commentLineHeight = 0;
	PathView.prototype.commentLabelTopMargin = 5;
	PathView.prototype.commentLabelBottomMargin = 10;
	PathView.prototype.commentLabelLeftMargin = 10;

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
							  
	PathView.prototype.emToPX = 11;
							  
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
		var e = fd.experience;
		var offeringCell = e.getCell("Offering");
		
		var f = function(eventObject)
			{
				var fd = d3.select(eventObject.data).datum();
				fd.colorElement(eventObject.data);
			}
		
		$(offeringCell).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, r, f);
		$(r).one("clearTriggers.cr remove", function()
			{
				$(offeringCell).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, f);
			});
		this.setupServiceTriggers(r, fd, f);
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
				offering.isDataLoaded = true;
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
	
	PathView.prototype.setupClipID = function()
	{
		/* Set up a clipID that uniquely identifies the clip paths for this PathView. */
		this.clipID = PathView.prototype.nextClipID;
		PathView.prototype.nextClipID += 1;
	}
	
	PathView.prototype.setupClipPaths = function()
	{
		this.defs.selectAll('clipPath').remove();
		
		/* Add a clipPath for the detail area. */
		this.defs.append('clipPath')
			.attr('id', 'id_detailClipPath{0}'.format(this.clipID))
			.append('rect');
	}
	
	PathView.prototype.canEditExperience = function(fd)
	{
		return fd.experience.typeName == "More Experience" && fd.experience.canWrite();
	}
	
	PathView.prototype.changedContent = function()
	{
		var hasEditChevron = this.canEditExperience(this.detailGroup.datum());
		var iconAreaWidth = (hasEditChevron ? this.showDetailIconWidth + this.textDetailLeftMargin : 0);
		var rectWidth = $(this.detailGroup.node()).children('text')
							.map(function() { return this.getBBox().width; })
							.toArray()
							.reduce(function(a, b) { return Math.max(a, b); }, 0) +
						iconAreaWidth + (this.textDetailLeftMargin * 2);
							
		this.detailGroup.selectAll('line').attr('x2', rectWidth);
		this.detailGroup.selectAll('rect').attr('width', rectWidth);
		d3.select("#id_detailClipPath{0}".format(this.clipID)).selectAll('rect')
			.attr('width', rectWidth);
			
		this.detailGroup.select('image.edit-chevron')
			.attr('x', rectWidth - this.showDetailIconWidth - this.textDetailLeftMargin)
	}
	
	PathView.prototype.getDetailClipPath = function()
	{
		return 'url(#id_detailClipPath{0})'.format(this.clipID);
	}
	
	PathView.prototype.appendDetailGroupElements = function(fd)
	{
		var _this = this;
		
		var detailText = fd.appendText(this.detailGroup);
		
		var textBox = detailText.node().getBBox();
		
		this.detailRectHeight = textBox.height + (textBox.y * 2) + this.textBottomMargin;

		if (this.canEditExperience(fd))
		{	
			this.detailGroup.append('image')
				.classed('edit-chevron', true)
				.attr("width", this.showDetailIconWidth)
				.attr("height", this.showDetailIconWidth)
				.attr("xlink:href", rightChevronPath)
				.attr('y', textBox.y + (textBox.height - this.showDetailIconWidth) / 2);
		}
			
		var commentsValue = fd.experience.getValue("Comments");
		var commentsCount = (commentsValue && commentsValue.getValueID()) ? parseInt(commentsValue.getDescription()) : 0;
		if (fd.experience.canWrite() ||
			commentsCount > 0)
		{
			this.detailRectHeight += (this.commentLineHeight / 2);
			this.detailCommentRect.attr('x', 1.5)
				.attr('y', this.detailRectHeight)
				.on("click", function(d) 
					{ 
						d3.event.stopPropagation(); 
					})
				.on("click.cr", function(fd, i)
					{
						_this.showCommentsPanel(fd, i);
					});
				
			var commentLine = this.detailGroup.append('line')
				.attr('x1', this.commentLabelLeftMargin)
				.attr('y1', this.detailRectHeight)
				.attr('y2', this.detailRectHeight);
		
			var commentLabel = this.detailGroup.append('text')
				.classed('comments', true)
				.attr('x', this.commentLabelLeftMargin)
				.on("click", function(d) 
					{ 
						d3.event.stopPropagation(); 
					})
				.on("click.cr", function(fd, i)
					{
						_this.showCommentsPanel(fd, i);
					});
			
			function setCommentsText()
			{
				var commentsCount = (commentsValue && commentsValue.getValueID()) ? parseInt(commentsValue.getDescription()) : 0;
				commentLabel.text(commentsCount == 0 ? "Comments" : commentsCount == 1 ? "1 Comment" : "{0} Comments".format(commentsCount));
				
				_this.changedContent();
			}
			
			var commentsCell = fd.experience.getCell("Comments");
			setCommentsText();
			$(commentsCell).on("dataChanged.cr valueAdded.cr valueDeleted.cr", null, commentLabel,
				setCommentsText);
			$(commentLabel.node()).on("remove", null, commentsCell, function(eventObject)
				{
					$(eventObject.data).off("dataChanged.cr valueAdded.cr valueDeleted.cr", null, setCommentsText);
				});
			
			var commentLabelY = this.commentLineHeight / 2 + this.commentLabelTopMargin + commentLabel.node().getBBox().height;
			commentLabel
				.attr('y', this.detailRectHeight + commentLabelY);
			
			this.detailCommentRect.attr('height', commentLabelY + this.commentLabelBottomMargin);

			this.detailRectHeight += commentLabelY + this.commentLabelBottomMargin;
		}
	}
	
	PathView.prototype.showDetailGroup = function(fd, duration)
	{
		duration = (duration !== undefined ? duration : 700);
		var _this = this;
				
		this.detailGroup.datum(fd);
		this.detailGroup.selectAll('rect').datum(fd);
		
		this.appendDetailGroupElements(fd);
		
		this.detailGroup.attr("transform", 
		                      "translate({0},{1})".format(fd.x + this.experienceGroupDX, (fd.y * this.emToPX) + this.experienceGroupDY));
		this.detailGroup.selectAll('rect')
			.attr('x', this.detailRectX)	/* half the stroke width */;
		this.detailFrontRect.datum().colorElement(this.detailFrontRect.node());
		this.detailFrontRect.each(function(d) { _this.setupColorWatchTriggers(this, d); });
		this.detailGroup.selectAll('rect.full')
			.attr('height', this.detailRectHeight);
	   
		this.detailFlagData = fd;
		
		/* Set the clip path of the text to grow so the text is revealed in parallel */
		var textClipRect = d3.select("#id_detailClipPath{0}".format(this.clipID)).selectAll('rect')
			.attr('x', 1.5)
			.attr('y', 0); 
		
		if (duration > 0)
		{
			textClipRect.attr('height', 0)
				.transition()
				.duration(duration)
				.attr('height', this.detailRectHeight); 
		}
		else
		{
			textClipRect.attr('height', this.detailRectHeight); 
		}
		
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
		 experience.getCell("Timeframe"),
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
				$(d).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, _this, handleChangeDetailGroup);
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
					$(d).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, handleChangeDetailGroup);
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
		
		this.changedContent();
		this.setupHeights();
		this.setupWidths();
		
		if (duration > 0)
		{
			this.scrollToRectangle(this.containerDiv, 
							   {y: (fd.y * this.emToPX) + this.experienceGroupDY,
							    x: fd.x + this.experienceGroupDX,
							    height: this.detailRectHeight,
							    width: parseFloat(this.detailFrontRect.attr('width'))},
							   this.topNavHeight,
							   this.bottomNavHeight,
							   duration);
		}
	}
	
	PathView.prototype.clearDetail = function()
	{
		this.detailGroup.selectAll('text').remove();
		/* Remove the image here instead of when the other clipPath ends
			so that it is sure to be removed when the done method is called. 
		 */
		this.detailGroup.selectAll('image').remove();
		this.detailGroup.selectAll('line').remove();
		d3.select("#id_detailClipPath{0}".format(this.clipID)).attr('height', 0);
		
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
			}
		}
		else if (done)
			done();
	}
	
	PathView.prototype.updateDetail = function(fd, duration)
	{
		var _this = this;
		fd.checkOfferingCells(function()
			{
				_this.hideDetail(
					function() { _this.showDetailGroup(fd, duration); },
					duration);
			});
	}
	
	PathView.prototype.refreshDetail = function()
	{
		this.updateDetail(this.detailFlagData, 0);
	}
	
	/* Append the detail contents that are static. */
	PathView.prototype.appendDetailContents = function()
	{
		this.detailBackRect = this.detailGroup.append('rect')
			.classed('bg full', true);
		this.detailFrontRect = this.detailGroup.append('rect')
			.classed('detail full', true);
		this.detailCommentRect = this.detailGroup.append('rect')
			.classed('comments', true);
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
					var experience = new Experience(fd.experience.cell.parent, fd.experience);
					experience.replaced(fd.experience);
					
					var editPanel = new NewExperiencePanel(experience, panel, experience.getPhase(), revealPanelLeft);
					
					revealPanelLeft(editPanel.node());
				}
				catch(err)
				{
					cr.syncFail(err);
				}
				d3.event.stopPropagation();
			}
		}
	}
	
	PathView.prototype.showCommentsPanel = function(fd, i)
	{
		if (fd.experience.typeName == "Experience") {
			;	/* Nothing to edit */
		}
		else
		{
			if (prepareClick('click', 'show experience comments: ' + fd.getDescription()))
			{
				try
				{
					var panel = this.sitePanel.node();
					var newPanel = new ExperienceCommentsPanel(fd, panel);
					
					revealPanelLeft(newPanel.node());
				}
				catch(err)
				{
					cr.syncFail(err);
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
		$(experience.getCell("Timeframe")).on("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this, this.handleExperienceDateChanged);
		
		$(this.sitePanel.node()).on("remove", null, experience, function(eventObject)
		{
			$(eventObject.data).off("dataChanged.cr", null, handleDataChanged);
			$(eventObject.data.getCell("Start")).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this.handleExperienceDateChanged);
			$(eventObject.data.getCell("End")).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this.handleExperienceDateChanged);
			$(eventObject.data.getCell("Timeframe")).off("valueAdded.cr valueDeleted.cr dataChanged.cr", null, this.handleExperienceDateChanged);
		});
	}
	
	PathView.prototype.addMoreExperience = function(experience)
	{
		this.checkOfferingCells(experience);
		
		this.allExperiences.push(experience);
		
		this.setupExperienceTriggers(experience);
		
		var flags = this.appendExperiences(experience);

		this.redoLayout();
		
		this.updateDetail(flags.datum(), 700);
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
			
			ybj = fds[i+1].yearBounds;
			if (ybi.bottom == ybj.top)
				ybi.bottom = undefined;
			else if (fdi.y2 > fdi.y + this.flagHeightEM) {	/* Overlapping flag-pole */
				for (var j = i + 1; j < fds.length; ++j)
				{
					var fdj = fds[j];
					if (fdj.y < fdi.y2 && fdj.y2 >= fdi.y2)	/* If this crosses the bottom,  */
					{
						var isShortFlagpole = fdj.y + this.flagHeightEM == fdj.y2;
						/* If the item after i's flag-pole has the same top year
								then eliminate i's bottom (it is a duplicate year marker). 
							or if the item at i's flag-pole has a lesser bottom year than i's flag-pole
								then if that item doesn't extend below i,
									then eliminate i's bottom (two labels will overlap)
								otherwise, if the lower item's top is the same as i's bottom,
									then eliminate the lower item's top (it is a duplicate year marker and higher.)
						 */
						if (isShortFlagpole && j < fds.length - 1 && fds[j+1].yearBounds.top == fdi.yearBounds.bottom)
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
		
		/* For the last FlagData, if the yearBounds are the same for the top and bottom, then 
		    clear the top.
		 */
		if (fds.length > 0)
		{
			var ybi = fds[fds.length - 1].yearBounds;
			if (ybi.top == ybi.bottom)
				ybi.top = undefined;
		}
		
		fds.forEach(function(fd)
		{
			if (fd.yearBounds.top)
			{
				_this.yearGroup.append('text')
					.text(fd.yearBounds.top)
					.attr('x', _this.yearTextX)
					.attr('y', _this.experienceGroupDY + (fd.y + yearHeight) * _this.emToPX);
			}
			if (fd.yearBounds.bottom)
			{
				_this.yearGroup.append('text')
					.text(fd.yearBounds.bottom)
					.attr('x', _this.yearTextX)
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
	PathLines.prototype.defs = null;
	PathLines.prototype.bg = null;
	PathLines.prototype.loadingText = null;
	PathLines.prototype.promptAddText = null;
	PathLines.prototype.yearGroup = null;
	PathLines.prototype.guideGroup = null;
	PathLines.prototype.experienceGroup = null;

	PathLines.prototype.flagWidth = 0;
	
	PathLines.prototype.columnData = PathGuides.data;

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
			
			/* Make sure that the rectangles match the widths. */
			var g = d3.select(eventObject.data);
			g.selectAll('rect')
				.attr('width', function(fd)
					{
						return $(this.parentNode).children('text').outerWidth() + 
							(2 * _this.textDetailLeftMargin);
					});	
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
						_this.updateDetail(fd);
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
		var text = g.append('text').classed('flag-label', true)
			.attr('x', this.textDetailLeftMargin);
		text.append('tspan')
			.attr('dy', this.textDetailTopLineHeight);
		
		g.each(function() { _this.setFlagText(this); });
		
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
						$(_this.experienceGroup.selectAll('g.flag')[0]).remove();
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
	
	/* Set up the widths of the objects based on the data. */
	PathLines.prototype.setupWidths = function()
	{
		var guideGroupBounds = this.guideGroup.node().getBBox();
		var newWidth = guideGroupBounds.x + guideGroupBounds.width + this.experienceGroupDX;
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
	}
	
	PathLines.prototype.getUser = function()
	{
		return this.path.getValue("_user");
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
		
		this.setupClipID();

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
			
		this.detailGroup = this.svg.append('g')
			.classed('detail', true)
			.attr('clip-path', this.getDetailClipPath())
			.on("click", function(d) 
				{ 
					d3.event.stopPropagation(); 
				})
			.on("click.cr", function(fd, i)
				{
					if (_this.canEditExperience(fd))
						_this.showDetailPanel(fd, i);
				});
				
		this.appendDetailContents();
			
		d3.select(this.containerDiv)
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
		
		return $.when(crp.promise({path:  "#" + this.path.getValueID() + '::reference(_user)::reference(Experience)', 
				   fields: ["parents"]})
				.done(function(experiences)
					{
						_this.allExperiences = experiences.slice();
						$(experiences).each(function()
						{
							this.setDescription(this.getValue("Offering").getDescription());
						});
					})
				.fail(cr.asyncFail))
		.then(function() {
			return crp.promise({path: "#" + _this.path.getValueID() + '::reference(_user)::reference(Experience)::reference(Experiences)' + 
								'::reference(Session)::reference(Sessions)::reference(Offering)'});
			})
		.then(function() {
				return crp.promise({path: "#" + _this.path.getValueID() + '>"More Experience">Offering'});
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
							var panel = new Settings(user, _this.node());
							showPanelUp(panel.node())
								.always(unblockClick);
						}
						catch(err)
						{
							syncFailFunction(err);
						}
					}
					d3.event.preventDefault();
				})
			.classed("settings", true)
			.style("display", user.privilege == "_administer" ? null : "none")
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
				
			var panel = new NewExperiencePanel(experience, this.node(), phase);
			showPanelUp(panel.node())
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
			
		var moreExperiences = user.getValue("More Experiences");
		var canAddExperience = (moreExperiences.getValueID() === null ? user.canWrite() : moreExperiences.canWrite());
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
		this.searchPanel = new SearchPathsPanel(this.node());
	}
	
	function PathlinesPanel(user, previousPanel, done) {
		var _this = this;
		this.user = user;
		
		SitePanel.call(this, previousPanel, null, "My Pathway", "pathway");

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
// 								var newPanel = new FindExperiencePanel(cr.signedinUser, null, null, _this.node());
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
				this.sitePanel.setupAddExperienceButton(user, addExperienceButton);
				
				this.sitePanel.setupSettingsButton(settingsButton, user);

				$(user.getCell("_access request")).on("valueDeleted.cr valueAdded.cr", checkSettingsBadge);
				checkSettingsBadge();
				
				$(user.getCell("_first name")).on("dataChanged.cr", checkTitle);
				$(user.getCell("_last name")).on("dataChanged.cr", checkTitle);
				$(user.getCell("_email")).on("dataChanged.cr", checkTitle);
				
// 				findButton.style("display", user.privilege === "_administer" ? null : "none");
				
				this.isMinHeight = true;
				this.sitePanel.calculateHeight();
				
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
						panel.remove();
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
					if (prepareClick('click', "Email Pathway Link"))
					{
						$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
							panel.remove();
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
		var dimmer = new Dimmer(panelNode);
		var panel = d3.select(panelNode).append('panel')
			.classed("confirm", true);
		var div = panel.append('div')
			.style('margin-bottom', '{0}px'.format(pathlinesPanel.getBottomNavHeight()));
		
		function handleCancel(done, fail)
		{
			$(confirmButton.node()).off('blur');
			$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
				panel.remove();
				if (done) done();
			});
		}
		function onCancel(e)
		{
			try
			{
				handleCancel(undefined);
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
						if (prepareClick('click', name))
						{
							dimmer.hide();
							clickFunction(unblockClick, syncFailFunction);
						}
					});
			return button;
		}
		
		var confirmButton = addButton(div, this.addPreviousExperienceLabel, 
			function(done, fail)
			{
				$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
					panel.remove();
					pathlinesPanel.startNewExperience('Previous', done, fail);
				});
			})
			.classed('butted-down', true);
		$(confirmButton.node()).on('blur', onCancel);
		
		addButton(div, this.addCurrentExperienceLabel, 
			function(done, fail)
			{
				$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
					panel.remove();
					pathlinesPanel.startNewExperience('Current', done, fail);
				});
			})
			.classed('butted-down', true);
		
		addButton(div, this.addGoalLabel, 
			function(done, fail)
			{
				$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
					panel.remove();
					pathlinesPanel.startNewExperience('Goal', done, fail);
				});
			});
			
		addButton(div, 'More Ideas',
			function(done, fail)
			{
				$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
					panel.remove();
					new ExperienceIdeas(panelNode, pathlinesPanel.pathtree.path, done, fail);
				});
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
										var dtID = dt.getValueID();
										return moreExperienceData.find(function(experience)
											{
												return experience.getCell("Service").data.find(function(service)
													{
														return service.getValueID() == dtID;
													}) ||
													experience.getCell("Offering").data.find(function(offering)
														{
															return !offering.isEmpty() && offering.getCell("Service").data.find(function(service)
																{
																	return service.getValueID() == dtID;
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
				var dimmer = oldExperiencePanel ? oldExperiencePanel.dimmer : new Dimmer(_this.panelNode).show();
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
					if (prepareClick('click', 'Answer'))
					{
						try
						{
							experience.initPreviousDateRange();
							var panel = new NewExperiencePanel(experience, panelNode, 'Previous',
								function()
								{
									skipButton.on('click')();
								});
							showPanelUp(panel.node())
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
				var tempExperience = new Experience(cr.signedinUser.getValue("More Experiences"), fd.experience);
				var newPanel = new NewExperiencePanel(tempExperience, this.sitePanel.node(), tempExperience.getPhase());
				showPanelUp(newPanel.node())
					.always(unblockClick);
			}
			catch(err)
			{
				cr.syncFail(err);
			}
		}
	}
	
	OtherPathlines.prototype.appendDetailGroupElements = function(fd)
	{
		PathView.prototype.appendDetailGroupElements.call(this, fd);
		
		var _this = this;
		
		this.detailRectHeight += (this.commentLineHeight / 2);
		this.detailAddToPathRect.attr('x', 1.5)
			.attr('y', this.detailRectHeight)
			.on("click", function(d) 
				{ 
					d3.event.stopPropagation(); 
				})
			.on("click.cr", function(fd, i)
				{
					_this.handleAddToPathway(fd, i);
				});
			
		var commentLine = this.detailGroup.append('line')
			.attr('x1', this.commentLabelLeftMargin)
			.attr('y1', this.detailRectHeight)
			.attr('y2', this.detailRectHeight);
	
		var commentLabel = this.detailGroup.append('text')
			.classed('comments', true)
			.attr('x', this.commentLabelLeftMargin)
			.on("click", function(d) 
				{ 
					d3.event.stopPropagation(); 
				})
			.on("click.cr", function(fd, i)
				{
					_this.handleAddToPathway(fd, i);
				})
			.text("Add to My Path");
		
		var commentLabelY = this.commentLineHeight / 2 + this.commentLabelTopMargin + commentLabel.node().getBBox().height;
		commentLabel
			.attr('y', this.detailRectHeight + commentLabelY);
		
		this.detailAddToPathRect.attr('height', commentLabelY + this.commentLabelBottomMargin);

		this.detailRectHeight += commentLabelY + this.commentLabelBottomMargin;
	}
	
	OtherPathlines.prototype.appendDetailContents = function()
	{
		PathLines.prototype.appendDetailContents.call(this);
		
		this.detailAddToPathRect = this.detailGroup.append('rect')
			.classed('comments', true);
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
	
	function OtherPathPanel(path, previousPanel, done) {
		var _this = this;
		this.path = path;
		
		SitePanel.call(this, previousPanel, null, "Other Pathway", "pathway");

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
				this.sitePanel.calculateHeight();
			});
	}
	
	return OtherPathPanel;
})();

