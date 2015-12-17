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
	
	var panelDiv = d3.select($(containerDiv).parents(".site-panel")[0]);
	var container = d3.select(containerDiv);

	var pathBackground = "white";
	
	container.selectAll('svg').remove();
	var svg = container.append('svg')
		.style("width", "100%")
		.style("height", "100%");
		
	var defs = svg.append('defs');
	
	/* bg is a rectangle that fills the background with the background color. */
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
	
	var dataTopMargin = 5;
	var dataBottomMargin = 5;
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
									if (m && m.getValueID())
									{
										var path = "#" + m.getValueID() + '>"More Experience"';
										cr.getData({path: path, 
													done: successFunction2, 
													fail: asyncFailFunction});
									}
									else
										successFunction2([]);	/* There are none. */
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
				var dataHeight = containerHeight - dataTopMargin - dataBottomMargin;
				return dataTopMargin + (timespan - daySpan) * dataHeight / timespan;
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
				var dataHeight = containerHeight - dataTopMargin - dataBottomMargin;
				return days * dataHeight / timespan;
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
		var bbox;
		if (t.node())
			bbox = t.node().getBBox();
		else
			bbox = {height: 20, y: -18};

		t.each(function(d)
			{
				var g = this.parentNode;
				g.setAttribute("flagHeight", bbox.height + textBottomBorder);
			});
		t.attr("y", function(experience)
			{
				return 0 - bbox.y;
			});
		
		/* y is the set of text objects for each year. */
		var y = yearGroup
			.selectAll('text')
			.data(years)
			.enter()
			.append('text')
			.text(function(d) { return d; })
			.attr("font", "sans-serif")
			.attr("font-size", "10px")
			.attr("x", textLeftMargin);
			
		panelDiv.selectAll(".add-button")
			.on("click", function(d) {
				if (prepareClick())
				{
					showClickFeedback(this);
			
					showAddExperiencePanel(null, panelDiv);
				}
				d3.event.preventDefault();
			});
			
		$(window).on("resize", layoutExperiences);
		panelDiv.on("hiding.cr", function()
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

function appendDots(panel2Div, panelDiv, numDots)
{
	var dotIndexes = [];
	for (var i = 0; i < numDots; i++)
		dotIndexes.push(i);
	
	var dotsDiv = panel2Div.append('div')
		.classed('dots', true);
	var ol = dotsDiv.append('div').append('ol');

	var li = ol.selectAll('li')
		.data(dotIndexes)
		.enter()
		.append('li')
		.classed("active", function(d, i) { return i == 0; });
		
	dotsDiv.panels = panel2Div.selectAll('panel')
		.data(dotIndexes)
		.enter()
		.append('panel');

	dotsDiv.count = numDots;
	dotsDiv.value = 0;
	dotsDiv.setValue = function(newValue) {
		var oldValue = dotsDiv.value;
		
		var p = dotsDiv.nthPanel(oldValue);
		if (p.onDoneClicked)
			p.onDoneClicked();
			
		dotsDiv.value = newValue;
		li.classed("active", function(d, i) { return i == newValue; });
		
		if (newValue > 0)
			dotsDiv.backButton.selectAll("span").text("Back");
		else
			dotsDiv.backButton.selectAll("span").text("Cancel");
		
		if (newValue < numDots - 1)
			dotsDiv.doneButton.selectAll("span").text("Next");
		else
			dotsDiv.doneButton.selectAll("span").text("Add");
			
		p = dotsDiv.nthPanel(newValue);
		if (p.onReveal)
			p.onReveal.call(p, dotsDiv);
		
		var containerWidth = $(dotsDiv.node()).parent().width();
		
		if (oldValue < newValue)
		{
			while (oldValue < newValue)
			{
				var p = $(dotsDiv.nthPanel(oldValue));
				p.animate({left: -containerWidth}, 700, "swing");
				++oldValue;
			}
			$(dotsDiv.nthPanel(newValue))
				.animate({left: 0}, 700, "swing");
		}
		else if (oldValue > newValue)
		{
			while (oldValue > newValue)
			{
				var p = $(dotsDiv.nthPanel(oldValue));
				p.animate({left: containerWidth}, 700, "swing");
				--oldValue;
			}
			$(dotsDiv.nthPanel(newValue))
				.animate({left: 0}, 700, "swing");
		}
	}
	
	dotsDiv.nthPanel = function(n) {
		return this.panels[0][n];
	}
	dotsDiv.showDots = function() {
		$(this.node()).animate({bottom: "30px"}, 400, "swing",
						function() {
						});

	}
	
	dotsDiv.getServiceByName = function(name)
	{
		for (i = 0; i < services.length; ++i)
		{
			if (services[i].getDescription() == nmae)
				return services[i];
		}
		return null;
	}
	
	dotsDiv.services = [];
	
	function layoutPanels()
	{
		var containerWidth = $(dotsDiv.node()).parent().width();
		dotsDiv.panels.each(function(d, i)
		{
			if (i < dotsDiv.value)
				$(this).offset({left: -containerWidth});
			else if (i == dotsDiv.value)
				$(this).offset({left: 0});
			else
				$(this).offset({left: containerWidth});
		});
	}
	
	$(window).on("resize", layoutPanels);
	panelDiv.on("hiding.cr", function()
	{
		$(window).off("resize", layoutPanels);
	});
	
	return dotsDiv;
}

function addInput(p, placeholder)
{
	var searchBar = p.append("div").classed("searchbar always-visible table-row", true);
	
	var searchInputContainer = searchBar.append("div")
		.classed("search-input-container", true);
		
	return searchInputContainer
		.append("input")
		.classed("search-input", true)
		.attr("placeholder", placeholder);
}

var ReportedObject = function () {
	ReportedObject.prototype = new cr.EventHandler();
	ReportedObject.prototype.name = null;
	ReportedObject.prototype.value = null;
	
	function ReportedObject(args) {
		cr.EventHandler.call(this);
		
		if (!("name" in args)) args.name = null;
		if (!("value" in args)) args.value = null;
		
		this.name = args.name;
		this.value = args.value;
    };
    
    ReportedObject.prototype.getDescription = function()
    {
    	if (this.value) return this.value.getDescription();
    	return this.name;
    }
    
    return ReportedObject;
}();

function setupPanel0(p0, dots)
{
	p0.append('div')
		.classed('table-row', true)
		.append('p').text("What type of experience do you want to add to your pathway?");
	p0.append('div')
		.classed('table-row', true)
		.append('p').text("Choose one of the types, below, or type the name you can for the experience. If there is more than one, pick one, and then you can add others.");
		
	var searchInput = addInput(p0, "Experience");
	
	var lastText = "";	
	$(searchInput.node()).on("keyup input paste", function(e) {
		if (lastText != this.value)
		{
			lastText = this.value;
			if (lastText.length == 0)
			{
				/* Show all of the items. */
				p0.selectAll("li")
					.style("display", "block");
			}
			else
			{
				/* Show the items whose description is this.value */
				p0.selectAll("li")
					.style("display", function(d)
						{
							if (d.getDescription().toLocaleLowerCase().indexOf(lastText.toLocaleLowerCase()) >= 0)
								return "block";
							else
								return "none";
						});
			}
		}
	});

	function done(rootObjects)
	{
		function sortByDescription(a, b)
		{
			return a.getDescription().localeCompare(b.getDescription());
		}

		function buttonClicked(d)
		{
			if (dots.services.length > 0)
			{
				/* Remove this item if it is farther down in the list. */
				for (var i = 1; i < dots.services.length; ++i)
					if (dots.services[i].value == d)
					{
						dots.services.splice(i, 1);
						break;
					}
				dots.services[0] = new ReportedObject({value: d});
			}
			else
				dots.services.push(new ReportedObject({value: d}));
			
			searchInput.node().value = d.getDescription();
			$(searchInput.node()).trigger("input");
			dots.setValue(dots.value + 1);
		}
		
		rootObjects.sort(sortByDescription);
		p0.datum(rootObjects);
		var w = p0.append('div').classed('body', true)
				  .append('div')
				  .append('div');
		appendButtons(w, rootObjects, buttonClicked);
	}
	
	p0.onDoneClicked = function()
	{
		var newName = searchInput.node().value;
		
		/* Identify if the new name matches the name of an existing service. */
		var newValue = null;
		var rootObjects = p0.datum();
		for (i = 0; i < rootObjects.length; i++)
		{
			if (rootObjects[i].getDescription() == newName)
			{
				newValue = rootObjects[i];
				break;
			}
		}
		
		if (dots.services.length > 0)
		{
			for (var i = 1; i < dots.services.length; ++i)
			{
				if (newName == dots.services[i].getDescription())
				{
					dots.services.splice(i, 1);
					break;
				}
			}
			dots.services[0] = new ReportedObject({name: newName, value: newValue});
		}
		else
			dots.services.push(new ReportedObject({name: newName, value: newValue}));
	}
	crp.getData({path: "Service", done: done, fail: asyncFailFunction});
}

function getObjectByDescription(a, description)
{
	for (var i = 0; i < a.length; ++i)
	{
		if (a[i].getDescription() == description)
			return a[i];
	}
	return null;
}

function showPickServicePanel(containerPanel, rootObjects, oldReportedObject, dots, success)
{
	var header = "Add Value";
		
	var panelDiv = createPanel(containerPanel, rootObjects, header)
					.classed("list-panel", true);

	var navContainer = panelDiv.appendNavContainer();

	var backButton = navContainer.appendLeftButton()
		.on("click", function()
		{
			if (prepareClick())
			{
				hidePanelRight($(this).parents(".site-panel")[0]);
			}
			d3.event.preventDefault();
		});
	backButton.append("span").text("Cancel");
	
	var addButton = navContainer.appendRightButton()
		.on("click", function()
		{
			if (prepareClick())
			{
				if (!dots.getServiceByName(searchInputNode.value))
				{
					var newValue = getObjectByDescription(rootObjects, searchInputNode.value);
					success(new ReportedObject({name: searchInputNode.value, value: newValue}));
				}
				
				hidePanelRight($(this).parents(".site-panel")[0]);
			}
			d3.event.preventDefault();
		});
	
	var textChanged = function(){
		var val = this.value.toLocaleLowerCase();
		if (val.length == 0)
		{
			/* Show all of the items. */
			panel2Div.selectAll("li")
				.style("display", "block");
		}
		else
		{
			/* Show the items whose description is this.value */
			panel2Div.selectAll("li")
				.style("display", function(d)
					{
						if (d.getDescription().toLocaleLowerCase().indexOf(val) >= 0)
							return "block";
						else
							return "none";
					});
		}
	}

	var searchInputNode = panelDiv.appendSearchBar(textChanged);

	var panel2Div = panelDiv.appendScrollArea();
	
	panel2Div.appendAlertContainer();
	
	function buttonClicked(d) {
		if (prepareClick())
		{
			success(new ReportedObject({value: d}));
			hidePanelRight(panelDiv.node());
		}
		d3.event.preventDefault();
	}
	
	var buttons = appendButtons(panel2Div, rootObjects, buttonClicked);
	
	if (oldReportedObject)
	{
		searchInputNode.value = oldReportedObject.getDescription();
		$(searchInputNode).trigger("input");
	}
	
	showPanelLeft(panelDiv.node());
}

function setupPanel1(dots)
{
	var panelDiv = d3.select($(this).parents(".site-panel")[0]);
	var p1 = d3.select(this);
	p1.append('div')
		.classed('table-row', true)
		.append('p').text("Some experiences provide more than one kind of value, such as being the captain of a soccer team or getting a summer job working with computers. If this opportunity has more than one kind of value, choose other values here to add them to this experience.");

	var obj = p1.append('div')
		.classed('body', true)
		.append('div')
		.append('div');
	
	var sectionObj = obj.classed("cell-div cell-edit-div", true);
	
	var labelDiv = sectionObj.append("div").classed("cell-label", true)
		.text("Values");
	var itemsDiv = sectionObj.append("div").classed("items-div", true);

	sectionObj.classed("multiple-values-cell", true);
	labelDiv.classed("top-label", true);
	itemsDiv.classed("border-above", true);

	// $(itemsDiv.node()).on("valueAdded.cr", _getOnValueAddedFunction(panelDiv, cell, null, true, true, showEditObjectPanel, revealPanelLeft));

	var clickFunction;
	clickFunction = function(d, i) {
			var _this = this;
			if (prepareClick())
			{
				crp.getData({path: "Service", 
				done: function(rootObjects)
				{
					var success = function(newReportedObject)
					{
						var divs = d3.select($(_this).parents("li")[0]);
						divs.datum(newReportedObject);
						var s = divs.selectAll(".description-text").text(newReportedObject.getDescription());
						dots.services[i] = newReportedObject;
					}
					showPickServicePanel(panelDiv, rootObjects, d, dots, success);
				}, 
				fail: syncFailFunction});
			}
		};
		
	var divs = appendItems(itemsDiv, dots.services);
	
	function _confirmDeleteClick(d)
	{
		var a = dots.services;
		a.splice($.inArray(d, a), 1);
		var item = $(this).parents("li")[0];
		$(item).animate({height: "0px"}, 200, 'swing', function() { $(item).remove(); });
	}
	
	appendConfirmDeleteControls(divs)
		.on('click', _confirmDeleteClick);
		
	var buttons = appendRowButtons(divs, null);

	buttons.on("click", clickFunction);
	
	appendDeleteControls(buttons);

	appendRightChevrons(buttons);
		
	appendButtonDescriptions(buttons, null);
	
	/* Add one more button for the add Button item. */
	var buttonDiv = p1.append("div").classed("table-row", true)
		.append("button").classed("btn row-button multi-row-content site-active-text border-above border-below", true)
		.on("click", function(cell) {
			if (prepareClick())
			{
				crp.getData({path: "Service", 
				done: function(rootObjects)
				{
					var success = function(newReportedObject)
					{
						dots.services.push(newReportedObject);
						var divs = appendItem(itemsDiv, newReportedObject);
						appendConfirmDeleteControls(divs)
							.on('click', _confirmDeleteClick);
						var buttons = appendRowButtons(divs, null);
						buttons.on("click", clickFunction);
						appendDeleteControls(buttons);
						appendRightChevrons(buttons);
						appendButtonDescriptions(buttons, null);
					}
					showPickServicePanel(panelDiv, rootObjects, null, dots, success);
				}, 
				fail: syncFailFunction});
			}
			d3.event.preventDefault();
		})
		.append("div").classed("pull-left", true);
	buttonDiv.append("span").classed("glyphicon glyphicon-plus", true);
	buttonDiv.append("span").text(" add experience");
	
	this.onReveal = null;
}

function setupPanel2(dots)
{
	var p = d3.select(this);
	p.append('div')
		.classed('table-row', true)
		.append('p').text("What organization that provided this experience?");

	var searchInput = addInput(p, "Organization");

	var w = p.append('div').classed('body', true)
			  .append('div')
			  .append('div');

	function textChanged()
	{
		var val = this.value.toLocaleLowerCase().trim();
		var inputBox = this;
		
		if (val.length == 0)
		{
			w.selectAll("ol").remove();
			searchText = val;
		}
		else
		{
			var startVal = val;
						
			var selectAllSuccess = function(orgs)
			{
				function appendDescriptions(buttons)
				{
					var leftText = buttons.append('div').classed("left-expanding-div", true);
			
					leftText.append('div')
						.classed("sub-text", function(d) { return d.getValue("Organization"); })
						.text(function(d) {
							if (d.getValue("Organization"))
								return d.getValue("Organization").getDescription();
							else
								return d.getDescription();
						});
					leftText.append('div')
						.classed("sub-text", true)
						.text(function(d) { 
							if (d.getValue("Organization"))
								return d.getDescription();
							else
								return "";
						});
				}
						
				if (inputBox.value.toLocaleLowerCase().trim() == startVal)
				{
					w.selectAll("ol").remove();
					function buttonClicked(d)
					{
						if (d.getValue("Organization"))
						{
							dots.organization = d.getValue("Organization");
							dots.site = d;
							dots.organizationName = d.getValue("Organization").getDescription();
							dots.siteName = d.getDescription();
						}
						else
						{
							dots.organization = d;
							dots.site = null;
							dots.organizationName = d.getDescription();
							dots.siteName = null;
						}
			
						searchInput.node().value = d.getDescription();
						$(searchInput.node()).trigger("input");
						if (dots.site)
							dots.setValue(dots.value + 2);
						else
							dots.setValue(dots.value + 1);
						d3.event.preventDefault();
					}
		
					appendButtons(w, orgs, buttonClicked, appendDescriptions);
					searchText = startVal;
				}
			}
			
			if (val.length < 3)
				cr.getData({path: '_translation[_text^="'+val+'"]::reference(Organization,Site)', fields: ["parents"], limit: 50, done: selectAllSuccess, fail: asyncFailFunction});
			else
				cr.getData({path: '_translation[_text*="'+val+'"]::reference(Organization,Site)', fields: ["parents"], limit: 50, done: selectAllSuccess, fail: asyncFailFunction} );
		}
	}
	
	var lastText = "";	
	$(searchInput.node()).on("keyup input paste", function(e) {
// 		searchCancelButton
// 			.classed("site-disabled-text", this.value.length == 0)
// 			.classed("site-active-text", this.value.length > 0);
		if (lastText != this.value)
		{
			lastText = this.value;
			textChanged.call(this);
		}
	});

	this.onDoneClicked = function()
	{
		var textValue = searchInput.node().value;
		if ((dots.site && textValue != dots.site.getDescription() && textValue != dots.organization.getDescription()) ||
		    (!dots.site && dots.organization && textValue != dots.organization.getDescription()) ||
		    (!dots.site && !dots.organization))
		{
			dots.organization = null;
			dots.site = null;
			dots.organizationName = searchInput.node().value;
			dots.siteName = null;
		}
	}
	this.onReveal = null;
}

function setupPanel3(dots)
{
	var p = d3.select(this);
	var header = p.append('div')
		.classed('table-row', true)
		.append('p');
	
	var searchInput = addInput(p, "Site");

	var w = p.append('div').classed('body', true)
			  .append('div')
			  .append('div');
			  
	next = function(dots)
	{
		header.text("Where did " + dots.organizationName + " provide this experience?")
		w.selectAll('ol').remove();
		if (dots.organization)
		{
			function done(rootObjects)
			{
				function sortByDescription(a, b)
				{
					return a.getDescription().localeCompare(b.getDescription());
				}

				function buttonClicked(d)
				{
					dots.site = d;
					dots.siteName = d.getDescription();
			
					searchInput.node().value = d.getDescription();
					$(searchInput.node()).trigger("input");
					dots.setValue(dots.value + 1);
				}
		
				rootObjects.sort(sortByDescription);
				appendButtons(w, rootObjects, buttonClicked);
			}
	
			cr.getData({path: "#"+dots.organization.getValueID() + ">Sites>Site", done: done, fail: asyncFailFunction});
		}
	};

	this.onDoneClicked = function()
	{
		if ((dots.site && searchInput.node().value != dots.site.getDescription()) ||
		    !dots.site)
		{
			dots.site = null;
			dots.siteName = searchInput.node().value;
		}
	}
	
	next.call(this, dots);
	this.onReveal = next;
}

function setupPanel4(dots)
{
	var p = d3.select(this);
	p.append('div')
		.classed('table-row', true)
		.append('p').text("What was the name of this experience?");

	var searchInput = addInput(p, "Name");

	var w = p.append('div').classed('body', true)
			  .append('div')
			  .append('div');
			  
	next = function(dots)
	{
		w.selectAll('ol').remove();
		w.selectAll('p').remove();
		if (dots.site)
		{
			function done(rootObjects)
			{
				function sortByDescription(a, b)
				{
					return a.getDescription().localeCompare(b.getDescription());
				}

				function buttonClicked(d)
				{
					dots.offering = d;
					dots.offeringName = d.getDescription();
			
					searchInput.node().value = d.getDescription();
					$(searchInput.node()).trigger("input");
					dots.setValue(dots.value + 1);
				}
		
				rootObjects.sort(sortByDescription);
				appendButtons(w, rootObjects, buttonClicked);
			}
	
			cr.getData({path: "#"+dots.site.getValueID() + ">Offerings>Offering", done: done, fail: asyncFailFunction});
		}
		else
		{
			w.append('p').classed('help-text', true)
				.text("For example, the title of a job, the name of a class or musical instrument or the league of a sports program.");
		}
	};

	this.onDoneClicked = function()
	{
		if ((dots.offering && searchInput.node().value != dots.offering.getDescription()) ||
		    !dots.offering)
		{
			dots.offering = null;
			dots.offeringName = searchInput.node().value;
		}
	}
	
	next.call(this, dots);
	this.onReveal = next;
}

var DateInput = (function () {
	DateInput.prototype.year = undefined;
	DateInput.prototype.month = undefined;
	DateInput.prototype.day = undefined;
	
    function DateInput() {
    	this.year = undefined;
    	this.month = undefined;
    	this.day = undefined;
    };
    
	DateInput.prototype.append = function(node, dots)
	{
		var _this = this;
		var p = d3.select(node);
		
		var row = p.append('div')
			   .classed('date-row', true);
		var yearInput = row.append('select').style('display', 'inline');
		var monthInput = row.append('select').style('display', 'inline').style('visibility', 'hidden')
			.classed('month-select', true);
		var dateInput = row.append('select').style('display', 'inline').style('visibility', 'hidden');
	
		var yearNode = yearInput.node();
		var monthNode = monthInput.node();
		var dateNode = dateInput.node();

		var minYear, maxYear;
		maxYear = (new Date()).getFullYear();
	
		var birthday = userInstance.getValue("Birthday");
		if (birthday && birthday.value)
			minYear = parseInt(birthday.value.substr(0, 4));
		else
			minYear = maxYear-100;
		
		var years = ['year'];
		for (var i = maxYear; i >= minYear; --i)
			years.push(i);
		yearInput.selectAll('option')
			.data(years)
			.enter()
			.append('option')
			.text(function(d) { return d; });
					
		var months = ['month'].concat(Date.CultureInfo.monthNames)
		monthInput.selectAll('option')
			.data(months)
			.enter()
			.append('option')
			.text(function(d) { return d; });
	
		var dates = ['date (optional)'];
		dateInput.selectAll('option')
			.data(dates)
			.enter()
			.append('option')
			.text(function(d) { return d; });
	
		$(yearNode).change(function()
			{
				yearInput.selectAll(":first-child").attr('disabled', true);
				monthInput.style('visibility', 'visible');
				if (yearNode.selectedIndex == 0)
					_this.year = undefined;
				else
					_this.year = parseInt(yearNode.options[yearNode.selectedIndex].text);
			});
		
		$(dateNode).change(function()
			{
				dateInput.selectAll(":first-child").attr('disabled', true);
				_this.day = dateNode.selectedIndex;
			});
	
		$(monthNode).change(function()
			{
				monthInput.selectAll(":first-child").attr('disabled', true);
				var oldDate = dateNode.selectedIndex;
				dateInput.selectAll('option').remove();
				dots.year = parseInt(yearNode.options[yearNode.selectedIndex].text);
				dots.month = monthNode.selectedIndex;
				var daysInMonth = (new Date(dots.year, dots.month, 0)).getDate();
				dates = ['date (optional)'];
				for (var i = 1; i <= daysInMonth; ++i)
					dates.push(i);
				dateInput.selectAll('option').remove();
				dateInput.selectAll('option')
					.data(dates)
					.enter()
					.append('option')
					.text(function(d) { return d; });
				if (oldDate > 0 && oldDate <= daysInMonth)
					dateNode.selectedIndex = oldDate;
				dateInput.style('visibility', 'visible');
				if (monthNode.selectedIndex == 0)
					_this.month = undefined;
				else
					_this.month = monthNode.selectedIndex;
			});
	}
	
	DateInput.prototype.getDescription = function()
	{
		if (this.year && this.month)
		{
			var m = this.month.toString();
			if (m.length == 1)
				m = "0" + m;
			var t = this.year.toString() + "-" + m;
			if (this.day)
			{
				var d = this.day.toString();
				if (d.length == 1)
					d = "0" + d;
				t += "-" + d;
			}
			return t;
		}
		else if (this.year)
			return this.year.toString();
		else
			return "";
	}
	
	return DateInput;
})();

function setupPanel5(dots)
{
	var p = d3.select(this);
	p.append('div')
		.append('p').text("When did you start " + dots.offeringName + "?");
		
	dots.startDateInput = new DateInput();
	dots.startDateInput.append(this, dots);
				
	this.onReveal = null;
}

function setupPanel6(dots)
{
	var p = d3.select(this);
	p.append('div')
		.append('p').text("If it is over, when did you finish " + dots.offeringName + "?");

	dots.endDateInput = new DateInput()
	dots.endDateInput.append(this, dots);

	this.onReveal = null;
}

function setupPanel7(dots)
{
	var p = d3.select(this);
	
	p.selectAll("*").remove();
	
	if (dots.offeringName)
		p.append('div')
			.append('p').text("Offering: " + dots.offeringName);
			
	if (dots.organizationName)
		p.append('div')
			.append('p').text("Organization: " + dots.organizationName);
			
	if (dots.siteName)
		p.append('div')
			.append('p').text("Site: " + dots.siteName);
	
	if (dots.services.length > 0)
	{
		var servicesDiv = p.append('div');
		
		servicesDiv.append('p').text("Services");
		for (var i = 0; i < dots.services.length; ++i)
		{
			servicesDiv.append('p').text(dots.services[i].getDescription());
		}
	}
	
	{
		var startDate = dots.startDateInput.getDescription();
		var endDate = dots.endDateInput.getDescription();
		if (startDate && endDate)
			t = startDate + " - " + endDate;
		else if (startDate)
			t = startDate + " - ";
		else if (endDate)
			t = " - " + endDate;
		else
			t = "";
		if (t.length)
			p.append('div')
				.append('p').text(t);
	}
}

/* 
	objectData contains the MoreExperiences object.
 */
function showAddExperiencePanel(objectData, containerPanel) {
		var header = "New Experience";
			
		var panelDiv = createPanel(containerPanel, objectData, header)
						.classed("edit-panel new-experience-panel", true);

		var navContainer = panelDiv.appendNavContainer();

		var panel2Div = panelDiv.appendScrollArea()
			.classed("vertical-scrolling", false)
			.classed("no-scrolling", true);
		
		panel2Div.appendAlertContainer();
		
		var dots = appendDots(panel2Div, panelDiv, 8);		

		var hideSuccessFunction = function()
			{
				hidePanelDown($(dots.doneButton.node()).parents(".site-panel")[0]);
			};

		dots.doneButton = navContainer.appendRightButton();
		dots.doneButton.append("span").text("Next");
		dots.doneButton.on("click", function(d) {
			if (prepareClick())
			{
				showClickFeedback(this);
				
				if (dots.value == dots.count - 1)
					hideSuccessFunction();
				else
				{
					dots.setValue(dots.value + 1);
					unblockClick();
				}
			}
			d3.event.preventDefault();
		});
		dots.backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick())
				{
					showClickFeedback(this);
					if (dots.value > 0)
					{
						dots.setValue(dots.value - 1);
						unblockClick();
					}
					else
						hideSuccessFunction();
				}
				d3.event.preventDefault();
			});
		dots.backButton.append("span").text("Cancel");
		
		navContainer.appendTitle(header);
		
		var p0 = d3.select(dots.nthPanel(0));
		var p1 = d3.select(dots.nthPanel(1));
		
		setupPanel0(p0, dots);
		dots.nthPanel(1).onReveal = setupPanel1;
		dots.nthPanel(2).onReveal = setupPanel2;
		dots.nthPanel(3).onReveal = setupPanel3;
		dots.nthPanel(4).onReveal = setupPanel4;
		dots.nthPanel(5).onReveal = setupPanel5;
		dots.nthPanel(6).onReveal = setupPanel6;
		dots.nthPanel(7).onReveal = setupPanel7;
				
		showPanelUp(panelDiv.node());
		dots.showDots();
}
