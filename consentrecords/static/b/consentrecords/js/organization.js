/*
	organization.js
	
	Utility routines for managing organizations and their contents
 */
 
cr.organizationStrings = 
	{
		someone: "Someone"
	};

/* Append the specified address to the specified div, which is a d3.js object */
function appendAddress(address)
{
	var div = d3.select(this);
	if (address && address.getInstanceID())
	{
		address.promiseCellsFromCache()
			.then(function()
			{
				var streets = address.streets();
				var city = address.city();
				var state = address.state();
				var zip = address.zipCode();
				if (streets)
					$(streets).each(function() {
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
				if (state)
					line += ", " + state;
				if (zip && zip.length)
					line += "  " + zip;
				if (line.trim())
					div.append('div')
						.classed('address-line', true)
						.text(line.trim());
			});
	}
}

function getMonthString(date)
{
	var s = (date.getUTCMonth() + 1).toString();
	return (s.length == 1) ? "0" + s : s;
}

function appendSessionDescriptions(buttons)
{
	buttons.append('div')
		.text(function(d) { 
			return d.offering().description();
		});

	var rightText = buttons.append('span').classed("centered-right-2", true);

	var leftText = buttons.append('div').classed("left-expanding-div description-text", true);
	
	leftText.append('div').classed("sub-text", true)
		.text(function(d) {
			return d.description();
		});
	leftText.append('div').classed("sub-text", true)
		.text(getDateRange);
	leftText.append('div').classed("sub-text", true)
		.text(function(d) {
			var registrationDeadline = d.registrationDeadline();
			if (registrationDeadline)
				return "register by " + registrationDeadline;
			else
				return "";
		});

	leftText.append('div').classed("sub-text sub-paragraph", true)
		.text(function(d) {
			return d.organization().description();
		});
	leftText.append('div').classed("sub-text", true)
		.text(function(d) {
			if (d.site().description() != d.organization().description())
				return d.site().description();
			else
				return null;
		});
	crf.appendRightChevrons(buttons);
}

function getUserName(user)
{
	var firstName = user.firstName();
	var lastName = user.lastName();
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

/**
 * Returns a string that describes the user associated with the specified path.
 * The string may be either the name of the user associated with the path (if defined
 * and accessible), the screen name associated with the path, the email address
 * associated with the user associated with the path (if defined and accessible) or
 * "Someone" (or some translation thereof)
 */
function getPathDescription(path)
{
	return (path.user() && getUserName(path.user())) ||
			path.description() ||
		   (path.user() && path.user().description()) ||
		    cr.organizationStrings.someone;
}

function getUserDescription(user)
{
	return getUserName(user) || user.description();
}
				
/**
 *	Displays a panel containing the experiences within the specified path.
 */				
function showPath(path)
{
	return path.promiseCells(["More Experience", "parents", cr.fieldNames.user])
			   .then(function()
				{
					var panel = new OtherPathPanel(path, true);
					panel.pathtree.setUser(path, true);
					panel.showLeft().then(unblockClick);
					
					r2 = $.Deferred();
					r2.resolve(panel);
					return r2;
				},
				cr.syncFail);
}

/**
 *	Displays a panel containing the experiences within the path of the specified user.
 */				
function showUser(user)
{
	user.promisePath()
	 .then(function()
		{
			var panel = new PathlinesPanel(user, true);
			panel.pathtree.setUser(user.path(), true);
			panel.showLeft().then(unblockClick);
		},
		cr.syncFail);
}

/**
	Draw the contents of the specified infoButtons.
	An info button is a circle with the letter 'i' within it.
 */
function drawInfoButtons(infoButtons)
{
	var activeColor = "#2C55CC"
	
	infoButtons.text("i");

/* 
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
 */
}

function appendInfoButtons(items, dataF)
{
	/* infoButtons need to be wrapped inside of a div so that the other
		div can contain a separate border if needed. 
	 */
	dataF = (dataF !== undefined) ? dataF : function(d) { return d; };
	var outerDiv = items
		.append('div')
		.classed('info-button-container', true);
	var infoButtons =  outerDiv
		.append('div')
		.classed('info-button', true)
		.on('click', function(userContainer) {
			var user = dataF(userContainer);
			if (prepareClick('click', 'show info: ' + user.description()))
			{
				try
				{
					showUser(user);
				}
				catch(err)
				{
					cr.syncFail(err);
				}
			}
			d3.event.preventDefault();
		});
	drawInfoButtons(infoButtons);
	return outerDiv;
}

function appendStringItem(obj, label, text, addBorder)
{
	addBorder = (addBorder === undefined) ? true : addBorder;
	var sectionObj = d3.select(obj);

	sectionObj.classed("cell unique view", true);

	var labelDiv = sectionObj.append("label")
		.text(label);
	var itemsDiv = crf.appendItemList(sectionObj)
							 .classed("hover-items", true);

	if (addBorder)
		sectionObj.append("div").classed("cell-border-below", true);	

	var items = appendItems(itemsDiv, [text]);
	items.append("div")
		.classed("string-value-view growable unselectable", true)
		.text(function(d) { return d; });
}

function showAgeRange(offering, successFunction)
{
	return offering.promiseCellsFromCache()
		.then(function()
			{
				successFunction(offering.ageRange());
			});
}

function showGradeRange(offering, successFunction)
{
	return offering.promiseCellsFromCache()
		.then(function()
			{
				successFunction(offering.gradeRange());
			});
}

function showWebSite(offering, successFunction)
{
	return offering.promiseCellsFromCache()
		.then(function()
			{
				var newText = offering.webSite();
				successFunction(newText);
			});
}

function checkOfferingCells(experience)
{
	offering = experience.offering();
	if (offering && offering.id() && !offering.services)
	{
		var storedI = crp.getInstance(offering.id());
		if (storedI && storedI.getCells())
		{
			offering.importCells(storedI.getCells());
			r = $.Deferred();
			r.resolve();
			return r;
		}
		else
		{
			return offering.promiseCells();
		}
	}
	else
	{
		r = $.Deferred();
		r.resolve();
		return r;
	}
}

function getNamedInstance(data, name)
{
	for (i = 0; i < data.length; ++i)
	{
		var d = data[i];
		if (d.getDatum(cr.fieldNames.name) === name)
			return d;
	}
	return null;
}

/* Returns a dictionary describing which privileges can be used to provide 
	the capabilities of each privilege.
 */
function getValidPrivileges(enumerators, priv)
{
	var administerValue = getNamedInstance(enumerators, cr.privileges.administer);
	var writeValue = getNamedInstance(enumerators, cr.privileges.write);
	var readValue = getNamedInstance(enumerators, cr.privileges.read);
	var findValue = getNamedInstance(enumerators, cr.privileges.find);
	var registerValue = getNamedInstance(enumerators, cr.privileges.register);
	
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
	var privilegePath = "term[name=privilege]/enumerator";
	var p1 = crp.promise({path: privilegePath});
	var p2 = cr.getData({path: source.getInstanceID() + '/' + cr.fieldNames.accessRecord});
	$.when(p1, p2)
	 .then(function(enumerators, accessRecords)
		{
			var priv = getNamedInstance(enumerators, privilege);
			var validPrivs = getValidPrivileges(enumerators, priv).map(function(d) { return d.getInstanceID(); });

			var a = accessRecords.filter(
				function(ar) {
					var privCell = ar.getCell(cr.fieldNames.privilege);
					return privCell.data.some(
						function(d) { 
							return validPrivs.indexOf(d.getInstanceID()) >= 0; 
						});
				});
			var b = a.filter(
				function(ar) {
					var groupCell = ar.getCell(cellName);
					function hasTargetValueID(d)
					{
						return d.getInstanceID() === target.getInstanceID();
					}
					return groupCell.data.some(hasTargetValueID);
				});
			if (b.length > 0)
				done();
			else
			{
				var c = a.filter(
					function(ar) {
						var storedPrivilegeValue = ar.getValue(cr.fieldNames.privilege);
						return storedPrivilegeValue &&
							   storedPrivilegeValue.getInstanceID() === priv.getInstanceID();
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
					var field = source.getCell(cr.fieldNames.accessRecord).field;
					var initialData = {};
					initialData[cr.fieldNames.privilege] = [{instanceID: priv.getInstanceID()}];
					initialData[cellName] = [{instanceID: target.getInstanceID()}];
					promise = cr.createInstance(field, source.getInstanceID(), initialData);
				}
				promise.then(done, fail);
			}
		},
		fail);
}

