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
	var containerHeight = parseInt(container.style("height"));

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
	
	var dataLeftMargin = 40;
	var otherColor = "#bbbbbb";
		
	var minDate, maxDate, timespan;
	var years = [];

	var successFunction1 = function(experiences)
	{
		allExperiences = experiences;
		$(experiences).each(function()
		{
			this.value.description = this.getValue("Offering").getDescription();
		});
		
		crp.getData("Service", undefined, function(newInstances)
		{
			crp.getData('"Service Domain"', undefined, function(newInstances)
			{
				for (i = 0; i < newInstances.length; ++i)
				{
					if (newInstances[i].getDescription() == "Other")
					{
						color = newInstances[i].getValue("Color");
						if (color && color.value)
							otherColor = color;
						break;
					}
				}
				
				crp.pushCheckCells(userInstance, function() {
						var m = userInstance.getValue("More Experiences");
						if (m)
						{
							var path = "#" + m.getValueID() + '>"More Experience"';
							cr.getData(path, undefined, successFunction2, asyncFailFunction);
						}
					},
					asyncFailFunction);
			},
			asyncFailFunction);
		},
		asyncFailFunction);
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

	function getExperiencePath(experience, i)
	{
		var t = this.parentNode.children[1];	/* The text node. */
		var bbox = t.getBBox();
		var stem = parseFloat(this.parentNode.getAttribute("stem"));
		var h = getExperienceHeight(experience, i);
		var newH = bbox.height + 3;
		var x1 = 0;
		var x2 = x1 + stem + 35 + 20;
		var x3 = x1 + stem;
		var x4 = x1 + 05;
		var y1 = 0;
		var y2 = y1 + newH;
		var y3;
		if (h < 3)
			y3 = y1 + h;
		else
			y3 = y1 + 3;
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
		
		function clickExperienceRect(experience, i)
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

			bootstrap_alert.warning(lines.join(separator="<br>"), ".alert-container");
		}
		
		var g = experienceGroup.selectAll('g')
			.data(allExperiences)
			.enter()
			.append('g');
			
		var rect = g.append('path')
			.attr("fill-opacity", "0.3")
			.attr("stroke-opacity", "0.7")
			.on("click", clickExperienceRect);
		rect.each(setColor);

		var t = g.append('text')
			.attr("x", "10")
			.attr("y", "0")
			.attr("dy", "1.1")
			.text(function(d) { return d.getDescription(); })
			.on("click", clickExperienceRect);
		
		t.attr("y", function(experience)
			{
				var bbox = this.getBBox();
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
			.attr("x", 10);
			
		function layoutExperiences()
		{
			containerHeight = parseInt(container.style("height"));
			
			bg.attr("width", container.style("width"))
			  .attr("height", container.style("height"));

			var columns = [];
			var g = experienceGroup.selectAll('g');
				g.attr("y", getExperienceY);	
			g.each(function(e, i)
			{
				var j;
				for (j = 0; j < columns.length; ++j)
				{
					// If this item's height + y is greater than the last item,
					// then add this to the column.
					lastTop = parseFloat(columns[j][columns[j].length - 1].getAttribute("y"));
					if (lastTop >
						parseFloat(this.getAttribute("y")) + 
						getExperienceHeight(e, i) &&
						lastTop > parseFloat(this.getAttribute("y")) + 
						this.children[1].getBBox().height + 3)
					{
						columns[j].push(this);
						break;
					}
				}
				if (j == columns.length)
				{
					columns.push([this]);
				}
			});
			defs.selectAll('clipPath').remove();
			for (var j = 0; j < columns.length; ++j)
			{
				var x = dataLeftMargin + (10 * j);
				var stemLength = (10 * columns.length) + (50 * j);
			
				/* Add a clipPath for every column. */
				defs.append('clipPath')
					.attr('id', 'id_clipPath' + j)
					.append('rect')
					.attr('x', 0)
					.attr('y', 0)
					.attr('height', columns[j][0].children[1].getBBox().height)
					.attr('width', stemLength + 35 + 10);

				for (var i = 0; i < columns[j].length; ++i)
				{
					var g = columns[j][i];
					g.setAttribute("transform", 
						"translate(" + x + "," + g.getAttribute("y") + ")");
					g.setAttribute("stem", stemLength);
					g.children[1].setAttribute('clip-path', 'url(#id_clipPath'+j+')');
				}
			}
			rect.attr("d", getExperiencePath);
			t.attr("x", function(e, i)
			{
				var stem = this.parentNode.getAttribute("stem");
				return parseFloat(stem) + 10;
			});
		
			y.attr("y", function(d) { 
					return DateToY(new Date(d, 0, 0));
				});
		}
		$(window).on("resize", layoutExperiences);
		$(panelDiv).on("hiding.cr", function()
		{
			$(window).off("resize", layoutExperiences);
		});
		layoutExperiences();
	}
	
	var path = "#" + userInstance.getValueID() + '::reference(Experience)';
	cr.getData(path, ["parents"], successFunction1, asyncFailFunction);
}

