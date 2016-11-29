/*
	organization.js
	
	Utility routines for managing organizations and their contents
 */

/* Append the specified address to the specified div, which is a d3.js object */
function appendAddress(address)
{
	var div = d3.select(this);
	if (address && address.getValueID())
	{
		address.promiseCellsFromCache()
			.then(function()
			{
				var streetCell = address.getCell("Street");
				var city = address.getDatum("City");
				var stateCell = address.getCell("State");
				var zip = address.getDatum("Zip Code");
				if (streetCell)
					$(streetCell.data).each(function() {
						if (this.text && this.text.length > 0)
						{
							div.append('div')
								.classed("address-line", true)
								.text(this.text);
						}
					});
				line = "";
				if (city && city.length)
					line += city;
				if (stateCell && stateCell.data.length)
					line += ", " + stateCell.data[0].getDescription();
				if (zip && zip.length)
					line += "  " + zip;
				if (line.trim())
					div.append('div')
						.classed('address-line', true)
						.text(line.trim());
			});
	}
}

/* Return a new date that will be a UTC date that represents the same date
	as now in the currrent time zone. For example, 10:00 p.m. in Boston on Oct. 21, 2016 should
	be a UTC date of Oct. 21, 2016 even though that time is actually a UTC Date of Oct. 22, 2016.
 */ 
function getUTCTodayDate()
{
	var startMinDate = new Date();
	return new Date(Date.UTC(startMinDate.getFullYear(), startMinDate.getMonth(), startMinDate.getDate(), 0, 0, 0));
}

function getStartDate(d)
{
	return d.getDatum("Start");
}

function getEndDate(d) {
	return d.getDatum("End") || 
		   (d.getDatum("Start") ? new Date().toISOString().substr(0, 10) : undefined);
}	

/* Given an ISO Date string, return a locale date string */
function getLocaleDateString(s)
{
	if (s.length == 7)
		return Date.CultureInfo.monthNames[parseInt(s.substr(5)) - 1] + " " + s.substr(0, 4);
	else if (s.length == 10)
	{
		var a = new Date(s);
		
		/* Offset is set to set the time to 1:00 a.m. in the local time zone. Since creating
			a new date sets the time to midnight UTC, we need to set it an hour later in case 
			daylight saving's time is in effect. To account for different time zones, we 
			add an hour if the offset is positive, or subtract an hour if the offset is negative.
		 */
		var offset = (a.getTimezoneOffset()) * 60 * 1000;
		
		if (offset >= 0)
			offset += 60 * 60 * 1000;
		else
			offset -= 60 * 60 * 1000;
			
		a.setTime(a.getTime() + offset);
		return a.toLocaleDateString();
	}
	else
		return s;
}

function getDateRange(d)
{
	var startDate = getStartDate(d);
	startDate = startDate ? getLocaleDateString(startDate) : "";
		
	var endDate = d.getDatum("End");
	endDate = endDate ? getLocaleDateString(endDate) : "";
		
	var connector;
	if (startDate || endDate)
		return "{0} - {1}".format(startDate, endDate);
	else
		return "";
}

function appendSessionDescriptions(buttons)
{
	appendRightChevrons(buttons);
	
	buttons.append('div')
		.text(function(d) { 
			return d.getValue("Offering").getDescription();
		});

	var rightText = buttons.append('span').classed("centered-right-2", true);

	var leftText = buttons.append('div').classed("left-expanding-div description-text", true);
	
	leftText.append('div').classed("sub-text", true)
		.text(function(d) {
			return d.getDescription();
		});
	leftText.append('div').classed("sub-text", true)
		.text(getDateRange);
	leftText.append('div').classed("sub-text", true)
		.text(function(d) {
			var registrationDeadline = d.getDatum("Registration Deadline");
			if (registrationDeadline)
				return "register by " + registrationDeadline;
			else
				return "";
		});

	leftText.append('div').classed("sub-text sub-paragraph", true)
		.text(function(d) {
			return d.getValue("Organization").getDescription();
		});
	leftText.append('div').classed("sub-text", true)
		.text(function(d) {
			if (d.getValue("Site").getDescription() != d.getValue("Organization").getDescription())
				return d.getValue("Site").getDescription();
			else
				return null;
		});
}

function getUserName(user)
{
	var firstName = user.getDatum("_first name");
	var lastName = user.getDatum("_last name");
	if (firstName)
	{
		if (lastName)
			return firstName + " " + lastName;
		else
			return firstName;
	}
	else 
		return lastName;
}

