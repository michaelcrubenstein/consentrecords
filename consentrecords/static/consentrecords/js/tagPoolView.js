var Service = (function() {
	Service.prototype.service = null;
	
	Service.prototype.textDetailLeftMargin = 4.5; /* textLeftMargin; */
	Service.prototype.flagLineOneDY = '1.4em';
	Service.prototype.flagHeightEM = 2.333;
	Service.prototype.emToPX = 11;
	
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
			/* services may be null if the service has been deleted */
			var s = services && services.data.find(function(s)
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
	
	Service.prototype.flagColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].flagColor;
	}
	
	Service.prototype.poleColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].poleColor;
	}
	
	Service.prototype.getDescription = function()
	{
		return this.service.getDescription();
	}
	
	/* Returns True if the service contains the specified text. */
	Service.prototype.contains = function(s, prefix)
	{
		if (this.service)
		{
			var re = new RegExp(prefix + s.replace(/([\.\\\/\^\+])/, "\\$1"), "i");
			if (re.test(this.service.getDescription()))
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
	
	Service.prototype.setFlagText = function(node)
	{
		var g = d3.select(node);
		g.selectAll('text>tspan:nth-child(1)')
			.text(this.getDescription())
	}

	function Service(dataObject) {
		this.service = dataObject;
	}
	
	return Service;
})();

