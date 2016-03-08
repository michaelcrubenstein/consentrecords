/*
	organization.js
	
	Utility routines for managing organizations and their contents
 */

/* Append the specified address to the specified div, which is a d3.js object */
function appendAddress(address)
{
	var div = d3.select(this);
	crp.pushCheckCells(address, undefined, function()
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
	},
	function() {
	});
}

function getDateRange(d)
{
	var startDate = getStartDate(d);
	if (startDate === undefined || startDate === null)
		startDate = "";
	var endDate = getEndDate(d);
	if (endDate === undefined || endDate === null)
		endDate = "";
	var connector;
	if (startDate || endDate)
		connector = " - ";
	else
		connector = "";
	return startDate + connector + endDate;
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
				
function showUser(user, previousPanelNode)
{
	var panel = new UserPanel(user, previousPanelNode);
	showPanelLeft(panel.node());
}

function drawInfoButtons(infoButtons)
{
	var activeColor = "#2C55CC"

	var svg = infoButtons.append("svg")
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