function getPathDescription(path)
{
	return (path.cell && path.cell.parent && getUserName(path.cell.parent)) ||
			path.getDatum("_name") ||
		   (path.cell && path.cell.parent && path.cell.parent.getDescription()) ||
		   null;
}

function getUserDescription(user)
{
	return getUserName(user) || user.getDescription();
}
				
function showPath(path, previousPanelNode)
{
	path.promiseCells(["More Experience", "parents", "_user"])
	.then(function()
		{
			var panel = new OtherPathPanel(path, true);
			panel.pathtree.setUser(path, true);
			panel.showLeft().then(unblockClick);
		},
		cr.syncFail);
}

function showUser(user, previousPanelNode)
{
	user.promiseCells([])
	 .then(function()
		{
			var panel = new PathlinesPanel(user, true);
			panel.pathtree.setUser(user.getValue("More Experiences"), true);
			panel.showLeft().then(unblockClick);
		},
		cr.syncFail);
}

function drawInfoButtons(infoButtons)
{
	var activeColor = "#2C55CC"

	var svg = infoButtons.append("svg")
		.attr('xmlns', "http://www.w3.org/2000/svg")
		.attr('version', "1.1")
		.attr("width", "24px")
		.attr("height", "24px");
	var circles = svg.append("circle")
		.attr("cx", "12px")
		.attr("cy", "12px")
		.attr("r", "11px")
		.attr("fill", "transparent")
		.attr("stroke", activeColor)
		.attr("stroke-width", "1");
	var text = svg.append("text")
		.attr("x", "12px")
		.attr("y", "17px")
		.attr("text-anchor", "middle")
		.attr("font-family", "serif")
		.attr("font-weight", "bold")
		.attr("font-size", "16px")
		.attr("fill", activeColor)
		.text("i");
}

function appendInfoButtons(buttons, panelNode)
{
	var infoButtons =  buttons.insert("div", ":first-child")
		.classed("info-button right-fixed-width-div", true)
		.on("click", function(user) {
			if (prepareClick('click', 'show info: ' + user.getDescription()))
			{
				try
				{
					showUser(user, panelNode);
				}
				catch(err)
				{
					syncFailFunction(err);
				}
			}
			d3.event.preventDefault();
		});
	drawInfoButtons(infoButtons);
}

function appendStringItem(obj, label, text, addBorder)
{
	addBorder = (addBorder === undefined) ? true : addBorder;
	var sectionObj = d3.select(obj);

	sectionObj.classed("cell unique view", true);

	var labelDiv = sectionObj.append("label")
		.text(label);
	var itemsDiv = sectionObj.append("ol");

	itemsDiv.classed("right-label expanding-div", true);

	var setupItems = function(divs) {
		divs.append("div")
		.classed("string-value-view", true)
		.text(function(d) { return d; });
	}
	if (addBorder)
		sectionObj.append("div").classed("cell-border-below", true);	

	var divs = appendItems(itemsDiv, [text]);
	setupItems(divs);
}

function getOfferingAgeRange(offering)
{
	var min = offering.getDatum("Minimum Age");
	var max = offering.getDatum("Maximum Age");
	if (min)
	{
		if (max)
		{
			if (min == max)
				return min;
			else
				return min + " - " + max;
		}
		else
			return min + " or older";
	}
	else if (max)
	{
		return "up to " + max;
	}
	else
		return "";
}

function getOfferingGradeRange(offering)
{
	var min = offering.getDatum("Minimum Grade");
	var max = offering.getDatum("Maximum Grade");
	if (min)
	{
		if (max)
		{
			if (min == max)
				return min;
			else
				return min + " - " + max;
		}
		else
			return min + " or beyond";
	}
	else if (max)
	{
		return "up to " + max;
	}
	else
		return "";
}

function showAgeRange(offering, successFunction)
{
	return offering.promiseCellsFromCache()
		.then(function()
			{
				successFunction(getOfferingAgeRange(offering));
			});
}

function showGradeRange(offering, successFunction)
{
	return offering.promiseCellsFromCache()
		.then(function()
			{
				successFunction(getOfferingGradeRange(offering));
			});
}

function showWebSite(offering, successFunction)
{
	return offering.promiseCellsFromCache()
		.then(function()
			{
				var newText = offering.getDatum("Web Site");
				successFunction(newText);
			});
}

