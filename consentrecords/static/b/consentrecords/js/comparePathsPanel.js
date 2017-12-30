/* comparePathsPanel.js */

var CompareFlag = (function() {
	CompareFlag.prototype = Object.create(FlagController.prototype);
	CompareFlag.prototype.constructor = CompareFlag;

	CompareFlag.prototype.getEndAge = function()
	{
		endDate = new Date(this.getEndDate());
		return endDate - this.birthday;
	}
	
	CompareFlag.prototype.getStartAge = function()
	{
		startDate = new Date(this.getStartDate());
		return startDate - this.birthday;
	}
	
	CompareFlag.prototype.startsBeforeOtherEnd = function(otherFD)
	{
		return this.getStartAge() < otherFD.getEndAge();
	}
	
	CompareFlag.prototype.getYearArray = function()
	{
		var e = this.experience.end();
		var s = this.experience.start();
		var t = this.experience.timeframe && this.experience.timeframe();
		var top, bottom;
		
		if (e)
			top = this.ageCalculator.getYears(e);
		else if (t == "Goal")
			top = "Goal";
		else if (s || t == "Current")
			top = this.ageCalculator.getYears(new Date().toISOString().substr(0, 10));
		else
			top = "Done";
			
		if (s)
			bottom = this.ageCalculator.getYears(s);
		else if (t == "Previous")
			bottom = "Done";
		else if (t == "Current")
			bottom = this.ageCalculator.getYears(new Date().toISOString().substr(0, 10));
		else
			bottom = "Goal";
		
		return {top: top, bottom: bottom};
	}
	
	/* Return true if the experience in this flag is on the specified path. */
	CompareFlag.prototype.isOnPath = function(path)
	{
		return (this.experience instanceof cr.Engagement) ?
			   (this.experience.user().id() == path.user().id()) :
			   (this.experience.path() == path);
	}
	
	function CompareFlag(experience, ageCalculator)
	{
		FlagController.call(this, experience);
		this.ageCalculator = ageCalculator;
		this.birthday = ageCalculator.birthdays[0];
	}
	
	return CompareFlag;
})();

