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
	CompareFlag.prototype = new FlagData();
	
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
		var e = this.experience.getDatum("End");
		var s = this.experience.getDatum("Start");
		var t = this.experience.getValue("Timeframe");
		var top, bottom;
		
		if (e)
			top = this.ageCalculator.getYears(e);
		else if (s)
			top = "Now";
		else if (t && t.getDescription() == "Previous")
			top = "Done";
		else if (t && t.getDescription() == "Current")
			top = "Now";
		else
			top = "Goal";
			
		if (s)
			bottom = this.ageCalculator.getYears(s);
		else if (t && t.getDescription() == "Previous")
			bottom = "Done";
		else if (t && t.getDescription() == "Current")
			bottom = "Now";
		else
			bottom = "Goal";
		
		return {top: top, bottom: bottom};
	}
	
	function CompareFlag(experience, ageCalculator)
	{
		FlagData.call(this, experience);
		this.ageCalculator = ageCalculator;
		this.birthday = ageCalculator.birthdays[0];
	}
	
	return CompareFlag;
})();

var ComparePath = (function() {
	ComparePath.prototype = new PathView();
	
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
	ComparePath.prototype.defs = null;
	ComparePath.prototype.bg = null;
	ComparePath.prototype.loadingText = null;
	ComparePath.prototype.yearGroup = null;
	ComparePath.prototype.guideGroup = null;
	ComparePath.prototype.experienceGroup = null;

	ComparePath.prototype.flagWidth = 0;
	
	ComparePath.prototype.columnData = [{labelY: PathGuides.labelYs[0], color: "#666"}, 
										{labelY: PathGuides.labelYs[0], color: "#666"}];

	ComparePath.prototype.handleValueDeleted = function(experience)
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

	ComparePath.prototype.handleExperienceDateChanged = function(eventObject)
	{
		var _this = eventObject.data;
		var g = _this.experienceGroup.selectAll('g.flag');
		_this.transitionPositions(g);
	}
	
	ComparePath.prototype.setFlagText = function(node)
	{
		var g = d3.select(node);
		g.selectAll('text').selectAll('tspan:nth-child(1)')
			.text(function(d) { return d.getDescription(); })
	}
		
	/* Sets up each group (this) that displays an experience to delete itself if
		the experience is deleted.
	 */
	ComparePath.prototype.setupDelete = function(fd, node) 
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
	
	ComparePath.prototype.getColumn = function(fd)
	{
		if (fd.experience.cell.parent == this.rightPath)
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
					FlagData.appendWrappedText(d.name, function(i)
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
	
	ComparePath.prototype.transitionPositions = function(g)
	{
		g.sort(this._compareExperiences);
		this._setCoordinates(g);
		g.transition()
			.duration(1000)
			.ease("in-out")
			.attr("transform", function(fd) { return "translate({0},{1})".format(fd.x, fd.y);});
		
		/* Set the line length to the difference between fd.y2 and fd.y, since g is transformed
			to the fd.y position.
		 */
		g.selectAll('line.flag-pole')
			.transition()
			.duration(1000)
			.ease("in-out")
			.attr('y2', function(fd) { return fd.y2 - fd.y; });

		this.layoutYears(g);
	}
	
	ComparePath.prototype.appendExperiences = function(compareFlags)
	{
		var _this = this;

		this.setupClipID();
		
		$(this.experienceGroup.selectAll('g.flag')[0]).remove();
		var offsetX;
		var offsetY;
		var ghostGroup;
		var didDrag;
		var g = this.experienceGroup.selectAll('g')
			.data(compareFlags)
			.enter()
			.append('g')
			.classed('flag', true)
			.attr('draggable', 'true')
			.each(function(d)
				{
					_this.setupDelete(d, this);
				})
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
							showDetail(fd, i);
					})
				)
			.on("click", function() 
				{ 
					d3.event.stopPropagation(); 
				})
			.on("click.cr", function(fd, i)
				{
					if (!d3.event.defaultPrevented)
						_this.updateDetail(fd);
				})
			.each(function(d) 
					{ 
						_this.setupServiceTriggers(this, d, function(eventObject)
							{
								d.column = _this.getColumn(d);
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
	
	ComparePath.prototype.getPathDescription = function(path, ageCalculator)
	{
		return (cr.signedinUser && path.cell.parent == cr.signedinUser && this.youName) ||
			getPathDescription(path) ||
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
		
		var leftAgeCalculator = new AgeCalculator(this.leftPath.getValue("Birthday").getDescription());
		var rightAgeCalculator = new AgeCalculator(this.rightPath.getValue("Birthday").getDescription());
		
		this.columnData[0].name = this.getPathDescription(this.leftPath, leftAgeCalculator);
		this.columnData[1].name = this.getPathDescription(this.rightPath, rightAgeCalculator);
		
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
	
		var leftCell = this.leftPath.getCell("More Experience");
		var rightCell = this.rightPath.getCell("More Experience");
		var addedFunction = function(eventObject, newData)
			{
				eventObject.data.addMoreExperience(newData);
			}
		$(leftCell).on("valueAdded.cr", null, this, addedFunction);
		$(rightCell).on("valueAdded.cr", null, this, addedFunction);
		$(this.pathwayContainer.node()).on("remove", function()
			{
				$(leftCell).off("valueAdded.cr", null, addedFunction);
				$(rightCell).off("valueAdded.cr", null, addedFunction);
			});
			
		var experiences = leftCell.data;
		
		this.allExperiences = this.allExperiences.concat(experiences);
		
		this.allExperiences = this.allExperiences.concat(rightCell.data);
		$(rightCell.data).each(function()
			{
				this.calculateDescription();
			});
			
		/* Ensure that all of the offerings have their associated cells. */
		this.allExperiences.forEach(function(experience)
			{
				_this.checkOfferingCells(experience, null);
			});
			
		var compareFlags = leftCell.data.map(function(e) { 
				return new CompareFlag(e, leftAgeCalculator); 
				}).concat(rightCell.data.map(function(e) {
				return new CompareFlag(e, rightAgeCalculator);
				}));
	
		var resizeFunction = function()
		{
			/* Wrap handleResize in a setTimeout call so that it happens after all of the
				css positioning.
			 */
			setTimeout(function()
				{
					if (firstTime)
					{
						_this.appendExperiences(compareFlags);
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
	
	ComparePath.prototype.setupWidths = function()
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
	}
	
	ComparePath.prototype.setUser = function(leftPath, rightPath, editable)
	{
		if (leftPath.privilege === '_find')
			throw "You do not have permission to see information about {0}".format(leftPath.getDescription());
		if (rightPath.privilege === '_find')
			throw "You do not have permission to see information about {0}".format(rightPath.getDescription());
		if (this.leftPath)
			throw "paths have already been set for this pathtree";
			
		var _this = this;
		
		this.leftPath = leftPath;
		this.rightPath = rightPath;
		this.editable = (editable !== undefined ? editable : true);

		this.setupClipID();

		var container = d3.select(this.containerDiv);
		
		this.pathwayContainer = container.append('div')
			.classed("compare-paths", true);
			
		this.svg = this.pathwayContainer.append('svg')
			.classed("pathway compare-paths", true)
			.attr('xmlns', "http://www.w3.org/2000/svg")
			.attr('version', "1.1");
		
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
					if (fd.experience.canWrite())
						_this.showDetailPanel(fd, i);
				});

		this.appendDetailContents();
			
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
			if (_this.leftPath == null)
				return;	/* The panel has been closed before this asynchronous action occured. */
				
			_this.showAllExperiences();
			
			crv.stopLoadingMessage(_this.loadingMessage);
			_this.loadingMessage.remove();
			
			$(_this).trigger("userSet.cr");
		}
		
		var p1 = crp.promise({path:  "#" + this.rightPath.getValueID() + '::reference(_user)::reference(Experience)', 
				   fields: ["parents"]});
		var p2 = crp.promise({path: "#" + _this.rightPath.getValueID() + '::reference(_user)::reference(Experience)::reference(Experiences)' + 
						'::reference(Session)::reference(Sessions)::reference(Offering)'});
		var p3 = crp.promise({path: "#" + _this.rightPath.getValueID() + '>"More Experience">Offering'});
		$.when(p1, p2, p3)
		.then(function(experiences, r2, r3)
			{
				_this.allExperiences = experiences.slice();
				$(experiences).each(function()
				{
					this.setDescription(this.getValue("Offering").getDescription());
				});
				
				return _this.rightPath.promiseCellsFromCache(["More Experience", "parents"]);
			})
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
	ComparePathsPanel.prototype = new SitePanel();
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
		backButton.append("span").text("Done");

		var addExperienceButton = this.navContainer.appendRightButton();
		
		this.navContainer.appendTitle("Compare Paths");
		
		this.bottomNavContainer = this.appendBottomNavContainer();
		this.bottomNavContainer.nav
			.classed("transparentBottom", true);

		if (this.pathtree)
			throw "pathtree already assigned to pathtree panel";
			
		this.pathtree = new ComparePath(this, panel2Div.node());
		this.pathtree.setUser(this.leftUser.getValue("More Experiences"),
							  this.rightUser.getValue("More Experiences"));
		
		$(this.pathtree).on("userSet.cr", function()
			{
				this.isMinHeight = true;
				_this.calculateHeight();
			});
	}
	
	return ComparePathsPanel;
})();

