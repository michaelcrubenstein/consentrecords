function hidePathway() {
	var container = d3.select(this);
	container.selectAll('svg').remove();
}
	
function setColorByService(service)
{
	var serviceInstance = crp.getInstance(service.getValueID());
	var serviceDomain = serviceInstance.getValue("Service Domain");
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

function showPathway(containerDiv) {
	var allExperiences = [];
	
	var panelDiv = $(containerDiv).parents(".site-panel")[0];
	var container = d3.select(containerDiv);

	var pathBackground = "white";
	
	container.selectAll('svg').remove();
	var svg = container.append('svg')
		.style("width", "100%")
		.style("height", "100%");
		
	var defs = svg.append('defs');
	
	var bg = svg.append('rect')
		.attr("x", 0).attr("y", 0)
		.attr("width", container.style("width"))
		.attr("height", container.style("height"))
		.attr("fill", pathBackground);
		
	var experienceGroup = svg.append('g')
			.attr("font-family", "San Francisco,Helvetica Neue,Arial,Helvetica,sans-serif")
			.attr("font-size", "1.3rem");
	var yearGroup = svg.append('g');
	var flagDown = false;
	var detailGroup = svg.append('g')
			.attr("font-family", "San Francisco,Helvetica Neue,Arial,Helvetica,sans-serif")
			.attr("font-size", "1.3rem")
		.attr("width", "100%")
		.attr("height", "100%");
	
	var dataLeftMargin = 40;
	var trunkWidth = 5;
	var trunkSpacing = 5;
	var trunkColumnWidth = trunkWidth + trunkSpacing;
	var textLeftMargin = 10;
	var textRightMargin = 10;
	var textBottomBorder = 3;
	var flagsLeftMargin = 14;
	var flagsRightMargin = 14;
	var flagSpacing = 5;
	var textWidth = 35;
	var flagColumnWidth = textLeftMargin + textWidth + textRightMargin + flagSpacing;
	var stemHeight = 3;
	var otherColor = "#bbbbbb";
	var textDetailLeftMargin = textLeftMargin;
	var textDetailRightMargin = textRightMargin;
	var detailTextSpacing = 2;
		
	var minDate, maxDate, timespan;
	var years = [];

	var successFunction1 = function(experiences)
	{
		allExperiences = experiences;
		$(experiences).each(function()
		{
			this.value.description = this.getValue("Offering").getDescription();
		});
		
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

							crp.pushCheckCells(userInstance, function() {
									var m = userInstance.getValue("More Experiences");
									if (m)
									{
										var path = "#" + m.getValueID() + '>"More Experience"';
										cr.getData({path: path, 
													done: successFunction2, 
													fail: asyncFailFunction});
									}
								},
								asyncFailFunction);
						},
					fail: asyncFailFunction});
	}

	var sortExperiences = function(a, b)
	{
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

	//This is the accessor function we talked about above
	var lineFunction = d3.svg.line()
		.x(function(d) { return d.x; })
		.y(function(d) { return d.y; })
		.interpolate("linear");

	var successFunction2 = function(experiences)
	{
		allExperiences = allExperiences.concat(experiences);
		if (allExperiences.length == 0)
			return;
			
		$(experiences).each(function()
		{
			this.calculateDescription();
		});
		
		allExperiences.sort(sortExperiences);
		
		var birthday = userInstance.getValue("Birthday");
		if (birthday && birthday.value)
			minDate = birthday.value;
		else
			minDate = new Date().toISOString();
			
		maxDate = "1900-01-01T00:00:00.000Z";
		$(allExperiences).each(function()
			{
				startDate = getStartDate(this);
				endDate = getEndDate(this);
				if (minDate > startDate)
					minDate = startDate;
				if (maxDate < endDate)
					maxDate = endDate;
			});
		
		timespan = new TimeSpan(Date.parse(maxDate) - Date.parse(minDate)).days;

		var minYear = parseInt(minDate.substr(0, 4));
		var maxYear = parseInt(maxDate.substr(0, 4));
		for (var y = minYear; y <= maxYear; ++y)
			years.push(y);
		
		function setColor(experience)
		{
			var _this = d3.select(this);
			
			var offering = experience.getValue("Offering");
			if (offering && offering.getValueID())
			{
				var experienceColor = otherColor;
				crp.pushCheckCells(offering, function()
				{
					var service = offering.getValue("Service");
					if (service)
						setColorByService.call(_this, service);
					else
						_this.attr("fill", otherColor)
							 .attr("stroke", otherColor);
				},
				asyncFailFunction);
			}
			else
			{
				var service = experience.getValue("Service");
				if (service)
					setColorByService.call(_this, service);
				else
					_this.attr("fill", otherColor)
						 .attr("stroke", otherColor);
			}
		}
		
		function pickedOrCreatedValue(i, pickedName, createdName)
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
		
		function hideDetail(done)
		{
			if (flagDown)
			{
				d3.select("#id_detailClipPath").selectAll('rect')
					.transition()
					.attr("height", 0)
					.each("end", function() {
						detailGroup.selectAll('text').remove();
						flagDown = false;
						if (done)
							done();
					});
				detailGroup.selectAll('rect')
					.transition()
					.attr("height", 0)
					.each("end", function() {
						d3.select(this).remove();
					});
			}
			else if (done)
				done();
		}
		
		function showDetail(experience, i)
		{
			var lines = [];
			
			var s;
			s = pickedOrCreatedValue(experience, "Organization", "User Entered Organization");
			if (s && lines.indexOf(s) < 0)
				lines.push(s);

			s = pickedOrCreatedValue(experience, "Site", "User Entered Site");
			if (s && lines.indexOf(s) < 0)
				lines.push(s);

			s = pickedOrCreatedValue(experience, "Offering", "User Entered Offering");
			if (s && lines.indexOf(s) < 0)
				lines.push(s);

			var bbox = this.getBBox();
			var g = $(this).parents('g')[0];
			var x = parseFloat(g.getAttribute("flagX")) + parseFloat(g.getAttribute("x"));
			var y = parseFloat(g.getAttribute("y")) - textBottomBorder;
			detailGroup.datum(d3.select(g).datum());
			hideDetail(function() 
				{
					var detailBackRect = detailGroup.append('rect')
						.attr("fill", pathBackground)
						.attr("width", "100%");
					var detailFrontRect = detailGroup.append('rect')
						.attr("fill-opacity", "0.3")
						.attr("stroke-opacity", "0.8")
						.attr("width", "100%");
					var detailText = detailGroup.append('text')
						.attr("width", "100")
						.attr("height", "1")
						.attr('clip-path', 'url(#id_detailClipPath)');
					detailText.selectAll('tspan').data(lines)
						.enter()
						.append('tspan')
						.text(function(d) { return d; })
						.attr("x", textDetailLeftMargin);
					var spanHeight = detailText.selectAll('tspan').node().getBBox().height + detailTextSpacing;
					detailText.selectAll('tspan').attr("dy", spanHeight);
					var textBox = detailText.node().getBBox();
					var containerWidth = parseInt(container.style("width"));
					if (x > containerWidth - flagsRightMargin - textBox.width - (textDetailLeftMargin * 2))
					{
						x = containerWidth - flagsRightMargin - textBox.width - (textDetailLeftMargin * 2);
					}
					detailGroup.attr("x", x)
							 .attr("y", y)
							 .attr("transform", "translate("+x + "," + y+")")
							 .attr("height", 0);
					detailBackRect.attr("width", textBox.width + (textDetailLeftMargin * 2))
								   .attr("height", 0)
								   .attr("x", textBox.x - textDetailLeftMargin)
								   .attr("y", textBox.y)
								   .transition()
								   .duration(700)
								   .attr("height", textBox.height + detailTextSpacing);
					detailFrontRect.attr("width", textBox.width + (textDetailLeftMargin * 2))
								   .attr("height", 0)
								   .attr("x", textBox.x - textDetailLeftMargin)
								   .attr("y", textBox.y)
								   .each(setColor)
								   .transition()
								   .duration(700)
								   .attr("height", textBox.height + detailTextSpacing);
					   
					/* Set the clip path of the text to grow so the text is revealed in parallel */
					d3.select("#id_detailClipPath").selectAll('rect')
						.attr('x', textBox.x)
						.attr('y', textBox.y)
						.attr('width', textBox.width)
						.attr('height', 0)
						.transition()
						.attr('height', textBox.height)
						.duration(700); 
					detailText				
						.transition()
						.duration(1000)
						.attr("height", textBox.height);
					flagDown = true;
				});
		}
		
		svg.on("click", function() { hideDetail(); });
		
		var g = experienceGroup.selectAll('g')
			.data(allExperiences)
			.enter()
			.append('g');
			
		var rect = g.append('path')
			.attr("fill-opacity", "0.3")
			.attr("stroke-opacity", "0.7")
			.on("click", function(d) 
				{ 
					d3.event.stopPropagation(); 
				})
			.on("click.cr", showDetail)
			.each(setColor);

		/* t is the set of all text nodes. */
		var t = g.append('text')
			.attr("x", 0)
			.attr("dy", "1.1")
			.attr('clip-path', 'url(#id_clipPath)')
			.text(function(d) { return d.getDescription(); })
			.on("click", function(d) 
				{ 
					d3.event.stopPropagation(); 
				})
			.on("click.cr", showDetail);
		
		/* bbox is used for various height calculations. */
		var bbox = t.node().getBBox();
		t.each(function(d)
			{
				var g = this.parentNode;
				g.setAttribute("flagHeight", bbox.height + textBottomBorder);
			});
		t.attr("y", function(experience)
			{
				return 0 - bbox.y;
			});
		
		var y = yearGroup
			.selectAll('text')
			.data(years)
			.enter()
			.append('text')
			.text(function(d) { return d; })
			.attr("font", "sans-serif")
			.attr("font-size", "10px")
			.attr("x", textLeftMargin);
			
		function layoutExperiences()
		{
			var containerHeight = parseInt(container.style("height"));
			var containerWidth = parseInt(container.style("width"));
			
			bg.attr("width", container.style("width"))
			  .attr("height", container.style("height"));

			var columns = [];
			var flagColumns = [];
			var g = experienceGroup.selectAll('g');
			
			function DateToY(d)
			{
				var daySpan = (new TimeSpan(d-Date.parse(minDate))).days;
				return (timespan - daySpan) * containerHeight / timespan;
			}
	
			function getExperienceY(experience, i)
			{
				return DateToY(Date.parse(getEndDate(experience)));
			}
		
			function getExperienceHeight(experience)
			{
				var startDate = getStartDate(experience);
				var endDate = getEndDate(experience);
				var days = (new TimeSpan(Date.parse(endDate)-Date.parse(startDate))).days;
				return days * containerHeight / timespan;
			}
		
			function getExperiencePath(experience, i)
			{
				var g = this.parentNode;
				var flagX = parseFloat(g.getAttribute("flagX"));
				var h = getExperienceHeight(experience, i);
				var newH = parseFloat(g.getAttribute("flagHeight"));
				var x1 = 0;
				var x2 = x1 + flagX + textWidth + textLeftMargin + textRightMargin;
				var x3 = x1 + flagX;
				var x4 = x1 + trunkWidth;
				var y1 = 0;
				var y2 = y1 + newH;
				var y3;
				if (h < stemHeight)
					y3 = y1 + h;
				else
					y3 = y1 + stemHeight;
				var y4 = y1 + h;
				return lineFunction([{x: x1, y: y1}, 
									 {x: x2, y: y1}, 
									 {x: x2, y: y2}, 
									 {x: x3, y: y2}, 
									 {x: x3, y: y3}, 
									 {x: x4, y: y3}, 
									 {x: x4, y: y4}, 
									 {x: x1, y: y4}, 
									 {x: x1, y: y1}]);
			}
	
			g.attr("y", getExperienceY);	
			function addToBestColumn(g, maxHeight, columns)
			{
				var j;
				for (j = 0; j < columns.length; ++j)
				{
					// If this item's height + y is greater than the last item,
					// then add this to the column.
					var column = columns[j];
					var lastTop = parseFloat(column[column.length - 1].getAttribute("y"));
					if (lastTop > maxHeight)
					{
						column.push(g);
						break;
					}
				}
				if (j == columns.length)
				{
					columns.push([g]);
				}
			}
			function addToFlagColumns(d)
			{
				var thisTop = parseFloat(this.getAttribute("y"));
				var flagHeight = parseFloat(this.getAttribute("flagHeight"));
				var maxHeight = thisTop + flagHeight;
				var j;
				for (j = 0; j < flagColumns.length; ++j)
				{
					// If this item's height + y is greater than the last item,
					// then add this to the column.
					var column = flagColumns[j];
					var lastTop = parseFloat(column[column.length - 1].getAttribute("y"));
					if (lastTop > maxHeight)
					{
						column.push(this);
						break;
					}
					else
					{
						var i;
						var isInserted = false;
						for (i = column.length - 1; i > 0; ++i)
						{
							var aboveFlag = column[i];
							var belowFlag = column[i-1];
							var aboveTop = parseFloat(aboveFlag.getAttribute("y"));
							var belowTop = parseFloat(belowFlag.getAttribute("y"));
							if (thisTop > aboveTop + flagHeight &&
								thisTop < belowTop)
							{
								for (var k = column.length; k > i; --k)
									column[k] = column[k-1];
								column[i] = this;
								isInserted = true;
								break;
							}
							else if (thisTop < aboveTop + flagHeight)
								break;
						}
						if (isInserted)
							break;
					}
				}
				if (j == flagColumns.length)
				{
					flagColumns.push([this]);
				}
			};
			
			g.each(function(e, i)
				{
					var thisTop = parseFloat(this.getAttribute("y"));
					var maxHeight = thisTop + getExperienceHeight(e, i);
					addToBestColumn(this, maxHeight, columns);
				})
				.each(addToFlagColumns);
				
			var flagsLeft = dataLeftMargin + (trunkColumnWidth * columns.length) + flagsLeftMargin;
			
			/* Compute the column width for each column of flags + spacing to its right. 
				Add flagSpacing before dividing so that the rightmost column doesn't need spacing to its right.
			 */
			flagColumnWidth = (containerWidth - flagsLeft - flagsRightMargin + flagSpacing) / flagColumns.length;
			textWidth = flagColumnWidth - textLeftMargin - textRightMargin - flagSpacing;
			
			for (var j = 0; j < columns.length; ++j)
			{
				var x = dataLeftMargin + (trunkColumnWidth * j);
				var column = columns[j];
				for (var i = 0; i < column.length; ++i)
				{
					column[i].setAttribute("x", x);
				}
			}
			
			g.attr("transform", 
				function(d)
				{
					return "translate(" + this.getAttribute("x") + "," + this.getAttribute("y") + ")";
				});
				
			if (flagColumns.length > 0)
			{
				defs.selectAll('clipPath').remove();
				/* Add a clipPath for the text box size. */
				defs.append('clipPath')
					.attr('id', 'id_clipPath')
					.append('rect')
					.attr('x', 0)
					.attr('y', 0)
					.attr('height', bbox.height)
					.attr('width', textWidth);
				defs.append('clipPath')
					.attr('id', 'id_detailClipPath')
					.append('rect');

				/* Calculate the x offset of the flag for each group */
				for (var j = 0; j < flagColumns.length; ++j)
				{
					var flagLeft = flagsLeft + (flagColumnWidth * j);
					var column = flagColumns[j];
					for (var i = 0; i < column.length; ++i)
					{
						var g = column[i];
						var x = parseFloat(g.getAttribute("x"));
						var flagX = flagLeft - x;
						g.setAttribute("flagX", flagX);
					}
				}
				
				/* Transform each text node relative to its containing group. */
				t.attr("transform",
					function(d)
					{
						var g = this.parentNode;
						var flagX = parseFloat(g.getAttribute("flagX"));
						return "translate(" + (flagX + textLeftMargin).toString() + ", 0)";
					});
					
				/* Calculate the path for each containing group. */
				rect.attr("d", getExperiencePath);
			}
		
			y.attr("y", function(d) { 
					return DateToY(new Date(d, 0, 0));
				});
			
			/* Hide the detail so that if detail is visible before a resize, it isn't left behind. */	
			hideDetail();
		}
		$(window).on("resize", layoutExperiences);
		$(panelDiv).on("hiding.cr", function()
		{
			$(window).off("resize", layoutExperiences);
		});
		layoutExperiences();
	}
	
	var path = "#" + userInstance.getValueID() + '::reference(Experience)';
	cr.getData({path: path, 
			   fields: ["parents"], 
			   done: successFunction1, 
			   fail: asyncFailFunction});
}