var ComparePath = (function() {
	ComparePath.prototype = Object.create(PathView.prototype);
	ComparePath.prototype.constructor = ComparePath;

	ComparePath.prototype.youName = "You";
	
	ComparePath.prototype.poleSpacing = 4;
	
	ComparePath.prototype.textLeftMargin = 3;
	ComparePath.prototype.textDetailRightMargin = 7; /* textRightMargin; */
	
	/* Translate coordinates for the elements of the experienceGroup within the svg */
	ComparePath.prototype.experienceGroupDX = 40;
	ComparePath.prototype.experienceGroupDY = 3.6; /* em */
	
	ComparePath.prototype.guideHSpacing = 0;

	ComparePath.prototype.leftPath = null;
	ComparePath.prototype.rightPath = null;
	ComparePath.prototype.pathwayContainer = null;
	ComparePath.prototype.svg = null;
	ComparePath.prototype.loadingMessage = null;
	ComparePath.prototype.bg = null;
	ComparePath.prototype.loadingText = null;
	ComparePath.prototype.yearGroup = null;
	ComparePath.prototype.guideGroup = null;
	ComparePath.prototype.experienceGroup = null;

	ComparePath.prototype.columnData = [{labelY: PathGuides.labelYs[0], color: "#666"}, 
										{labelY: PathGuides.labelYs[0], color: "#666"}];

	ComparePath.prototype.getColumn = function(fd)
	{
		if (fd.isOnPath(this.rightPath))
			return 1;
		else
			return 0;
	}

	ComparePath.prototype._compareExperiences = function(a, b)
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
		
		var diff = -compareDates(a.getEndAge(), b.getEndAge()) ||
				a.column - b.column;
		if (diff)
			return diff;
			
		return compareDates(a.getStartAge(), b.getStartAge());
	}
	
	/* Lay out all of the contents within the svg object. */
	ComparePath.prototype.layout = function()
	{
		var g = this.experienceGroup.selectAll('g.flag');
		var y = this.yearGroup.selectAll('text');
		
		var _this = this;
		
		g.each(function(fd)
		{
			fd.column = _this.getColumn(fd);
		});
		numColumns = 2;
		this.guideHSpacing = (this.sitePanel.scrollAreaWidth() - this.experienceGroupDX) / numColumns;
		
		/* Space out all of the guides */
		this.guideGroup.selectAll('g')
			.attr('transform', function(d, i) { return "translate({0}, 0)".format(i * _this.guideHSpacing); });
			
		this.guideGroup.selectAll('tspan').remove();
		this.guideGroup.selectAll('g>text')
			.each(function(d, i)
				{
					var t = d3.select(this);
					FlagController.appendWrappedText(d.name, function(i)
							{
								return t.append("tspan")
									.attr("x", 0)
									.attr("dy", "{0}em".format(i));
							},
							_this.guideHSpacing - _this.textDetailRightMargin);
				});

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

	ComparePath.prototype.checkLayout = function()
	{
		if ($(this.containerDiv).width() === 0)
			return;
		
		if (!this.isLayoutDirty)
			return;
		
		this.layout();
		this.isLayoutDirty = false;
	}
	
	ComparePath.prototype.redoLayout = function()
	{
		this.clearLayout();
		this.checkLayout();
	}
	
	ComparePath.prototype.deepClone = function(fromElement)
	{
		var toElement = fromElement.cloneNode(false);
		for (var i = 0; i < fromElement.childNodes.length; ++i)
		{
			toElement.appendChild(this.deepClone(fromElement.childNodes[i]));
		}
		return toElement;
	}
	
	ComparePath.prototype.appendExperiences = function(experience)
	{
		var _this = this;

		var offsetX;
		var offsetY;
		var ghostGroup;
		var didDrag;
		var g;
		
		function getCompareFlag(experience)
			{
				var isLeft = (experience instanceof cr.Engagement) ?
							 (experience.user().id() == _this.leftPath.user().id()) :
							 (experience.path() == _this.leftPath);
				if (isLeft)
					return new CompareFlag(experience, _this.leftAgeCalculator);
				else
					return new CompareFlag(experience, _this.rightAgeCalculator);
			}
		if (experience)
		{
			g = this.experienceGroup.append('g')
				.datum(getCompareFlag(experience));
		}
		else
		{
			g = this.experienceGroup.selectAll('g')
				.data(this.allExperiences.map(function(e) { 
					return getCompareFlag(e); }))
				.enter()
				.append('g');
		}
		
		this.setupFlags(g);

		g.attr('draggable', 'true')
			.call(
				d3.behavior.drag()
					.on("dragstart", function(){
						try
						{
							var offset = d3.mouse(this);
							offsetX = offset[0];
							offsetY = offset[1];
							ghostGroup = _this.deepClone(this);
							_this.experienceGroup.node().appendChild(ghostGroup);
							didDrag = false;
						}
						catch(err)
						{
							console.log(err);
						}
					})
					.on("drag", function(){
						didDrag = true;
						ghostGroup.setAttributeNS(null, "transform", "translate({0},{1})".format(d3.event.x - offsetX, d3.event.y - offsetY));
					})
					.on("dragend", function(fd, i){
						d3.select(ghostGroup).remove();
						if (!didDrag)
						{
							cr.logRecord('click', 'show comments: ' + fd.getDescription());
							_this.showCommentsPanel(this, fd);
						}
					})
				);
		
		return g;
	}
	
	ComparePath.prototype.getPathDescription = function(path, ageCalculator)
	{
		return (cr.signedinUser && path == cr.signedinUser.path() && this.youName) ||
			path.caption() ||
			ageCalculator.toString();
	}
	
	ComparePath.prototype.handleResize = function()
	{
		this.checkNavHeights();
		if (this.isLayoutDirty)
			this.checkLayout();
		else
		{
			this.layout();
		}
	}
		
	ComparePath.prototype.showAllExperiences = function()
	{
		var _this = this;
		var firstTime = true;
		
		this.leftAgeCalculator = new AgeCalculator(this.leftPath.birthday());
		this.rightAgeCalculator = new AgeCalculator(this.rightPath.birthday());
		
		this.columnData[0].name = this.getPathDescription(this.leftPath, this.leftAgeCalculator);
		this.columnData[1].name = this.getPathDescription(this.rightPath, this.rightAgeCalculator);
		
		this.appendGuides(this.columnData);
	
		var addedFunction = function(eventObject, newData)
			{
				_this.addMoreExperience(newData);
			}
		setupOnViewEventHandler(this.leftPath, "experienceAdded.cr", this.pathwayContainer.node(), addedFunction);
		setupOnViewEventHandler(this.rightPath, "experienceAdded.cr", this.pathwayContainer.node(), addedFunction);
		
		this.allExperiences = this.leftPath.experiences().slice()
			.concat(this.rightPath.experiences())
			
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
		this.allExperiences.forEach(function(d)
			{
				_this.setupExperienceTriggers(d);
			});

		$(this.sitePanel.mainDiv.node()).on("resize.cr", resizeFunction);
	}
	
	ComparePath.prototype.setUser = function(leftPath, rightPath)
	{
		if (leftPath.privilege() === cr.privileges.find)
			throw new Error("You do not have permission to see information about {0}".format(leftPath.getDescription()));
		if (rightPath.privilege() === cr.privileges.find)
			throw new Error("You do not have permission to see information about {0}".format(rightPath.getDescription()));
		if (this.leftPath)
			throw new Error("paths have already been set for this pathtree");
			
		var _this = this;
		
		this.leftPath = leftPath;
		this.rightPath = rightPath;

		this.appendPathSVG();

		/* setupHeights now so that the initial height of the svg and the vertical lines
			consume the entire container. */
		this.checkNavHeights();
		this.setupHeights();
		
		var successFunction2 = function()
		{
			if (_this.leftPath == null)
				return;	/* The panel has been closed before this asynchronous action occured. */
				
			_this.showAllExperiences();
			
			crv.stopLoadingMessage(_this.loadingMessage);
			_this.loadingMessage.remove();
			
			$(_this).trigger("userSet.cr");
		}
		
		this.rightPath.promiseExperiences()
		.then(successFunction2, cr.asyncFail);
	}
	
	function ComparePath(sitePanel, containerDiv) {
		PathView.call(this, sitePanel, containerDiv);
		d3.select(containerDiv).classed('vertical-scrolling', false)
			.classed('all-scrolling', true);
	}
	
	return ComparePath;
})();