function getPickedOrCreatedValue(i, pickedName, createdName)
{
	var v = i.getValue(pickedName);
	if (v && v.getValueID())
		return v.getDescription();
	else {
		v = i.getValue(createdName);
		if (v)
			return v.text;
		else
			return undefined;
	}
}

function getTagList(experience)
{
	var names = [];
	
	var offering = experience.getValue("Offering");
	if (offering && offering.getValueID())
	{
		if (!offering.isDataLoaded)
			throw ("Runtime error: offering data is not loaded");
			
		names = offering.getCell("Service").data
			.filter(function(v) { return !v.isEmpty(); })
			.map(function(v) { return v.getDescription(); });
	}
	
	var serviceCell = experience.getCell("Service");
	var userServiceCell = experience.getCell("User Entered Service");

	if (serviceCell)
		names = names.concat(serviceCell.data
			.filter(function(v) { return !v.isEmpty(); })
			.map(function(v) { return v.getDescription(); }));
	
	if (userServiceCell)
		names = names.concat(userServiceCell.data
			.filter(function(v) { return !v.isEmpty(); })
			.map(function(v) { return v.getDescription(); }));
	
	return names.join(", ");
}

function getNamedInstance(data, name)
{
	for (i = 0; i < data.length; ++i)
	{
		var d = data[i];
		if (d.getDatum("_name") === name)
			return d;
	}
	return null;
}

/* Returns a dictionary describing which privileges can be used to provide 
	the capabilities of each privilege.
 */
function getValidPrivileges(enumerators, priv)
{
	var administerValue = getNamedInstance(enumerators, "_administer");
	var writeValue = getNamedInstance(enumerators, "_write");
	var readValue = getNamedInstance(enumerators, "_read");
	var findValue = getNamedInstance(enumerators, "_find");
	var registerValue = getNamedInstance(enumerators, "_register");
	
	if (priv === findValue)
		return [findValue, readValue, registerValue, writeValue, administerValue];
	else if (priv === readValue)
		return [readValue, writeValue, administerValue];
	else if (priv === registerValue)
		return [registerValue, writeValue, administerValue];
	else if (priv === writeValue)
		return [writeValue, administerValue];
	else if (priv === administerValue)
		return [administerValue];
	else
		return [];
}

/* Adds a missing access record to the source user. */
function addMissingAccess(source, privilege, target, cellName, done, fail)
{
	var privilegePath = "_term[_name=_privilege]>enumerator";
	var p1 = crp.promise({path: privilegePath});
	var p2 = cr.getData({path: "#" + source.getValueID() + '>"_access record"'});
	$.when(p1, p2)
	 .then(function(enumerators, accessRecords)
		{
			var priv = getNamedInstance(enumerators, privilege);
			var validPrivs = getValidPrivileges(enumerators, priv).map(function(d) { return d.getValueID(); });

			var a = accessRecords.filter(
				function(ar) {
					var privCell = ar.getCell("_privilege");
					return privCell.data.some(
						function(d) { 
							return validPrivs.indexOf(d.getValueID()) >= 0; 
						});
				});
			var b = a.filter(
				function(ar) {
					var groupCell = ar.getCell(cellName);
					function hasTargetValueID(d)
					{
						return d.getValueID() === target.getValueID();
					}
					return groupCell.data.some(hasTargetValueID);
				});
			if (b.length > 0)
				done();
			else
			{
				var c = a.filter(
					function(ar) {
						var storedPrivilegeValue = ar.getValue("_privilege");
						return storedPrivilegeValue &&
							   storedPrivilegeValue.getValueID() === priv.getValueID();
					});
					
				var promise;
				if (c.length > 0)
				{
					/* Test case: Sign up for a session (using the /find/ URL) when the 
						user shares read access with some users but not the group that owns this session. */
					var cell = c[0].getCell(cellName);
					
					promise = cr.updateValues([cell.getAddCommand(target)], [cell]);
				}
				else
				{
					/* Test case: Sign up for a session (using the /find/ URL) when the 
						user shares read access with no users or groups. */
					var field = source.getCell("_access record").field;
					var initialData = {"_privilege": [{instanceID: priv.getValueID()}] };
					initialData[cellName] = [{instanceID: target.getValueID()}];
					promise = cr.createInstance(field, source.getValueID(), initialData);
				}
				promise.then(done, fail);
			}
		},
		fail);
}

