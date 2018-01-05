/*
	organization.js
	
	Utility routines for managing organizations and their contents
 */
 
/* Append the specified address to the specified div, which is a d3.js object */
function appendAddress(address)
{
	var div = d3.select(this);
	if (address && address.id())
	{
		address.promiseData()
			.then(function()
			{
				var streets = address.streets();
				var city = address.city();
				var state = address.state();
				var zip = address.zipCode();
				if (streets)
					$(streets).each(function() {
						if (this.text() && this.text().length > 0)
						{
							div.append('div')
								.classed("address-line", true)
								.text(this.text());
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
	var leftText = buttons.append('div').classed("growable", true);
	
	leftText.append('div')
		.text(function(d) { 
			return d.offering().description();
		});

	leftText.append('div').classed("sub-text description-text", true)
		.text(function(d) {
			return d.description();
		});
	leftText.append('div').classed("sub-text description-text", true)
		.text(function(d) {
			return d.dateRange();
		});
	leftText.append('div').classed("sub-text description-text", true)
		.text(function(d) {
			var registrationDeadline = d.registrationDeadline();
			if (registrationDeadline)
			{
				return crv.buttonTexts.registerByDate.format(getLocaleDateString(registrationDeadline));
			}
			else
				return "";
		});

	leftText.append('div').classed("sub-text sub-paragraph description-text", true)
		.text(function(d) {
			return d.organization().description();
		});
	leftText.append('div').classed("sub-text description-text", true)
		.text(function(d) {
			if (d.site().description() != d.organization().description())
				return d.site().description();
			else
				return null;
		});
	crf.appendRightChevrons(buttons);
}

/**
 *	Displays a panel containing the experiences within the specified path.
 */				
function showPath(path)
{
	return path.promiseExperiences()
			   .then(function()
				{
					var panel = new OtherPathPanel(path, true);
					panel.pathtree.setUser(path);
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
	user.promiseData(['path'])
	 .then(function()
		{
			try
			{
				var panel = new PathlinesPanel(user, true);
				panel.pathtree.setUser(user.path());
				panel.showLeft().then(unblockClick);
			}
			catch(err)
			{
				cr.syncFail(err);
			}
		},
		cr.syncFail);
}

/**
	Draw the contents of the specified infoButtons.
	An info button is a circle with the letter 'i' within it.
 */
function drawInfoButtons(infoButtons)
{
	infoButtons.text("i");
}

function appendInfoButtons(items, dataF, appendF)
{
	/* infoButtons need to be wrapped inside of a div so that the other
		div can contain a separate border if needed. 
	 */
	dataF = (dataF !== undefined) ? dataF : function(d) { return d; };
	appendF = (appendF !== undefined) ? appendF : function(items) { return items.append('div'); };
	
	var outerDiv = appendF(items)
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
			d3.event.stopPropagation();
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
		.classed("text-fill growable unselectable", true)
		.text(function(d) { return d; });
}

function checkOfferingCells(experience)
{
	offering = experience.offering();
	console.assert(!offering || !offering.id() || offering.offeringServices());
	r = $.Deferred();
	r.resolve();
	return r;
}

