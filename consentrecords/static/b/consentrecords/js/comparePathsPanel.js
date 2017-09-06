/* comparePathsPanel.js */

var AgeCalculator = (function() {
	AgeCalculator.prototype.birthdays = null;
	
	AgeCalculator.prototype.getBirthday = function()
	{
		return this.birthdays[0];
	}
	
	AgeCalculator.prototype.getAge = function(dateString)
	{
		return new Date(dateString) - this.birthdays[0];
	}
	
	AgeCalculator.prototype.getYears = function(dateString)
	{
		var d = new Date(dateString);
		var min = 0;
		var range = this.birthdays.length - 1;
		var mid;
		while (true)
		{
			if (min > range)
			{
				if (min < this.birthdays.length)
					return min - 1;
					
				// Extend the birthday list until it overruns the searched for date.
				while (d > this.birthdays[this.birthdays.length - 1])
				{
					var bd = new Date(this.birthdays[0].valueOf());
					bd.setUTCFullYear(this.birthdays[0].getUTCFullYear() + this.birthdays.length)
					this.birthdays.push(bd);
				}
				return this.birthdays.length - 2;
			}

			mid = Math.floor((min + range) / 2);
			if (this.birthdays[mid] < d)
				min = mid + 1;
			else if (this.birthdays[mid] > d)
				range = mid - 1;
			else
				return mid;
		}
	}
	
	AgeCalculator.prototype.toString = function()
	{
		return "{0}-year-old".format(this.getYears(new Date().toISOString().substr(0, 10)));
	}
	
	function AgeCalculator(s)
	{
		var d = new Date(s);
		this.birthdays = [d];
	}
	
	return AgeCalculator;
})();

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
	ComparePath.prototype.pathBackground = "white";
	ComparePath.prototype.showDetailIconWidth = 18;
	ComparePath.prototype.loadingMessageTop = "4.5em";
	ComparePath.prototype.promptRightMargin = 14;		/* The minimum space between the prompt and the right margin of the svg's container */
	
	/* Translate coordinates for the elements of the experienceGroup within the svg */
	ComparePath.prototype.experienceGroupDX = 40;
	ComparePath.prototype.experienceGroupDY = 37;
	
	ComparePath.prototype.guideHSpacing = 0;

	ComparePath.prototype.detailRectX = 1.5;
	
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

	ComparePath.prototype.flagWidth = 0;
	
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
		this.topNavHeight = $(this.sitePanel.navContainer.nav.node()).outerHeight();
		this.bottomNavHeight = $(this.sitePanel.bottomNavContainer.nav.node()).outerHeight();
		this.pathwayContainer.style('top', "{0}px".format(this.topNavHeight));
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
		
		var guides = this.guideGroup.selectAll('g')
			.data(this.columnData)
			.enter()
			.append('g');
		
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
			.attr('y', function(d, i) { return d.labelY; });
		guides.append('line')
			.classed('column', true)
			.attr('x1', 0)
			.attr('y1', function(d) { 
				return d.labelY + 3 + (9 * (d.name.split(' ').length - 1)); 
				})
			.attr('x2', 0)
			.attr('y2', 500)
			.attr('stroke', function(d) { return d.color; });
	
		var addedFunction = function(eventObject, newData)
			{
				_this.addMoreExperience(newData);
			}
		setupOnViewEventHandler(this.leftPath, "experienceAdded.cr", this.pathwayContainer.node(), addedFunction);
		setupOnViewEventHandler(this.rightPath, "experienceAdded.cr", this.pathwayContainer.node(), addedFunction);
		
		this.allExperiences = this.leftPath.engagements().splice()
			.concat(this.rightPath.engagements())
			.concat(this.leftPath.experiences())
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
		this.allExperiences.filter(function(d)
			{
				return d instanceof cr.Experience;
			})
			.forEach(function(d)
			{
				_this.setupExperienceTriggers(d);
			});

		$(this.sitePanel.mainDiv.node()).on("resize.cr", resizeFunction);
	}
	
	/* Sets the heights of objects that depend on either the layout of 
		the scroll area
		or the layout of the experiences
		or the detail group. 
	 */
	ComparePath.prototype.setupHeights = function()
	{
		var containerBounds = this.containerDiv.getBoundingClientRect();
		var pathwayBounds = this.pathwayContainer.node().getBoundingClientRect();
		var svgHeight = containerBounds.height - (pathwayBounds.top - containerBounds.top);
		
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
	
	ComparePath.prototype.setupWidths = function()
	{
		var newWidth = this.sitePanel.scrollAreaWidth();
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
	
	ComparePath.prototype.setUser = function(leftPath, rightPath, editable)
	{
		if (leftPath.privilege() === cr.privileges.find)
			throw "You do not have permission to see information about {0}".format(leftPath.getDescription());
		if (rightPath.privilege() === cr.privileges.find)
			throw "You do not have permission to see information about {0}".format(rightPath.getDescription());
		if (this.leftPath)
			throw "paths have already been set for this pathtree";
			
		var _this = this;
		
		this.leftPath = leftPath;
		this.rightPath = rightPath;
		this.editable = (editable !== undefined ? editable : true);

		var container = d3.select(this.containerDiv);
		
		this.pathwayContainer = container.append('div')
			.classed("compare-paths", true);
			
		this.svg = this.pathwayContainer.append('svg')
			.classed("pathway compare-paths", true)
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
				
		this.experienceGroup = this.svg.append('g')
				.classed("experiences", true)
				.attr('transform', 'translate({0},{1})'.format(this.experienceGroupDX, this.experienceGroupDY));
			
		d3.select(this.containerDiv).selectAll('svg')
			.on("click", function() 
			{ 
				d3.event.stopPropagation(); 
			});
		
		/* setupHeights now so that the initial height of the svg and the vertical lines
			consume the entire container. */
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
	ComparePathsPanel.prototype.bottomNavContainer = null;
	
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
		
		var addExperienceButton = this.navContainer.appendRightButton();
		
		this.bottomNavContainer = this.appendBottomNavContainer();
		this.bottomNavContainer.nav
			.classed("transparentBottom", true);

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