var ComparePathsPanel = (function () {
	ComparePathsPanel.prototype = Object.create(crv.SitePanel.prototype);
	ComparePathsPanel.prototype.constructor = ComparePathsPanel;

	ComparePathsPanel.prototype.leftUser = null;
	ComparePathsPanel.prototype.rightUser = null;
	ComparePathsPanel.prototype.pathtree = null;
	ComparePathsPanel.prototype.navContainer = null;
	
	ComparePathsPanel.prototype.getBottomNavHeight = function()
	{
		return 0;
	}
	
	function ComparePathsPanel(leftUser, rightUser) {
		var _this = this;
		this.leftUser = leftUser;
		this.rightUser = rightUser;
		
		this.createRoot(null, "Compare Pathways", "compare-paths");

		var panel2Div = this.appendScrollArea();

		this.navContainer = this.appendNavContainer();
		this.navContainer.nav
			.classed("transparentTop", true);

		var settingsButton;
		
		var backButton = this.navContainer.appendLeftButton()
			.on("click", function() { _this.hideRightEvent(); });
		backButton.append("span").text(crv.buttonTexts.done);

		this.navContainer.appendTitle("Compare Paths");
		
		if (this.pathtree)
			throw "pathtree already assigned to pathtree panel";
			
		this.pathtree = new ComparePath(this, panel2Div.node());
		this.pathtree.setUser(this.leftUser.path(),
							  this.rightUser.path());
		
		$(this.pathtree).on("userSet.cr", function()
			{
				this.isMinHeight = true;
				_this.calculateHeight();
			});
	}
	
	return ComparePathsPanel;
})();