var TagPoolView = (function () {
	TagPoolView.prototype.container = null;
	TagPoolView.prototype.div = null;
	TagPoolView.prototype.svg = null;
	
	TagPoolView.prototype.flagHSpacing = 15;
	TagPoolView.prototype.flagVSpacing = 1.0;
	TagPoolView.prototype.flagHeightEM = 2.333;
	TagPoolView.prototype.emToPX = 11;

	TagPoolView.prototype.node = function()
	{
		return this.div.node();
	}
	
	TagPoolView.prototype.flags = function()
	{
		return this.svg.selectAll('g.flag');
	}
	
	/* Sets the x, y and y2 coordinates of each flag. */
	TagPoolView.prototype._setFlagCoordinates = function(g, maxX)
	{
		var _this = this;

		var deltaY = this.flagHeightEM + this.flagVSpacing;
		var startX = 0;
		var nextY = 0;
		var nextX = 0;
		g.each(function(fd, i)
			{
				fd.x = nextX;
				if (fd.visible === undefined || fd.visible)
				{
					var thisSpacing = this.getElementsByTagName('rect')[0].getBBox().width;
					nextX += thisSpacing;
					if (nextX >= maxX && fd.x > startX)
					{
						nextY += deltaY;
						nextX = startX;
						fd.x = nextX;
						nextX += thisSpacing;
					}
					nextX += _this.flagHSpacing;
				}
				
				fd.y = nextY;
				fd.y2 = fd.y + fd.flagHeightEM;
			});
		
		return (nextY + this.flagHeightEM) * this.emToPX;
	}
	
	/* Lay out all of the contents within the svg object. */
	TagPoolView.prototype.layoutFlags = function(maxX, duration)
	{
		maxX = maxX !== undefined ? maxX : $(this.svg.node()).width();
		duration = duration !== undefined ? duration : 700;
		
		var g = this.flags();
		
		var height = this._setFlagCoordinates(g, maxX);
		
		/* Set the height of the svg to match the total height of all of the flags. */
		this.svg
 			.interrupt().transition().duration(duration)
			.attr('height', height)
			
		/* If it wasn't visible, transform instantly and animate its opacity to 1. */
		/* If it was visible and it is still visible, animate its position. */
		/* If it was visible and is not visible, animate opacity to 0 */
		/* Calculate all of the groups before moving any of them so that subsequent sets are properly calculated. */
		
		var hiddenG = g.filter(function(fd) { return parseFloat($(this).css('opacity')) < 1; });
		var movingG = g.filter(function(fd) { return parseInt($(this).css('opacity')) != 0 && 
									   (fd.visible === undefined || fd.visible); });
		var hidingG = g.filter(function(fd) { return parseInt($(this).css('opacity')) != 0 && 
									   !(fd.visible === undefined || fd.visible); });
		hiddenG
			.interrupt().attr('transform', function(fd) { return "translate({0},{1})".format(fd.x, fd.y * fd.emToPX); })
			.transition().duration(duration)
			.style('opacity', function(fd) { return (fd.visible === undefined || fd.visible) ? 1.0 : 0.0; });
			
		movingG
			.interrupt().transition().duration(duration)
			.attr('transform', function(fd) { return "translate({0},{1})".format(fd.x, fd.y * fd.emToPX); })
			.attr('opacity', 1.0);
		 
		hidingG
			.interrupt().transition().duration(duration)
			.style('opacity', 0.0)
			.each('end', function()
				{
					d3.select(this).attr('transform',
						function(fd) { return "translate({0},{1})".format(fd.x, fd.y * fd.emToPX); });
				});
	}
	
	TagPoolView.prototype.setFlagVisibles = function()
	{
		var g = this.flags();
		g.each(function(fs) { fs.visible = undefined; });
	}
	
	TagPoolView.prototype.filterFlags = function(filterText)
	{
		this.setFlagVisibles();
			
		var inputTexts = filterText.toLocaleUpperCase().split(' ');
		var prefix;
		if (inputTexts.length == 1 &&
			inputTexts[0].length == 1)
			prefix = "^";
		else
			prefix = "\\b";
			
		var inputRegExps = inputTexts.map(function(s)
			{
				return new RegExp(prefix + s.replace(/([\.\\\/\^\+])/, "\\$1"), "i");
			});
			
		if (inputTexts.length > 0)
		{
			this.flags().each(function(fs)
				{
					if (!fs.contains(filterText.toLocaleUpperCase(), prefix) &&
						!inputRegExps.reduce(function(a, b)
							{
								return a && b.test(fs.getDescription());
							}, true))
						fs.visible = false;
				});
		}
	}
	
	TagPoolView.prototype.appendFlag = function(g)
	{
		g.classed('flag', true)
		 .style('opacity', '0');
		
		g.append('line').classed('flag-pole', true)
			.attr('x1', 1.5)
			.attr('x2', 1.5)
			.attr('stroke-opacity', '1.0')
			.attr('fill', 'white')
			.attr('stroke', 'white');
		g.append('line').classed('flag-pole', true)
			.attr('x1', 1.5)
			.attr('x2', 1.5)
			.each(function(d)
				{
					d.colorElement(this);
				});
		g.append('rect').classed('opaque', true)
			.attr('x', 3);
		g.append('rect').classed('bg', true)
			.attr('x', 3)
			.each(function(d)
				{
					d.colorElement(this);
				});
		var text = g.append('text').classed('flag-label', true)
			.attr('x', Service.prototype.textDetailLeftMargin);
		text.append('tspan')
			.attr('dy', '1.1em')
			.attr('fill', function(d) {
				return d.fontColor();
			});
		
		g.each(function(d) { d.setFlagText(this); });

		g.selectAll('rect')
			.attr('height', "{0}em".format(Service.prototype.flagHeightEM))
			.attr('width', function(fd)
				{
					return $(this.parentNode).children('text')[0].getBBox().width + 5;
				});	
		
		g.selectAll('line.flag-pole')
			.attr('y2', function(fd) { return "{0}em".format(fd.flagHeightEM); });

	}
	
	/* Remove all of the existing flags displayed and add all of the specified flags
		to the flag pool.
	 */
	TagPoolView.prototype.appendFlags = function(data)
	{
		var _this = this;
		this.flags().remove();
		
		var g = this.svg.selectAll('g')
			.data(data)
			.enter()
			.append('g');
			
		this.appendFlag(g);
		return g;
	}
	
	TagPoolView.prototype.hasNamedService = function(compareText)
	{
		if (compareText.length === 0)
			return true;
		var data = this.flags().data();
		var sd = data.find(function(sd) {
				var d = sd.service;
				return d.getCell && d.getCell(cr.fieldNames.name).data.find(
					function(d) { return d.text.toLocaleLowerCase() === compareText;}) ||
					(d.getDescription && d.getDescription().toLocaleLowerCase() === compareText);
			});
		return sd && sd.service;
	}
	
	function TagPoolView(container, divClass)
	{
		this.container = container;
		if (container)
		{
			this.div = container.append('div')
				.classed(divClass, true);
				
			this.svg = this.div.append('svg')
				.classed('flags', true);
		}
	}
	
	return TagPoolView;
})();

